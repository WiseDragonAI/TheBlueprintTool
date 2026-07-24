/**
 * WHAT: Cancels one card-scoped execution through the replicated execution authority.
 * WHY: Card leases, queue records, runtime aliases, and mutable pipeline phases cannot authorize cancellation.
 */
import { cancelCodexPipelineRunController } from './cancel-codex-pipeline-run-controller.js';
import { cancelTaskExecution } from '../helper/cancel-task-execution.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

export async function cancelCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  const executionId = String(payload.executionId ?? '').trim();
  if (!ledgerId || !cardId || !runId || !executionId) {
    return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, runId, or executionId.' };
  }

  const execution = taskExecutionState(runtime)?.executions.find(executionId) ?? null;
  if (!execution) return { ok: false, statusCode: 404, error: 'Execution not found.', runId, executionId };
  const metadata = execution.metadata;
  if (metadata.ledgerId !== ledgerId
    || metadata.sessionId !== runId
    || (metadata.sourceCardId !== cardId && metadata.ownerCardId !== cardId)) {
    return { ok: false, statusCode: 409, error: 'Card execution is no longer active.', runId, executionId };
  }
  if (metadata.pipelineRunId) {
    return cancelCodexPipelineRunController({
      action_payload: { runId: metadata.pipelineRunId, executionId },
      runtime_state: runtime,
    });
  }
  const result = await cancelTaskExecution({ runtime, executionId });
  return {
    ...result,
    status: result.phase === 'cancelled' ? 'cancelled' : result.phase === 'cancelling' ? 'running' : result.phase,
    runId,
  };
}
