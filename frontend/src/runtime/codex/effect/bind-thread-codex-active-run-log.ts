/**
 * WHAT: Binds the legacy session summary used by active Codex mutation controls.
 * WHY: Continue, cancel, and delete still have session semantics while log presentation is execution-addressed.
 */
import { state } from '../../state.js';
import { projectIdFromLocation, replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import { syncThreadCodexRunControls } from '../../thread/effect/sync-thread-codex-run-controls.js';
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';
import { bindCardSkillRunLogConsumer, unbindCardSkillRunLogConsumer } from './poll-card-skill-run.js';
import type { ThreadCodexRunLogIdentity } from './thread-codex-run-log-identity-types.js';

function recordState(name: string): Record<string, any> {
  // WHAT: Repair active-session state maps when restoring an older browser session.
  // WHY: Compatibility controls must tolerate state captured before the presentation cutover.
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function paintThreadLog(threadId: string): void {
  if (String(state.threadId ?? '') !== threadId || typeof document === 'undefined') return;
  void import('../../thread/effect/render-thread-codex-log-update.js')
    .then(({ renderThreadCodexLogUpdate }) => renderThreadCodexLogUpdate())
    .catch(() => undefined);
}

function consumeActiveRunSummary(input: { threadId: string; runId: string; summary: CardSkillRunSummary }): void {
  if (String(recordState('threadActiveRunIdByThreadId')[input.threadId] ?? '') !== input.runId) return;
  recordState('threadActiveRunSummaryByThreadId')[input.threadId] = input.summary;
  if (String(state.threadId ?? '') !== input.threadId || typeof document === 'undefined') return;
  syncThreadCodexRunControls({
    threadId: input.threadId,
    status: input.summary.ok ? input.summary.status : 'unknown',
    active: input.summary.ok ? input.summary.active : false,
    queuePosition: input.summary.queuePosition,
  });
  paintThreadLog(input.threadId);
}

export function bindThreadCodexActiveRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  const projectId = input.projectId ?? projectIdFromLocation();
  const replicaNodeId = input.replicaNodeId ?? replicaNodeIdFromLocation();
  const activeRunIds = recordState('threadActiveRunIdByThreadId');
  const previousRunId = String(activeRunIds[input.threadId] ?? '');
  // WHAT: Release the previous session consumer before binding a replacement.
  // WHY: One thread must not retain mutation state from two active sessions.
  if (previousRunId && previousRunId !== input.runId) unbindCardSkillRunLogConsumer({
    projectId,
    replicaNodeId,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: previousRunId,
    consumerId: `thread-active:${input.threadId}`,
  });
  activeRunIds[input.threadId] = input.runId;
  bindCardSkillRunLogConsumer({
    projectId,
    replicaNodeId,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    expectedExecutionId: input.expectedExecutionId,
    expectedStatus: input.expectedStatus,
    forceRevalidate: input.forceRevalidate,
    consumerId: `thread-active:${input.threadId}`,
    onSummary: (summary) => consumeActiveRunSummary({ threadId: input.threadId, runId: input.runId, summary }),
  });
}

export function unbindThreadCodexActiveRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  unbindCardSkillRunLogConsumer({
    projectId: input.projectId ?? projectIdFromLocation(),
    replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation(),
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    consumerId: `thread-active:${input.threadId}`,
  });
  // WHAT: Clear compatibility state only when this unbind owns the selected active session.
  // WHY: A stale cleanup must not erase a newer session binding.
  if (String(recordState('threadActiveRunIdByThreadId')[input.threadId] ?? '') === input.runId) {
    delete recordState('threadActiveRunIdByThreadId')[input.threadId];
    delete recordState('threadActiveRunSummaryByThreadId')[input.threadId];
  }
}
