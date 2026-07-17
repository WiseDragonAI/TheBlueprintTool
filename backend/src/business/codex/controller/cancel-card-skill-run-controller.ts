/**
 * WHAT: Cancels one active card-scoped Codex skill run.
 * WHY: The canvas widget needs a direct stop control for the server-owned child process.
 */
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { cancelCodexPipelineRunController } from './cancel-codex-pipeline-run-controller.js';
import { isSameCodexProcess, readCodexProcessQueue, removeCodexProcessQueueItem, type CodexProcessQueueItem } from '../helper/codex-process-queue.js';
import { clearCardCodexExecutionForLedger } from '../helper/clear-card-codex-execution.js';

type AnyRecord = Record<string, unknown>;

function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  return runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
}

function publicRun(run: AnyRecord): AnyRecord {
  const { child: _child, ...rest } = run;
  return rest;
}

function signalPersistedProcess(item: CodexProcessQueueItem | undefined): boolean {
  if (!item || item.status !== 'running' || !isSameCodexProcess(item.processId, item.processStartTime)) return false;
  try {
    process.kill(process.platform === 'win32' ? item.processId : -item.processId, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

export async function cancelCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };

  const run = runtimeRuns(runtime)[runId];
  if (!run || String(run.ledgerId ?? '') !== ledgerId || String(run.outputCardId ?? '') !== cardId) {
    return { ok: false, statusCode: 404, error: 'Active run not found.', runId };
  }
  const queued = readCodexProcessQueue(decisionOsRoot).find((item) => item.id === runId || String(item.payload.runId ?? '') === runId);
  if (String(run.status ?? '') === 'pending') {
    if (queued) removeCodexProcessQueueItem(decisionOsRoot, queued.id);
    Object.assign(run, { status: 'cancelled', finishedAt: new Date().toISOString() });
    clearCardCodexExecutionForLedger({ decisionOsRoot, ledgerId, cardId, runId, runtime });
    return { ok: true, statusCode: 202, status: 'cancelled', run: publicRun(run) };
  }
  if (String(run.status ?? '') !== 'running') {
    return { ok: true, statusCode: 200, status: String(run.status ?? 'unknown'), run: publicRun(run) };
  }
  const pipelineRunId = String(run.pipelineRunId ?? '').trim();
  if (pipelineRunId) {
    return cancelCodexPipelineRunController({ action_payload: { runId: pipelineRunId }, runtime_state: runtime });
  }

  const child = (run as { child?: ChildProcess }).child;
  const finishedAt = new Date().toISOString();
  let killed = false;
  let persistedProcessWasSignalled = false;
  if (child && typeof child.kill === 'function' && !child.killed) {
    try {
      killed = child.kill('SIGTERM');
    } catch {
      killed = false;
    }
  }
  if (!killed) {
    persistedProcessWasSignalled = signalPersistedProcess(queued);
    killed = persistedProcessWasSignalled;
  }
  if (!killed) return { ok: false, statusCode: 409, error: 'Run could not be cancelled from its live process identity.', runId };

  Object.assign(run, { status: 'cancelled', cancelRequestedAt: finishedAt, finishedAt });
  if (persistedProcessWasSignalled && queued) {
    removeCodexProcessQueueItem(decisionOsRoot, queued.id);
    clearCardCodexExecutionForLedger({ decisionOsRoot, ledgerId, cardId, runId, runtime });
  }
  return { ok: true, statusCode: 202, status: 'cancelled', run: publicRun(run) };
}
