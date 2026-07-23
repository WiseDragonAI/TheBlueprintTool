/**
 * WHAT: Cancels one exact pipeline execution and its downstream replicated dependents.
 * WHY: Mutable manifest phase, stored PID fields, runtime aliases, and logs cannot authorize cancellation.
 */
import { resolve } from 'node:path';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { cancelPipelineDependents } from '../helper/codex-pipeline-runner.js';
import { readCodexPipelineRunController } from './read-codex-pipeline-run-controller.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';
import { cancelTaskExecution } from '../helper/cancel-task-execution.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function cancelCodexPipelineRunController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const runId = text(payload.runId ?? payload.pipelineRunId);
  const executionId = text(payload.executionId);
  if (!runId || !executionId) return { ok: false, statusCode: 400, error: 'Missing pipeline run id or execution id.' };
  const run = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === runId);
  if (!run) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId };
  const execution = taskExecutionState(runtime)?.executions.find(executionId) ?? null;
  if (!execution) return { ok: false, statusCode: 404, error: 'Pipeline execution not found.', runId, executionId };
  if (execution.metadata.pipelineRunId !== run.id) {
    return { ok: false, statusCode: 409, error: 'Pipeline execution is no longer active.', runId, executionId };
  }
  if (['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.lifecycle.phase)) {
    return readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
  }
  const result = await cancelTaskExecution({ runtime, executionId });
  if (!result.ok) return { ...result, runId };
  if (result.phase !== 'cancelled') return { ...result, status: 'running', runId, executionId };
  await cancelPipelineDependents({ runtime, pipelineRunId: run.id, executionId });
  const detail = await readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
  return { ...detail, status: 'cancelled', statusCode: 202, cancellationRequested: true };
}
