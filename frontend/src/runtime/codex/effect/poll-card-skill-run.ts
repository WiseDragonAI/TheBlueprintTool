/**
 * WHAT: Polls one rendered Codex run widget while its backend run is active.
 * WHY: The widget needs live JSONL-derived progress without storing a separate run model.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestCardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';
import { requestCardSkillRunCancel } from './request-card-skill-run-cancel.js';

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
  cancelInFlight: boolean;
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
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

function removeTimer(element: HTMLElement): void {
  element.querySelector('[data-codex-run-timer]')?.remove();
}

function cancelButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('[data-codex-run-cancel]');
}

function removeCancelButton(element: HTMLElement): void {
  cancelButton(element)?.remove();
}

function latestEventLabel(summary: CardSkillRunSummary): string {
  const latest = summary.latestEvent;
  if (summary.status === 'cancelled') return `Run Cancelled in ${durationLabel(summary.elapsedMs)}`;
  if (!latest) return summary.status === 'running' ? 'Waiting for output' : statusLabel(summary.status);
  if (summary.status === 'complete' && latest.title.toLowerCase() === 'turn completed') return `Turn Completed in ${durationLabel(summary.elapsedMs)}`;
  if (latest.tool) return latest.tool;
  return latest.title || latest.kind || latest.type || statusLabel(summary.status);
}

function paintWidget(element: HTMLElement, summary: CardSkillRunSummary): void {
  element.dataset.runStatus = summary.status;
  setText(element, '[data-codex-run-status]', statusLabel(summary.status));
  if (summary.status !== 'running') {
    removeTimer(element);
    removeCancelButton(element);
  }
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

function setCancelButtonState(button: HTMLButtonElement, state: 'ready' | 'stopping'): void {
  button.disabled = state === 'stopping';
  button.textContent = state === 'stopping' ? 'Stopping' : 'Cancel';
}

function bindCancelButton(poller: Poller): void {
  const button = cancelButton(poller.element);
  if (!button) return;
  button.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    void cancelRun(poller);
  };
  setCancelButtonState(button, poller.cancelInFlight ? 'stopping' : 'ready');
}

async function cancelRun(poller: Poller): Promise<void> {
  if (poller.terminal || poller.cancelInFlight) return;
  const button = cancelButton(poller.element);
  if (!button) return;
  poller.cancelInFlight = true;
  setCancelButtonState(button, 'stopping');
  setText(poller.element, '[data-codex-run-latest]', 'Cancelling run');
  const result = await requestCardSkillRunCancel({ ledgerId: poller.ledgerId, cardId: poller.cardId, runId: poller.runId });
  poller.cancelInFlight = false;
  if (!result.ok) {
    setCancelButtonState(button, 'ready');
    setText(poller.element, '[data-codex-run-latest]', result.error || 'Cancel failed');
    return;
  }
  setCancelButtonState(button, 'stopping');
  schedulePoll(poller, 0);
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
    removeTimer(poller.element);
    removeCancelButton(poller.element);
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
    bindCancelButton(existing);
    startFrontendClock(existing);
    if (!existing.timer && !existing.inFlight) schedulePoll(existing, 0);
    return;
  }
  const poller: Poller = { ...input, since: 0, timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, cancelInFlight: false, detachedChecks: 0, terminal: false };
  pollers.set(key, poller);
  bindCancelButton(poller);
  startFrontendClock(poller);
  schedulePoll(poller, 0);
}
