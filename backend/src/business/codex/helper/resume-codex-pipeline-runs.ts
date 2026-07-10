/**
 * WHAT: Reconciles the durable active pipeline on server startup and continues its next pending skill.
 * WHY: Completed process logs must advance execution without duplicating already-finished Codex sessions.
 */
import { resolve } from 'node:path';
import { readCodexPipelineStore, writeCodexPipelineStore } from './codex-pipeline-store.js';
import {
  derivePipelineSkillStatus,
  pipelineRuntimeRun,
  reassessPipelineAfterSkill,
  runNextPipelineSkill,
} from './codex-pipeline-runner.js';

type AnyRecord = Record<string, unknown>;

export async function resumeCodexPipelineRuns(input: {
  decisionOsRoot?: string;
  runtime: AnyRecord;
}): Promise<AnyRecord> {
  const decisionOsRoot = resolve(input.decisionOsRoot ?? String(input.runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  const activeRunId = normalized.store.activeWorkspaceRun;
  if (!activeRunId) return { ok: true, resumed: [], activeRunId: null };
  let run = normalized.store.runs.find((entry) => entry.id === activeRunId);
  if (!run) return { ok: true, resumed: [], activeRunId: null };

  for (const step of run.steps) {
    for (const skill of step.skills) {
      if (skill.status !== 'running') continue;
      if (pipelineRuntimeRun(input.runtime, skill.runId)?.status === 'running') {
        return { ok: true, resumed: [], activeRunId, alreadyRunning: skill.runId };
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
      if (run.status === 'failed' || run.status === 'cancelled') {
        return { ok: true, resumed: [], activeRunId: null, terminalRunId: run.id, status: run.status };
      }
    }
  }

  run = reassessPipelineAfterSkill({ decisionOsRoot, runtime: input.runtime, pipelineRunId: run.id }) ?? run;
  if (run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled') {
    return { ok: true, resumed: [], activeRunId: null, terminalRunId: run.id, status: run.status };
  }
  const resumedAt = new Date().toISOString();
  const current = readCodexPipelineStore({ decisionOsRoot });
  const resumedRun = { ...run, resumedAt, updatedAt: resumedAt };
  writeCodexPipelineStore({
    decisionOsRoot,
    store: {
      ...current.store,
      runs: current.store.runs.map((entry) => entry.id === run?.id ? resumedRun : entry),
      activeWorkspaceRun: run.id,
    },
  });
  const launch = runNextPipelineSkill({ decisionOsRoot, runtime: input.runtime, pipelineRunId: run.id });
  return {
    ok: launch.ok !== false,
    resumed: launch.skillRun ? [launch.skillRun] : [],
    activeRunId: run.id,
    launch,
  };
}
