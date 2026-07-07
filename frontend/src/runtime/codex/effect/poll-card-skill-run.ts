/**
 * WHAT: Polls one rendered Codex run widget while its backend run is active.
 * WHY: The widget needs live JSONL-derived progress without storing a separate run model.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestCardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';

type Poller = {
  ledgerId: string;
  cardId: string;
  runId: string;
  element: HTMLElement;
  since: number;
  timer: ReturnType<typeof setTimeout> | null;
  clock: ClockHandle | null;
  lastClockPaintMs: number;
  inFlight: boolean;
  detachedChecks: number;
  terminal: boolean;
};

type ClockHandle =
  | { kind: 'animation'; id: number }
  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

const pollers = new Map<string, Poller>();
const terminalSummaries = new Map<string, CardSkillRunSummary>();

function pollerKey(input: { ledgerId: string; cardId: string; runId: string }): string {
  return `${input.ledgerId}:${input.cardId}:${input.runId}`;
}

function statusLabel(status: string): string {
  return status ? status.toUpperCase() : 'UNKNOWN';
}

function durationLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function runStartedAt(runId: string): number {
  const match = runId.match(/^codex-skill-(\d+)-/);
  const timestamp = Number(match?.[1] ?? 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function setText(element: HTMLElement, selector: string, text: string): void {
  const target = element.querySelector(selector);
  if (target) target.textContent = text;
}

function latestEventLabel(summary: CardSkillRunSummary): string {
  const latest = summary.latestEvent;
  if (!latest) return summary.status === 'running' ? 'Waiting for output' : statusLabel(summary.status);
  if (summary.status === 'complete' && latest.title.toLowerCase() === 'turn completed') return `Turn completed in ${durationLabel(summary.elapsedMs)}`;
  if (latest.tool) return latest.tool;
  return latest.title || latest.kind || latest.type || statusLabel(summary.status);
}

function paintWidget(element: HTMLElement, summary: CardSkillRunSummary): void {
  element.dataset.runStatus = summary.status;
  setText(element, '[data-codex-run-status]', statusLabel(summary.status));
  if (summary.status !== 'running') setText(element, '[data-codex-run-timer]', durationLabel(summary.elapsedMs));
  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
}

function paintFrontendClock(poller: Poller): void {
  if (poller.terminal) return;
  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - runStartedAt(poller.runId)));
}

function scheduleClockFrame(poller: Poller): void {
  if (poller.clock || poller.terminal) return;
  const tick = (): void => {
    poller.clock = null;
    if (poller.terminal) return;
    if (!globalThis.document?.contains(poller.element)) return;
    const now = Date.now();
    if (now - poller.lastClockPaintMs >= 33) {
      poller.lastClockPaintMs = now;
      paintFrontendClock(poller);
    }
    scheduleClockFrame(poller);
  };
  if (typeof globalThis.requestAnimationFrame === 'function') {
    poller.clock = { kind: 'animation', id: globalThis.requestAnimationFrame(tick) };
  } else {
    poller.clock = { kind: 'timeout', id: setTimeout(tick, 33) };
  }
}

function startFrontendClock(poller: Poller): void {
  paintFrontendClock(poller);
  scheduleClockFrame(poller);
}

function schedulePoll(poller: Poller, delayMs = 1000): void {
  if (poller.timer) clearTimeout(poller.timer);
  poller.timer = setTimeout(() => void poll(poller), delayMs);
}

function stopPoller(key: string): void {
  const poller = pollers.get(key);
  if (!poller) return;
  if (poller.timer) clearTimeout(poller.timer);
  if (poller.clock?.kind === 'animation') globalThis.cancelAnimationFrame?.(poller.clock.id);
  if (poller.clock?.kind === 'timeout') clearTimeout(poller.clock.id);
  poller.clock = null;
  pollers.delete(key);
}

async function poll(poller: Poller): Promise<void> {
  const key = pollerKey(poller);
  if (!globalThis.document?.contains(poller.element)) {
    poller.detachedChecks += 1;
    if (poller.detachedChecks < 4) schedulePoll(poller, 250);
    else stopPoller(key);
    return;
  }
  poller.detachedChecks = 0;
  startFrontendClock(poller);
  if (poller.inFlight) {
    schedulePoll(poller);
    return;
  }
  poller.inFlight = true;
  const summary = await requestCardSkillRunStatus({
    ledgerId: poller.ledgerId,
    cardId: poller.cardId,
    runId: poller.runId,
    since: poller.since
  });
  poller.inFlight = false;
  if (!summary.ok) {
    poller.element.dataset.runStatus = 'unknown';
    setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
    setText(poller.element, '[data-codex-run-latest]', summary.error || 'Run unavailable');
    stopPoller(key);
    return;
  }
  poller.since = Math.max(poller.since, summary.nextSince, summary.lineCount);
  paintWidget(poller.element, summary);
  telemetry('codex-skill-run-polled', { runId: poller.runId, status: summary.status, lineCount: summary.lineCount });
  if (summary.status === 'running') schedulePoll(poller);
  else {
    poller.terminal = true;
    terminalSummaries.set(key, summary);
    stopPoller(key);
  }
}

export function bindCardSkillRunWidget(input: { ledgerId: string; cardId: string; runId: string; element: HTMLElement }): void {
  const key = pollerKey(input);
  const terminalSummary = terminalSummaries.get(key);
  if (terminalSummary) {
    paintWidget(input.element, terminalSummary);
    return;
  }
  const existing = pollers.get(key);
  if (existing) {
    existing.element = input.element;
    existing.ledgerId = input.ledgerId;
    existing.cardId = input.cardId;
    existing.runId = input.runId;
    existing.terminal = false;
    startFrontendClock(existing);
    if (!existing.timer && !existing.inFlight) schedulePoll(existing, 0);
    return;
  }
  const poller: Poller = { ...input, since: 0, timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, detachedChecks: 0, terminal: false };
  pollers.set(key, poller);
  startFrontendClock(poller);
  schedulePoll(poller, 0);
}
