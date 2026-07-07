/**
 * WHAT: Polls one rendered Codex run widget while its backend run is active.
 * WHY: The widget needs live JSONL-derived progress without storing a separate run model.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestCardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';
import { requestCardSkillRunCancel } from './request-card-skill-run-cancel.js';
import { requestCardSkillRunContinue } from './request-card-skill-run-continue.js';

type Poller = {
  ledgerId: string;
  cardId: string;
  runId: string;
  element: HTMLElement;
  since: number;
  startedAtMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  clock: ClockHandle | null;
  lastClockPaintMs: number;
  inFlight: boolean;
  cancelInFlight: boolean;
  continueInFlight: boolean;
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

function timestampMs(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function setText(element: HTMLElement, selector: string, text: string): void {
  const target = element.querySelector(selector);
  if (target) target.textContent = text;
}

function removeTimer(element: HTMLElement): void {
  const timer = element.querySelector<HTMLElement>('[data-codex-run-timer]');
  if (timer) timer.hidden = true;
}

function showTimer(element: HTMLElement): void {
  const timer = element.querySelector<HTMLElement>('[data-codex-run-timer]');
  if (timer) timer.hidden = false;
}

function cancelButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('[data-codex-run-cancel]');
}

function continueButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('[data-codex-run-continue]');
}

function setCancelButtonVisible(element: HTMLElement, visible: boolean): void {
  const button = cancelButton(element);
  if (button) button.hidden = !visible;
}

function setContinueButtonVisible(element: HTMLElement, visible: boolean): void {
  const button = continueButton(element);
  if (button) button.hidden = !visible;
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
  if (summary.status === 'running') {
    showTimer(element);
    setCancelButtonVisible(element, true);
    setContinueButtonVisible(element, false);
  } else {
    removeTimer(element);
    setCancelButtonVisible(element, false);
    setContinueButtonVisible(element, summary.status !== 'unknown');
  }
  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
}

function paintFrontendClock(poller: Poller): void {
  if (poller.terminal) return;
  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - poller.startedAtMs));
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

function setContinueButtonState(button: HTMLButtonElement, state: 'ready' | 'starting'): void {
  button.disabled = state === 'starting';
  button.textContent = state === 'starting' ? 'Continuing' : 'Continue';
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

function bindContinueButton(poller: Poller): void {
  const button = continueButton(poller.element);
  if (!button) return;
  button.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    void continueRun(poller);
  };
  setContinueButtonState(button, poller.continueInFlight ? 'starting' : 'ready');
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

async function continueRun(poller: Poller): Promise<void> {
  if (poller.continueInFlight || poller.inFlight) return;
  const button = continueButton(poller.element);
  if (!button) return;
  const key = pollerKey(poller);
  const previousSummary = terminalSummaries.get(key);
  poller.continueInFlight = true;
  poller.terminal = false;
  poller.since = 0;
  poller.detachedChecks = 0;
  poller.startedAtMs = Date.now();
  terminalSummaries.delete(key);
  pollers.set(key, poller);
  setContinueButtonState(button, 'starting');
  poller.element.dataset.runStatus = 'running';
  setText(poller.element, '[data-codex-run-status]', 'RUNNING');
  setText(poller.element, '[data-codex-run-latest]', 'Continuing session');
  setCancelButtonVisible(poller.element, true);
  setContinueButtonVisible(poller.element, false);
  const cancel = cancelButton(poller.element);
  if (cancel) setCancelButtonState(cancel, 'ready');
  showTimer(poller.element);
  startFrontendClock(poller);
  const result = await requestCardSkillRunContinue({ ledgerId: poller.ledgerId, cardId: poller.cardId, runId: poller.runId });
  poller.continueInFlight = false;
  if (!result.ok) {
    poller.terminal = Boolean(previousSummary);
    stopPoller(key);
    if (previousSummary) {
      terminalSummaries.set(key, previousSummary);
      paintWidget(poller.element, previousSummary);
    } else {
      poller.element.dataset.runStatus = 'unknown';
      removeTimer(poller.element);
      setCancelButtonVisible(poller.element, false);
      setContinueButtonVisible(poller.element, true);
      setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
    }
    const restoredButton = continueButton(poller.element);
    if (restoredButton) setContinueButtonState(restoredButton, 'ready');
    setText(poller.element, '[data-codex-run-latest]', result.error || 'Continue failed');
    return;
  }
  const startedAt = timestampMs(result.run?.startedAt) || timestampMs(result.run?.continuedAt);
  if (startedAt) poller.startedAtMs = startedAt;
  pollers.set(key, poller);
  setContinueButtonState(button, 'ready');
  startFrontendClock(poller);
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
    setCancelButtonVisible(poller.element, false);
    setContinueButtonVisible(poller.element, false);
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
    poller.continueInFlight = false;
    const button = continueButton(poller.element);
    if (button) setContinueButtonState(button, 'ready');
    terminalSummaries.set(key, summary);
    stopPoller(key);
  }
}

export function bindCardSkillRunWidget(input: { ledgerId: string; cardId: string; runId: string; element: HTMLElement }): void {
  const key = pollerKey(input);
  const terminalSummary = terminalSummaries.get(key);
  if (terminalSummary) {
    const poller: Poller = { ...input, since: terminalSummary.lineCount, startedAtMs: runStartedAt(input.runId), timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, cancelInFlight: false, continueInFlight: false, detachedChecks: 0, terminal: true };
    paintWidget(input.element, terminalSummary);
    bindCancelButton(poller);
    bindContinueButton(poller);
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
    bindContinueButton(existing);
    startFrontendClock(existing);
    if (!existing.timer && !existing.inFlight) schedulePoll(existing, 0);
    return;
  }
  const poller: Poller = { ...input, since: 0, startedAtMs: runStartedAt(input.runId), timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, cancelInFlight: false, continueInFlight: false, detachedChecks: 0, terminal: false };
  pollers.set(key, poller);
  bindCancelButton(poller);
  bindContinueButton(poller);
  startFrontendClock(poller);
  schedulePoll(poller, 0);
}
