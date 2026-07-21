/**
 * WHAT: Cancels one active card-scoped Codex skill run.
 * WHY: The canvas widget needs a direct stop control for the server-owned child process.
 */
import type { ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cancelCodexPipelineRunController } from './cancel-codex-pipeline-run-controller.js';
import { isSameCodexProcess, readCodexProcessQueue, removeCodexProcessQueueItem, type CodexProcessQueueItem } from '../helper/codex-process-queue.js';
import { clearCardCodexExecutionForLedger } from '../helper/clear-card-codex-execution.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { signalCodexProcessTree } from '../helper/reconcile-terminal-codex-process.js';
import { codexRuntimeRuns, notifyCodexLifecycle, publicCodexRuntimeRun } from '../helper/codex-runtime-run-store.js';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { cardCodexExecutionOwnership } from '../helper/card-codex-execution-ownership.js';
import { readLedgerProjection } from '../../task-state/helper/read-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

function signalPersistedProcess(item: CodexProcessQueueItem | undefined): boolean {
  if (!item || item.status !== 'running' || !isSameCodexProcess(item.processId, item.processStartTime)) return false;
  return signalCodexProcessTree({ pid: item.processId, signal: 'SIGTERM' });
}

function cardOwnsExecution(input: { decisionOsRoot: string; ledgerId: string; cardId: string; runId: string; executionId: string; runtime: AnyRecord }): boolean {
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime,
  });
  const ledgerRef = String(state.ledgers.find((entry) => entry.id === input.ledgerId)?.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(input.decisionOsRoot, ledgerRef);
  if (!ledgerRef || !existsSync(ledgerPath)) return false;
  const ledger = readLedgerProjection({ ledgerId: input.ledgerId, ledgerPath, runtime: input.runtime }) as { cards?: AnyRecord[] };
  const ownership = cardCodexExecutionOwnership(ledger.cards?.find((card) => String(card.id ?? '') === input.cardId));
  return ownership.state === 'active'
    && ownership.lease.runId === input.runId
    && ownership.lease.executionId === input.executionId;
}

export async function cancelCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  const executionId = String(payload.executionId ?? '').trim();
  if (!ledgerId || !cardId || !runId || !executionId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, runId, or executionId.' };

  const pipelineStore = readCodexPipelineStore({ decisionOsRoot }).store;
  const pipeline = pipelineStore.runs.find((candidate) => candidate.ledgerId === ledgerId
    && (candidate.sourceCardId === cardId || candidate.steps.some((step) => step.outputCardId === cardId))
    && candidate.steps.some((step) => step.skills.some((skill) => skill.runId === runId && skill.executionId === executionId && (skill.status === 'pending' || skill.status === 'running'))));
  if (pipeline) {
    return cancelCodexPipelineRunController({ action_payload: { runId: pipeline.id, executionId }, runtime_state: runtime });
  }
  if (!cardOwnsExecution({ decisionOsRoot, ledgerId, cardId, runId, executionId, runtime })) {
    return { ok: false, statusCode: 409, error: 'Card execution is no longer active.', runId, executionId };
  }

  const run = codexRuntimeRuns(runtime)[runId];
  const queued = readCodexProcessQueue(decisionOsRoot).find((item) => String(item.payload.runId ?? item.id) === runId
    && String(item.payload.executionId ?? '') === executionId
    && String(item.payload.ledgerId ?? '') === ledgerId
    && String(item.payload.cardId ?? '') === cardId);
  if ((!run && !queued) || (run && (String(run.executionId ?? '') !== executionId || String(run.ledgerId ?? '') !== ledgerId || String(run.outputCardId ?? '') !== cardId))) {
    return { ok: false, statusCode: 404, error: 'Active run not found.', runId };
  }
  const status = String(run?.status ?? queued?.status ?? '');
  if (status === 'pending') {
    if (queued) removeCodexProcessQueueItem(decisionOsRoot, queued.id);
    const cancelled = run ?? { id: runId, executionId, ledgerId, outputCardId: cardId };
    const finishedAt = new Date().toISOString();
    Object.assign(cancelled, { status: 'cancelled', finishedAt, settledAt: finishedAt });
    await clearCardCodexExecutionForLedger({ decisionOsRoot, ledgerId, cardId, runId, executionId, runtime });
    notifyCodexLifecycle(runtime.onCodexRunSettled, { ledgerId, cardId, outputCardId: cardId, threadId: `thread-${cardId}`, runId, executionId, status: 'cancelled' });
    return { ok: true, statusCode: 202, status: 'cancelled', run: publicCodexRuntimeRun(cancelled) };
  }
  if (!run || status !== 'running') {
    return { ok: true, statusCode: 200, status: status || 'unknown', run: run ? publicCodexRuntimeRun(run) : { id: runId, executionId, status } };
  }

  const child = (run as { child?: ChildProcess }).child;
  const finishedAt = new Date().toISOString();
  let killed = false;
  let persistedProcessWasSignalled = false;
  if (child && typeof child.kill === 'function' && !child.killed) killed = signalCodexProcessTree({ child, signal: 'SIGTERM' });
  if (!killed) {
    persistedProcessWasSignalled = signalPersistedProcess(queued);
    killed = persistedProcessWasSignalled;
  }
  if (!killed) return { ok: false, statusCode: 409, error: 'Run could not be cancelled from its live process identity.', runId };

  Object.assign(run, { cancelRequestedAt: finishedAt });
  return { ok: true, statusCode: 202, status: 'running', cancellationRequested: true, run: publicCodexRuntimeRun(run) };
}
