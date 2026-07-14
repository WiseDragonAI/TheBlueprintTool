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
  reassessPipelineAfterSkill,
  scheduleCodexPipelineRuns,
} from '../helper/codex-pipeline-runner.js';
import { readCodexPipelineRunController } from './read-codex-pipeline-run-controller.js';

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
  if (!runId) return { ok: false, statusCode: 400, error: 'Missing pipeline run id.' };
  const store = readCodexPipelineStore({ decisionOsRoot }).store;
  const run = store.runs.find((entry) => entry.id === runId);
  if (!run) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId };
  if (run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled') {
    return readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
  }
  const running = run.steps.flatMap((step) => step.skills).find((skill) => skill.status === 'running');
  const target = running ?? run.steps.flatMap((step) => step.skills).find((skill) => skill.status === 'pending');
  if (!target) return { ok: false, statusCode: 409, error: 'Pipeline run has no cancellable skill.', runId };
  const runtimeRun = pipelineRuntimeRun(runtime, target.runId);
  let childWasSignalled = false;
  if (runtimeRun) {
    runtimeRun.status = 'cancelled';
    runtimeRun.cancelRequestedAt = new Date().toISOString();
    const child = (runtimeRun as { child?: ChildProcess }).child;
    if (child && typeof child.kill === 'function' && !child.killed) {
      try {
        childWasSignalled = child.kill('SIGTERM');
      } catch {
        // Persisted cancellation remains authoritative if the process already exited.
      }
    }
  }
  if (target.stderrFile) {
    try {
      appendFileSync(target.stderrFile, 'Codex run cancelled: terminated by operator\n', 'utf8');
    } catch {
      // A missing log file does not prevent durable cancellation.
    }
  }
  const cancelled = reassessPipelineAfterSkill({
    decisionOsRoot,
    runtime,
    pipelineRunId: run.id,
    skillRunId: target.runId,
    settledStatus: 'cancelled',
    finishedAt: new Date().toISOString(),
  });
  if (!cancelled) return { ok: false, statusCode: 500, error: 'Pipeline cancellation could not be persisted.', runId };
  if (runtimeRun && childWasSignalled) {
    const waitStarted = Date.now();
    while (!runtimeRun.settledAt && Date.now() - waitStarted < 2000) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
  }
  const schedule = runtime.scheduleCodexProcesses;
  if (typeof schedule === 'function') void schedule();
  else scheduleCodexPipelineRuns({ decisionOsRoot, runtime });
  if (typeof runtime.onPipelineLedgerChange === 'function') {
    (runtime.onPipelineLedgerChange as (event: AnyRecord) => void)({
      reason: 'pipeline-cancelled',
      ledgerId: cancelled.ledgerId,
      pipelineRunId: cancelled.id,
      runId: target.runId,
      cardId: cancelled.steps.find((step) => step.skills.some((skill) => skill.runId === target.runId))?.outputCardId ?? '',
    });
  }
  const detail = await readCodexPipelineRunController({ action_payload: { runId }, runtime_state: runtime });
  return { ...detail, status: 'cancelled', statusCode: 202 };
}
