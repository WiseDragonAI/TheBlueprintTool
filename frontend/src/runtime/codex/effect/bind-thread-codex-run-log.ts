/**
 * WHAT: Connects one thread run to session-only log state through the shared run poller.
 * WHY: Log hydration must survive panel rerenders without creating another timer or ledger write.
 */
import { state } from '../../state.js';
import { mergeThreadRunEvents, type ThreadRunLogEvent } from '../helper/thread-run-log.js';
import { bindCardSkillRunLogConsumer, unbindCardSkillRunLogConsumer } from './poll-card-skill-run.js';
import { projectIdFromLocation, replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';
import { syncThreadCodexRunControls } from '../../thread/effect/sync-thread-codex-run-controls.js';
import { stopThreadCodexRunClock, syncThreadCodexRunClock } from './sync-thread-codex-run-clock.js';

export { syncThreadCodexRunClock } from './sync-thread-codex-run-clock.js';

function recordState(name: string): Record<string, any> {
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function updateAnnouncement(threadId: string, summary: CardSkillRunSummary, changedEvents: ThreadRunLogEvent[]): void {
  const announcements = recordState('threadRunAnnouncementByThreadId');
  const previous = announcements[threadId] as { sequence?: number } | undefined;
  const latest = changedEvents.at(-1);
  let text = latest?.title || latest?.tool || latest?.kind || '';
  if (latest?.kind === 'tool_call' && latest.status) text = `${latest.title || latest.tool || 'Tool'}: ${latest.status}`;
  if (!text && !summary.ok) text = summary.error || 'Codex run unavailable.';
  if (!text && summary.status !== 'running') text = `Codex run ${summary.status}.`;
  if (!text) return;
  announcements[threadId] = { sequence: Number(previous?.sequence ?? 0) + 1, text };
}

function prepareThreadRun(threadId: string, runId: string): void {
  const runIds = recordState('threadRunIdByThreadId');
  const previousRunId = String(runIds[threadId] ?? '');
  if (previousRunId !== runId) {
    stopThreadCodexRunClock(threadId);
    recordState('threadRunEventsByThreadId')[threadId] = [];
    recordState('threadCoalescedToolsByThreadId')[threadId] = {};
    delete recordState('threadRunSummaryByThreadId')[threadId];
    recordState('threadToolGroupDisclosureByThreadId')[threadId] = {};
    recordState('threadToolRowDisclosureByThreadId')[threadId] = {};
  }
  runIds[threadId] = runId;
}

function consumeThreadRunSummary(input: { threadId: string; runId: string; summary: CardSkillRunSummary }): void {
  const runIds = recordState('threadRunIdByThreadId');
  const summaries = recordState('threadRunSummaryByThreadId');
  const eventsByThread = recordState('threadRunEventsByThreadId');
  const toolsByThread = recordState('threadCoalescedToolsByThreadId');
  const previousRunId = String(runIds[input.threadId] ?? '');
  if (previousRunId && previousRunId !== input.runId) return;
  const previousSummary = summaries[input.threadId] as CardSkillRunSummary | undefined;
  runIds[input.threadId] = input.runId;
  summaries[input.threadId] = input.summary;
  recordState('threadRunExecutionsByRunId')[input.runId] = input.summary.executions;
  syncThreadCodexRunClock(input);

  const previousEvents = Array.isArray(eventsByThread[input.threadId]) ? eventsByThread[input.threadId] as ThreadRunLogEvent[] : [];
  const merged = mergeThreadRunEvents(previousEvents, [...input.summary.events, ...input.summary.diagnostics], input.runId);
  eventsByThread[input.threadId] = merged.events;
  toolsByThread[input.threadId] = merged.tools;
  const changed = merged.changedEventKeys
    .map((key) => merged.events.find((event) => event.eventKey === key))
    .filter((event): event is ThreadRunLogEvent => Boolean(event));
  const summaryStateChanged = previousSummary?.status !== input.summary.status
    || previousSummary?.error !== input.summary.error;
  if (changed.length > 0 || summaryStateChanged) {
    updateAnnouncement(input.threadId, input.summary, changed);
  }

  if (String(state.threadId ?? '') !== input.threadId || typeof document === 'undefined') return;
  if (!String(recordState('threadActiveRunIdByThreadId')[input.threadId] ?? '')) syncThreadCodexRunControls({
      threadId: input.threadId,
      status: input.summary.ok ? input.summary.status : 'unknown',
      active: input.summary.ok ? input.summary.active : false,
      queuePosition: input.summary.queuePosition,
    });
  void import('../../thread/effect/render-thread-codex-log-update.js').then(({ renderThreadCodexLogUpdate }) => renderThreadCodexLogUpdate());
}

type ThreadCodexRunLogIdentity = {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId: string;
  cardId: string;
  threadId: string;
  runId: string;
  expectedExecutionId?: string;
  expectedStatus?: CardSkillRunSummary['status'];
  forceRevalidate?: boolean;
};

export function bindThreadCodexRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  const projectId = input.projectId ?? projectIdFromLocation();
  const replicaNodeId = input.replicaNodeId ?? replicaNodeIdFromLocation();
  const previousRunId = String(recordState('threadRunIdByThreadId')[input.threadId] ?? '');
  if (previousRunId && previousRunId !== input.runId) {
    unbindCardSkillRunLogConsumer({
      projectId,
      replicaNodeId,
      ledgerId: input.ledgerId,
      cardId: input.cardId,
      runId: previousRunId,
      consumerId: `thread-log:${input.threadId}`,
    });
  }
  prepareThreadRun(input.threadId, input.runId);
  const currentSummary = recordState('threadRunSummaryByThreadId')[input.threadId] as CardSkillRunSummary | undefined;
  if (currentSummary) syncThreadCodexRunClock({ threadId: input.threadId, runId: input.runId, summary: currentSummary });
  bindCardSkillRunLogConsumer({
    projectId,
    replicaNodeId,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    expectedExecutionId: input.expectedExecutionId,
    expectedStatus: input.expectedStatus,
    forceRevalidate: input.forceRevalidate,
    consumerId: `thread-log:${input.threadId}`,
    onSummary: (summary) => consumeThreadRunSummary({ threadId: input.threadId, runId: input.runId, summary }),
  });
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
  void import('../../thread/effect/render-thread-codex-log-update.js').then(({ renderThreadCodexLogUpdate }) => renderThreadCodexLogUpdate());
}

export function bindThreadCodexActiveRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  const projectId = input.projectId ?? projectIdFromLocation();
  const replicaNodeId = input.replicaNodeId ?? replicaNodeIdFromLocation();
  const activeRunIds = recordState('threadActiveRunIdByThreadId');
  const previousRunId = String(activeRunIds[input.threadId] ?? '');
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
  if (String(recordState('threadActiveRunIdByThreadId')[input.threadId] ?? '') === input.runId) {
    delete recordState('threadActiveRunIdByThreadId')[input.threadId];
    delete recordState('threadActiveRunSummaryByThreadId')[input.threadId];
  }
}

export function unbindThreadCodexRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  stopThreadCodexRunClock(input.threadId);
  unbindCardSkillRunLogConsumer({
    projectId: input.projectId ?? projectIdFromLocation(),
    replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation(),
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    consumerId: `thread-log:${input.threadId}`,
  });
}
