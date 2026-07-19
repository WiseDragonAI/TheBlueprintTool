/**
 * WHAT: Owns the session-only live elapsed-time clock for one thread Codex run.
 * WHY: Poller binding should merge run data while this effect handles timer lifecycle and targeted DOM repainting.
 */
import { state } from '../../state.js';
import { codexRunDurationLabel, liveCodexRunElapsedMs } from '../helper/live-codex-run-elapsed-ms.js';
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';

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

export function stopThreadCodexRunClock(threadId: string): void {
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
    const selectedExecutionId = String(recordState('threadSelectedExecutionIdByThreadId')[clock.threadId] ?? '');
    if (panel && !panel.hidden && status?.dataset.runId === clock.runId && (!selectedExecutionId || selectedExecutionId === summary.executionId) && elapsed) {
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
