/**
 * WHAT: Cancels the active skill and terminally releases one durable pipeline run.
 * WHY: Cancellation must stop downstream execution and free the workspace lock even after runtime state loss.
 */
import type { ChildProcess } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import {
  pipelineRuntimeRun,
  cancelPipelineDependents,
  reassessPipelineAfterSkill,
  scheduleCodexPipelineRuns,
} from '../helper/codex-pipeline-runner.js';
import { readCodexPipelineRunController } from './read-codex-pipeline-run-controller.js';
import { signalCodexProcessTree } from '../helper/reconcile-terminal-codex-process.js';
import { isSameCodexProcess } from '../helper/codex-process-queue.js';
import { scheduleCodexRuntime } from '../helper/codex-runtime-run-store.js';
import { codexExecutionCoordinator } from '../helper/codex-execution-runtime.js';
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
  const store = readCodexPipelineStore({ decisionOsRoot }).store;
  const run = store.runs.find((entry) => entry.id === runId);
  if (!run) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId };
  const replicatedState = taskExecutionState(runtime);
  const replicatedExecution = replicatedState?.executions.find(executionId) ?? null;
  if (replicatedState && replicatedExecution?.metadata.pipelineRunId === run.id) {
    const current = replicatedExecution.lifecycle.phase;
    if (current === 'succeeded' || current === 'failed' || current === 'cancelled' || current === 'interrupted') {
      return readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
    }
    const result = await cancelTaskExecution({ runtime, executionId });
    if (!result.ok) return { ...result, runId };
    if (result.phase === 'cancelled') {
      await cancelPipelineDependents({ runtime, pipelineRunId: run.id, executionId });
      const detail = await readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
      return { ...detail, status: 'cancelled', statusCode: 202, cancellationRequested: true };
    }
    return { ...result, status: 'running', runId, executionId };
  }
  if (run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled') {
    return readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
  }
  const running = run.steps.flatMap((step) => step.skills).find((skill) => skill.status === 'running');
  const target = running ?? run.steps.flatMap((step) => step.skills).find((skill) => skill.status === 'pending');
  if (!target) return { ok: false, statusCode: 409, error: 'Pipeline run has no cancellable skill.', runId };
  if (target.executionId !== executionId) return { ok: false, statusCode: 409, error: 'Pipeline execution is no longer active.', runId, executionId };
  const runtimeRun = pipelineRuntimeRun(runtime, target.runId);
  let childWasSignalled = false;
  if (runtimeRun) {
    runtimeRun.cancelRequestedAt = new Date().toISOString();
    const child = (runtimeRun as { child?: ChildProcess }).child;
    if (child && typeof child.kill === 'function' && !child.killed) childWasSignalled = signalCodexProcessTree({ child, signal: 'SIGTERM' });
  }
  if (!childWasSignalled && target.status === 'running' && isSameCodexProcess(Number(target.processId ?? 0), String(target.processStartTime ?? ''))) {
    childWasSignalled = signalCodexProcessTree({ pid: Number(target.processId ?? 0), signal: 'SIGTERM' });
  }
  if (target.status === 'running' && childWasSignalled) {
    return { ok: true, statusCode: 202, status: 'running', cancellationRequested: true, runId, executionId: target.executionId };
  }
  if (target.status === 'running' && !childWasSignalled) {
    return { ok: false, statusCode: 409, error: 'Pipeline run could not be cancelled from its live process identity.', runId, executionId: target.executionId };
  }
  if (target.stderrFile) {
    try {
      appendFileSync(target.stderrFile, 'Codex run cancelled: terminated by operator\n', 'utf8');
    } catch {
      // A missing log file does not prevent durable cancellation.
    }
  }
  const executionCoordinator = codexExecutionCoordinator(runtime);
  if (executionCoordinator) await executionCoordinator.cancel(target.executionId);
  const cancelled = reassessPipelineAfterSkill({
    decisionOsRoot,
    runtime,
    pipelineRunId: run.id,
    skillRunId: target.runId,
    settledStatus: 'cancelled',
    finishedAt: new Date().toISOString(),
  });
  if (!cancelled) return { ok: false, statusCode: 500, error: 'Pipeline cancellation could not be persisted.', runId };
  if (typeof runtime.scheduleCodexProcesses === 'function') scheduleCodexRuntime(runtime, 'schedule-after-pipeline-cancellation', { pipelineRunId: run.id, runId: target.runId });
  else await scheduleCodexPipelineRuns({ decisionOsRoot, runtime });
  if (typeof runtime.onPipelineLedgerChange === 'function') {
    (runtime.onPipelineLedgerChange as (event: AnyRecord) => void)({
      reason: 'pipeline-cancelled',
      ledgerId: cancelled.ledgerId,
      pipelineRunId: cancelled.id,
      runId: target.runId,
      executionId: target.executionId,
      status: 'cancelled',
      cardId: cancelled.steps.find((step) => step.skills.some((skill) => skill.runId === target.runId))?.outputCardId ?? '',
    });
  }
  const detail = await readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
  return { ...detail, status: 'cancelled', statusCode: 202 };
}
