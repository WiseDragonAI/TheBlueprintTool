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
import { readCodexProcessQueue } from './codex-process-queue.js';

type AnyRecord = Record<string, unknown>;

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
