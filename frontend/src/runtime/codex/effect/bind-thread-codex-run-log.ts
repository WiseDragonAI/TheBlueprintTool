/**
 * WHAT: Connects one thread run to session-only log state through the shared run poller.
 * WHY: Log hydration must survive panel rerenders without creating another timer or ledger write.
 */
import { state } from '../../state.js';
import { mergeThreadRunEvents, type ThreadRunLogEvent } from '../helper/thread-run-log.js';
import { bindCardSkillRunLogConsumer } from './poll-card-skill-run.js';
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';

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
  const launchButton = document.querySelector('.thread-codex-button') as HTMLButtonElement | null;
  if (launchButton?.dataset.threadId === input.threadId) launchButton.disabled = input.summary.ok && input.summary.status === 'running';
  void import('../../thread/effect/render-thread-codex-log.js').then(({ renderThreadCodexLog }) => renderThreadCodexLog());
}

export function bindThreadCodexRunLog(input: { ledgerId: string; cardId: string; threadId: string; runId: string }): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  prepareThreadRun(input.threadId, input.runId);
  bindCardSkillRunLogConsumer({
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    consumerId: `thread-log:${input.threadId}`,
    onSummary: (summary) => consumeThreadRunSummary({ threadId: input.threadId, runId: input.runId, summary }),
  });
}
