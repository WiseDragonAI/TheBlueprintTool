/**
 * WHAT: Connects one thread run to session-only log state through the shared run poller.
 * WHY: Log hydration must survive panel rerenders without creating another timer or ledger write.
 */
import { state } from '../../state.js';
import { codexRunDurationLabel, liveCodexRunElapsedMs } from '../helper/live-codex-run-elapsed-ms.js';
import { mergeThreadRunEvents, type ThreadRunLogEvent } from '../helper/thread-run-log.js';
import { bindCardSkillRunLogConsumer } from './poll-card-skill-run.js';
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';
import { syncThreadCodexRunControls } from '../../thread/effect/sync-thread-codex-run-controls.js';

function recordState(name: string): Record<string, any> {
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

type ThreadRunClock = {
  threadId: string;
  runId: string;
  sampledAtMs: number;
  sampledElapsedMs: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const threadRunClocks = new Map<string, ThreadRunClock>();

function stopThreadCodexRunClock(threadId: string): void {
  const clock = threadRunClocks.get(threadId);
  if (clock?.timer) clearTimeout(clock.timer);
  threadRunClocks.delete(threadId);
}

function paintThreadCodexRunClock(clock: ThreadRunClock): void {
  const summary = recordState('threadRunSummaryByThreadId')[clock.threadId] as CardSkillRunSummary | undefined;
  const activeRunId = String(recordState('threadRunIdByThreadId')[clock.threadId] ?? '');
  if (!summary || summary.status !== 'running' || activeRunId !== clock.runId) {
    stopThreadCodexRunClock(clock.threadId);
    return;
  }

  const nowMs = Date.now();
  const elapsedMs = Math.max(
    liveCodexRunElapsedMs(summary, nowMs),
    clock.sampledElapsedMs + Math.max(0, nowMs - clock.sampledAtMs),
  );
  if (String(state.threadId ?? '') === clock.threadId && typeof document !== 'undefined') {
    const panel = document.querySelector<HTMLElement>('.thread-panel');
    const status = document.querySelector<HTMLElement>('.thread-codex-log .codex-log-status');
    const elapsed = status?.querySelector<HTMLElement>('[data-codex-log-elapsed]');
    if (panel && !panel.hidden && status?.dataset.runId === clock.runId && elapsed) {
      const label = codexRunDurationLabel(elapsedMs);
      if (elapsed.textContent !== label) elapsed.textContent = label;
    }
  }

  if (clock.timer) return;
  const delayMs = Math.max(50, 1010 - (elapsedMs % 1000));
  clock.timer = setTimeout(() => {
    clock.timer = null;
    paintThreadCodexRunClock(clock);
  }, delayMs);
}

export function syncThreadCodexRunClock(input: { threadId: string; runId: string; summary: CardSkillRunSummary }): void {
  const existing = threadRunClocks.get(input.threadId);
  if (input.summary.status !== 'running') {
    stopThreadCodexRunClock(input.threadId);
    return;
  }
  if (existing && existing.runId !== input.runId) stopThreadCodexRunClock(input.threadId);
  const nowMs = Date.now();
  const activeClock = threadRunClocks.get(input.threadId);
  const carriedElapsedMs = activeClock
    ? activeClock.sampledElapsedMs + Math.max(0, nowMs - activeClock.sampledAtMs)
    : 0;
  const clock = activeClock ?? {
    threadId: input.threadId,
    runId: input.runId,
    sampledAtMs: nowMs,
    sampledElapsedMs: 0,
    timer: null,
  };
  clock.sampledElapsedMs = Math.max(carriedElapsedMs, liveCodexRunElapsedMs(input.summary, nowMs));
  clock.sampledAtMs = nowMs;
  threadRunClocks.set(input.threadId, clock);
  paintThreadCodexRunClock(clock);
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
  syncThreadCodexRunControls({
    threadId: input.threadId,
    running: input.summary.ok && input.summary.status === 'running',
  });
  void import('../../thread/effect/render-thread-codex-log.js').then(({ renderThreadCodexLog }) => renderThreadCodexLog());
}

export function bindThreadCodexRunLog(input: { ledgerId: string; cardId: string; threadId: string; runId: string }): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  prepareThreadRun(input.threadId, input.runId);
  const currentSummary = recordState('threadRunSummaryByThreadId')[input.threadId] as CardSkillRunSummary | undefined;
  if (currentSummary) syncThreadCodexRunClock({ threadId: input.threadId, runId: input.runId, summary: currentSummary });
  bindCardSkillRunLogConsumer({
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    consumerId: `thread-log:${input.threadId}`,
    onSummary: (summary) => consumeThreadRunSummary({ threadId: input.threadId, runId: input.runId, summary }),
  });
}
