/**
 * WHAT: Reconciles every durable running pipeline and fills available Codex process slots.
 * WHY: Running and queued work must survive restart without exceeding configured workspace capacity.
 */
import { resolve } from 'node:path';
import { readCodexPipelineStore, writeCodexPipelineStore } from './codex-pipeline-store.js';
import {
  derivePipelineSkillStatus,
  pipelineRuntimeRun,
  reassessPipelineAfterSkill,
  runNextPipelineSkill,
} from './codex-pipeline-runner.js';
import { scheduleCodexProcesses } from './codex-process-scheduler.js';
import { isSameCodexProcess, readCodexProcessQueue } from './codex-process-queue.js';
import { codexExecutionTimeoutMs, reportCodexBackgroundFailure, scheduleCodexRuntime, updateCodexRuntimeRun } from './codex-runtime-run-store.js';
import { signalCodexProcessTree } from './reconcile-terminal-codex-process.js';

type AnyRecord = Record<string, unknown>;

function adoptedPipelineMonitors(runtime: AnyRecord): Map<string, NodeJS.Timeout> {
  if (runtime.codexAdoptedPipelineProcessMonitors instanceof Map) {
    return runtime.codexAdoptedPipelineProcessMonitors as Map<string, NodeJS.Timeout>;
  }
  const monitors = new Map<string, NodeJS.Timeout>();
  Object.defineProperty(runtime, 'codexAdoptedPipelineProcessMonitors', { value: monitors, writable: true, configurable: true, enumerable: false });
  return monitors;
}

export function stopAdoptedPipelineProcessMonitors(runtime: AnyRecord): void {
  const monitors = runtime.codexAdoptedPipelineProcessMonitors instanceof Map
    ? runtime.codexAdoptedPipelineProcessMonitors as Map<string, NodeJS.Timeout>
    : null;
  if (!monitors) return;
  for (const timer of monitors.values()) clearTimeout(timer);
  monitors.clear();
}

function monitorAdoptedPipelineSkill(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRunId: string;
  skill: { runId: string; executionId: string; processId?: number; processStartTime?: string; startedAt?: string | null };
}): void {
  const processId = Number(input.skill.processId ?? 0);
  const processStartTime = String(input.skill.processStartTime ?? '');
  const parsedStartedAtMs = Date.parse(String(input.skill.startedAt ?? ''));
  const startedAtMs = Number.isFinite(parsedStartedAtMs) ? parsedStartedAtMs : Date.now();
  const timeoutMs = codexExecutionTimeoutMs(input.runtime);
  let timeoutReported = false;
  let forcedAt = 0;
  const monitorKey = `${input.pipelineRunId}:${input.skill.runId}:${input.skill.executionId}`;
  const monitors = adoptedPipelineMonitors(input.runtime);
  if (monitors.has(monitorKey)) return;
  const stop = (): void => {
    const timer = monitors.get(monitorKey);
    if (timer) clearTimeout(timer);
    monitors.delete(monitorKey);
  };
  const scheduleCheck = (): void => {
    const timer = setTimeout(check, 250);
    timer.unref?.();
    monitors.set(monitorKey, timer);
  };
  const check = (): void => {
    try {
      const runtimeRun = pipelineRuntimeRun(input.runtime, input.skill.runId);
      if (!runtimeRun || String(runtimeRun.executionId ?? '') !== input.skill.executionId || String(runtimeRun.status ?? '') !== 'running') {
        stop();
        return;
      }
      if (isSameCodexProcess(processId, processStartTime)) {
        if (Date.now() - startedAtMs >= timeoutMs) {
          if (!timeoutReported) {
            timeoutReported = true;
            forcedAt = Date.now() + 2_000;
            signalCodexProcessTree({ pid: processId, signal: 'SIGTERM' });
            reportCodexBackgroundFailure(input.runtime, 'adopted-pipeline-execution-timeout', new Error(`Adopted pipeline Codex execution exceeded ${timeoutMs}ms.`), { pipelineRunId: input.pipelineRunId, runId: input.skill.runId, executionId: input.skill.executionId, processId });
          } else if (Date.now() >= forcedAt) {
            signalCodexProcessTree({ pid: processId, signal: 'SIGKILL' });
            stop();
            return;
          }
        }
        scheduleCheck();
        return;
      }
      stop();
      const current = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store.runs.find((run) => run.id === input.pipelineRunId);
      const skill = current?.steps.flatMap((step) => step.skills).find((candidate) => candidate.runId === input.skill.runId);
      if (!skill || skill.executionId !== input.skill.executionId) return;
      const derived = derivePipelineSkillStatus({ skill, runtime: input.runtime });
      const status = runtimeRun.cancelRequestedAt
        ? 'cancelled'
        : derived === 'complete' || derived === 'failed' || derived === 'cancelled' ? derived : 'failed';
      const finishedAt = new Date().toISOString();
      const reassessed = reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: input.pipelineRunId,
        skillRunId: input.skill.runId,
        settledStatus: status,
        error: status === 'failed' ? 'Adopted Codex process exited without a terminal event.' : '',
        finishedAt,
      });
      updateCodexRuntimeRun(input.runtime, input.skill.runId, { status, finishedAt, settledAt: finishedAt });
      if (status === 'complete' && reassessed && reassessed.status === 'running') {
        runNextPipelineSkill({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, pipelineRunId: input.pipelineRunId });
      }
      scheduleCodexRuntime(input.runtime, 'schedule-after-adopted-pipeline-settlement', { pipelineRunId: input.pipelineRunId, runId: input.skill.runId, executionId: input.skill.executionId });
    } catch (error) {
      stop();
      reportCodexBackgroundFailure(input.runtime, 'monitor-adopted-pipeline-process', error, { pipelineRunId: input.pipelineRunId, runId: input.skill.runId, executionId: input.skill.executionId });
    }
  };
  scheduleCheck();
}

export async function resumeCodexPipelineRuns(input: {
  decisionOsRoot?: string;
  runtime: AnyRecord;
}): Promise<AnyRecord> {
  const decisionOsRoot = resolve(input.decisionOsRoot ?? String(input.runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  const resumed: AnyRecord[] = [];

  for (const storedRun of normalized.store.runs.filter((entry) => entry.status === 'running')) {
    let run = storedRun;
    let ownedByRuntime = false;
    for (const step of run.steps) {
      for (const skill of step.skills) {
        if (skill.status !== 'running') continue;
        if (pipelineRuntimeRun(input.runtime, skill.runId)?.status === 'running') {
          ownedByRuntime = true;
          resumed.push({ pipelineRunId: run.id, runId: skill.runId, alreadyRunning: true });
          continue;
        }
        if (isSameCodexProcess(Number(skill.processId ?? 0), String(skill.processStartTime ?? ''))) {
          updateCodexRuntimeRun(input.runtime, skill.runId, {
            id: skill.runId,
            executionId: skill.executionId,
            pipelineRunId: run.id,
            ledgerId: run.ledgerId,
            sourceCardId: run.sourceCardId,
            outputCardId: step.outputCardId,
            stdoutFile: skill.stdoutFile,
            stderrFile: skill.stderrFile,
            pid: skill.processId,
            processStartTime: skill.processStartTime,
            status: 'running',
            adopted: true,
            startedAt: skill.startedAt,
          });
          monitorAdoptedPipelineSkill({ decisionOsRoot, runtime: input.runtime, pipelineRunId: run.id, skill });
          ownedByRuntime = true;
          resumed.push({ pipelineRunId: run.id, runId: skill.runId, executionId: skill.executionId, adopted: true });
          continue;
        }
        const derived = derivePipelineSkillStatus({ skill });
        const status = derived === 'complete' || derived === 'failed' || derived === 'cancelled' ? derived : 'failed';
        run = reassessPipelineAfterSkill({
          decisionOsRoot,
          runtime: input.runtime,
          pipelineRunId: run.id,
          skillRunId: skill.runId,
          settledStatus: status,
          error: status === 'failed' && derived === 'running' ? 'Codex process was interrupted before a terminal event was persisted.' : skill.error,
          finishedAt: new Date().toISOString(),
        }) ?? run;
      }
    }
    if (!ownedByRuntime) {
      const reassessed = reassessPipelineAfterSkill({ decisionOsRoot, runtime: input.runtime, pipelineRunId: run.id }) ?? run;
      if (reassessed.status === 'running') {
        const resumedAt = new Date().toISOString();
        const current = readCodexPipelineStore({ decisionOsRoot });
        writeCodexPipelineStore({
          decisionOsRoot,
          store: {
            ...current.store,
            runs: current.store.runs.map((entry) => entry.id === reassessed.id ? { ...entry, resumedAt, updatedAt: resumedAt } : entry),
          },
        });
        const launch = runNextPipelineSkill({ decisionOsRoot, runtime: input.runtime, pipelineRunId: reassessed.id });
        if (launch.skillRun) resumed.push(launch.skillRun as AnyRecord);
      }
    }
  }

  const sharedSchedule = input.runtime.scheduleCodexProcesses;
  const schedule = typeof sharedSchedule === 'function'
    ? await sharedSchedule()
    : await scheduleCodexProcesses({ decisionOsRoot, runtime: input.runtime });
  const launches = Array.isArray(schedule.launched) ? schedule.launched as AnyRecord[] : [];
  resumed.push(...launches.filter((entry) => entry.skillRun).map((entry) => entry.skillRun as AnyRecord));
  const current = readCodexPipelineStore({ decisionOsRoot }).store;
  const activeRunIds = current.runs.filter((entry) => entry.status === 'running').map((entry) => entry.id);
  return {
    ok: launches.every((entry) => entry.ok !== false),
    resumed,
    activeRunId: activeRunIds[0] ?? null,
    activeRunIds,
    queuedRunIds: [
      ...current.runs.filter((entry) => entry.status === 'pending').map((entry) => entry.id),
      ...readCodexProcessQueue(decisionOsRoot).filter((entry) => entry.status === 'pending').map((entry) => entry.id),
    ],
  };
}
