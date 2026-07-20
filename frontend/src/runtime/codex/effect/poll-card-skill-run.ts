/**
 * WHAT: Polls one rendered Codex run widget while its backend run is active.
 * WHY: The widget needs live JSONL-derived progress without storing a separate run model.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { projectIdFromLocation, replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import { requestCardSkillRunStatus, type CardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';
import { requestCardSkillRunCancel } from './request-card-skill-run-cancel.js';
import { requestCardSkillRunContinue } from './request-card-skill-run-continue.js';
import { activeCardCodexRunPreference } from '../helper/card-codex-run-preference.js';
import {
  requestCodexPipelineRunCancel,
  requestCodexPipelineRunRestart,
  requestCodexPipelineRunStatus,
  type CodexPipelineRunSkillDetail,
  type CodexPipelineRunStatusResult,
  type CodexPipelineRunStepDetail,
} from './request-codex-pipeline-run-status.js';

type Poller = {
  projectId: string;
  replicaNodeId: string;
  ledgerId: string;
  cardId: string;
  runId: string;
  element: HTMLElement | null;
  consumers: Map<string, (summary: CardSkillRunSummary) => void>;
  historyEvents: CardSkillRunSummary['events'];
  lastSummary: CardSkillRunSummary | null;
  since: number;
  startedAtMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  clock: ClockHandle | null;
  lastClockPaintMs: number;
  inFlight: boolean;
  cancelInFlight: boolean;
  continueInFlight: boolean;
  continueTraceId: string;
  detachedChecks: number;
  terminal: boolean;
  generation: number;
  expectedExecutionId: string;
};

type ClockHandle =
  | { kind: 'animation'; id: number }
  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

const pollers = new Map<string, Poller>();
const terminalSummaries = new Map<string, CardSkillRunSummary>();
const runConsumers = new Map<string, Map<string, (summary: CardSkillRunSummary) => void>>();

type PipelineWidgetStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled' | 'unknown';

type PipelineStepPoller = {
  projectId: string;
  replicaNodeId: string;
  ledgerId: string;
  cardId: string;
  runId: string;
  pipelineRunId: string;
  pipelineStepId: string;
  element: HTMLElement;
  timer: ReturnType<typeof setTimeout> | null;
  clock: ClockHandle | null;
  lastClockPaintMs: number;
  startedAtMs: number;
  since: number;
  inFlight: boolean;
  cancelInFlight: boolean;
  restartInFlight: boolean;
  continueInFlight: boolean;
  detachedChecks: number;
  terminal: boolean;
  continuationMode: boolean;
  activeSkillRunId: string;
  continuationExecutionId: string;
  lastStatus: CodexPipelineRunStatusResult | null;
};

const pipelineStepPollers = new Map<string, PipelineStepPoller>();

function consumersFor(key: string): Map<string, (summary: CardSkillRunSummary) => void> {
  let consumers = runConsumers.get(key);
  if (!consumers) {
    consumers = new Map();
    runConsumers.set(key, consumers);
  }
  return consumers;
}

function isTerminalStatus(status: CardSkillRunSummary['status']): boolean {
  return status === 'complete' || status === 'failed' || status === 'cancelled';
}

function eventPhysicalKey(event: CardSkillRunSummary['events'][number]): string {
  return `${event.runId}:${event.source}:${event.sourceLine}`;
}

function accumulateRunEvents(poller: Poller, events: CardSkillRunSummary['events']): void {
  const known = new Map(poller.historyEvents.map((event, index) => [eventPhysicalKey(event), index]));
  for (const event of events) {
    const index = known.get(eventPhysicalKey(event));
    if (index === undefined) {
      known.set(eventPhysicalKey(event), poller.historyEvents.length);
      poller.historyEvents.push(event);
    } else {
      poller.historyEvents[index] = event;
    }
  }
}

function notifyConsumers(poller: Poller, summary: CardSkillRunSummary): void {
  for (const consumer of poller.consumers.values()) consumer(summary);
}

function continueTraceId(runId: string): string {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `continue-${runId}-${randomId}`;
}

function debugContinue(traceId: string, phase: string, detail: Record<string, unknown>): void {
  if (!traceId) return;
  const entry = { source: 'frontend', traceId, phase, at: new Date().toISOString(), ...detail };
  console.info('[codex-continue-debug]', entry);
  void fetch('/api/debug/codex-continue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => undefined);
}

type PollerIdentity = { projectId?: string; replicaNodeId?: string; ledgerId: string; cardId: string; runId: string };

function normalizedPollerIdentity(input: PollerIdentity): Required<PollerIdentity> {
  return { ...input, projectId: input.projectId ?? projectIdFromLocation(), replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation() };
}

function pollerKey(input: PollerIdentity): string {
  const identity = normalizedPollerIdentity(input);
  return JSON.stringify([identity.projectId, identity.replicaNodeId, identity.ledgerId, identity.cardId, identity.runId]);
}

function statusLabel(status: string): string {
  return status ? status.toUpperCase() : 'UNKNOWN';
}

function durationLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

function setSelectValue(element: HTMLElement, selector: string, value: string): void {
  const target = element.querySelector<HTMLSelectElement>(selector);
  if (target && value) target.value = value;
}

function setSelectValueIfUnset(element: HTMLElement, selector: string, value: string): void {
  const target = element.querySelector<HTMLSelectElement>(selector);
  if (target && value && !target.value) target.value = value;
}

function setSelectionEnabled(element: HTMLElement, enabled: boolean): void {
  const model = element.querySelector<HTMLSelectElement>('[data-codex-run-model]');
  const effort = element.querySelector<HTMLSelectElement>('[data-codex-run-effort]');
  if (model) model.disabled = !enabled;
  if (effort) effort.disabled = !enabled;
}

function setWidgetMetadata(element: HTMLElement, summary: CardSkillRunSummary): void {
  const metadata = element.querySelector<HTMLElement>('[data-codex-run-metadata]');
  if (!metadata) return;
  const source = summary.metadata.sourceCardTitle.trim();
  const model = summary.metadata.codexModel.trim();
  const effort = summary.metadata.codexEffort.trim();
  metadata.hidden = !source && !model && !effort;
  setText(element, '[data-codex-run-source]', source);
  setSelectValueIfUnset(element, '[data-codex-run-model]', model);
  setSelectValueIfUnset(element, '[data-codex-run-effort]', effort);
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
  if (summary.status === 'running' || summary.status === 'pending') {
    showTimer(element);
    setCancelButtonVisible(element, true);
    setContinueButtonVisible(element, false);
    setSelectionEnabled(element, false);
    const button = cancelButton(element);
    if (button) setCancelButtonState(button, 'ready', summary.status);
  } else {
    removeTimer(element);
    setCancelButtonVisible(element, false);
    setContinueButtonVisible(element, summary.status !== 'unknown');
    setSelectionEnabled(element, summary.status !== 'unknown');
  }
  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
  setWidgetMetadata(element, summary);
  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
}

function pollerDebugState(poller: Poller): Record<string, unknown> {
  return {
    ledgerId: poller.ledgerId,
    cardId: poller.cardId,
    runId: poller.runId,
    since: poller.since,
    terminal: poller.terminal,
    inFlight: poller.inFlight,
    continueInFlight: poller.continueInFlight,
    datasetStatus: poller.element?.dataset.runStatus ?? '',
    consumerCount: poller.consumers.size,
  };
}

function paintFrontendClock(poller: Poller): void {
  if (poller.terminal || !poller.element) return;
  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - poller.startedAtMs));
}

function scheduleClockFrame(poller: Poller): void {
  if (poller.clock || poller.terminal) return;
  const tick = (): void => {
    poller.clock = null;
    if (poller.terminal) return;
    if (!poller.element || !globalThis.document?.contains(poller.element)) return;
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

function setCancelButtonState(button: HTMLButtonElement, state: 'ready' | 'stopping', status: string): void {
  button.disabled = state === 'stopping';
  const stopping = state === 'stopping';
  const pending = status === 'pending';
  const label = button.querySelector?.<HTMLElement>('[data-codex-run-stop-label]');
  const text = pending ? (stopping ? 'CANCELLING' : 'CANCEL') : (stopping ? 'STOPPING' : 'STOP');
  if (label) label.textContent = text;
  else button.textContent = text;
  button.title = pending ? (stopping ? 'Cancelling queued Codex run' : 'Cancel queued Codex run') : (stopping ? 'Stopping Codex run' : 'Stop Codex run');
  button.setAttribute('aria-label', button.title);
}

function setContinueButtonState(button: HTMLButtonElement, state: 'ready' | 'starting'): void {
  button.disabled = state === 'starting';
  button.textContent = state === 'starting' ? 'Continuing' : 'Continue';
}

function paintExternallyStartedRun(poller: Poller, status: 'pending' | 'running' = 'pending', latestLabel = 'Submitting continuation'): void {
  if (!poller.element) return;
  poller.terminal = false;
  poller.detachedChecks = 0;
  poller.startedAtMs = Date.now();
  poller.element.dataset.runStatus = status;
  setText(poller.element, '[data-codex-run-status]', status.toUpperCase());
  setText(poller.element, '[data-codex-run-latest]', latestLabel);
  setText(poller.element, '[data-codex-run-tools]', '0');
  setText(poller.element, '[data-codex-run-messages]', '0');
  setText(poller.element, '[data-codex-run-files]', '0');
  setCancelButtonVisible(poller.element, true);
  setContinueButtonVisible(poller.element, false);
  setSelectionEnabled(poller.element, false);
  const cancel = cancelButton(poller.element);
  if (cancel) setCancelButtonState(cancel, 'ready', status);
  showTimer(poller.element);
  startFrontendClock(poller);
}

function bindCancelButton(poller: Poller): void {
  if (!poller.element) return;
  const button = cancelButton(poller.element);
  if (!button) return;
  button.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    void cancelRun(poller);
  };
  setCancelButtonState(button, poller.cancelInFlight ? 'stopping' : 'ready', poller.element.dataset.runStatus);
}

function bindContinueButton(poller: Poller): void {
  if (!poller.element) return;
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
  if (!poller.element || poller.terminal || poller.cancelInFlight) return;
  const button = cancelButton(poller.element);
  if (!button) return;
  poller.cancelInFlight = true;
  setCancelButtonState(button, 'stopping', poller.element.dataset.runStatus);
  setText(poller.element, '[data-codex-run-latest]', 'Stopping run');
  const executionId = poller.lastSummary?.executionId || poller.expectedExecutionId;
  const result = await requestCardSkillRunCancel({ projectId: poller.projectId, replicaNodeId: poller.replicaNodeId, ledgerId: poller.ledgerId, cardId: poller.cardId, runId: poller.runId, executionId });
  poller.cancelInFlight = false;
  if (!result.ok) {
    setCancelButtonState(button, 'ready', poller.element.dataset.runStatus);
    setText(poller.element, '[data-codex-run-latest]', result.error || 'Stop failed');
    return;
  }
  setCancelButtonState(button, 'stopping', poller.element.dataset.runStatus);
  schedulePoll(poller, 0);
}

async function continueRun(poller: Poller): Promise<void> {
  if (!poller.element || poller.continueInFlight || poller.inFlight) return;
  const button = continueButton(poller.element);
  if (!button) return;
  const key = pollerKey(poller);
  const previousSummary = terminalSummaries.get(key);
  const status = poller.lastSummary?.status ?? previousSummary?.status ?? 'unknown';
  if (status !== 'complete' && status !== 'failed' && status !== 'cancelled') return;
  const preference = activeCardCodexRunPreference(poller.cardId);
  const codexModel = preference.model;
  const codexEffort = preference.effort;
  const traceId = continueTraceId(poller.runId);
  poller.continueTraceId = traceId;
  debugContinue(traceId, 'click', { ...pollerDebugState(poller), previousSummaryStatus: previousSummary?.status ?? '', previousSummaryLineCount: previousSummary?.lineCount ?? 0 });
  poller.continueInFlight = true;
  poller.terminal = false;
  // A continuation is a new execution inside the same append-only session.
  // Keep the global cursor and rendered history while resetting only live execution state.
  poller.since = Math.max(poller.since, previousSummary?.lineCount ?? 0);
  if (previousSummary?.events.length && poller.historyEvents.length === 0) poller.historyEvents = [...previousSummary.events];
  poller.detachedChecks = 0;
  poller.startedAtMs = Date.now();
  terminalSummaries.delete(key);
  pollers.set(key, poller);
  setContinueButtonState(button, 'starting');
  paintExternallyStartedRun(poller);
  debugContinue(traceId, 'optimistic-pending-painted', pollerDebugState(poller));
  const result = await requestCardSkillRunContinue({ projectId: poller.projectId, replicaNodeId: poller.replicaNodeId, ledgerId: poller.ledgerId, cardId: poller.cardId, runId: poller.runId, traceId, codexModel, codexEffort });
  poller.continueInFlight = false;
  debugContinue(traceId, 'continue-response', { ...pollerDebugState(poller), ok: result.ok, status: result.status, error: result.error ?? '', pid: result.run?.pid ?? 0, continuedMessageCount: result.run?.continuedMessageCount ?? 0 });
  if (!result.ok) {
    poller.terminal = Boolean(previousSummary);
    stopPoller(key);
    if (previousSummary) {
      terminalSummaries.set(key, previousSummary);
      paintWidget(poller.element, previousSummary);
      setSelectValue(poller.element, '[data-codex-run-model]', codexModel);
      setSelectValue(poller.element, '[data-codex-run-effort]', codexEffort);
    } else {
      poller.element.dataset.runStatus = 'unknown';
      removeTimer(poller.element);
      setCancelButtonVisible(poller.element, false);
      setContinueButtonVisible(poller.element, true);
      setSelectionEnabled(poller.element, true);
      setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
    }
    const restoredButton = continueButton(poller.element);
    if (restoredButton) setContinueButtonState(restoredButton, 'ready');
    setText(poller.element, '[data-codex-run-latest]', result.error || 'Continue failed');
    debugContinue(traceId, 'continue-response-restored-terminal', pollerDebugState(poller));
    return;
  }
  const startedAt = timestampMs(result.run?.startedAt) || timestampMs(result.run?.continuedAt);
  if (startedAt) poller.startedAtMs = startedAt;
  poller.expectedExecutionId = String(result.run?.executionId ?? poller.expectedExecutionId);
  const acceptedStatus = result.status === 'running' ? 'running' : 'pending';
  paintExternallyStartedRun(poller, acceptedStatus, acceptedStatus === 'pending' && Number.isInteger(result.queuePosition) ? `Queued · position ${result.queuePosition}` : 'Continuing session');
  pollers.set(key, poller);
  setContinueButtonState(button, 'ready');
  startFrontendClock(poller);
  debugContinue(traceId, 'continue-response-schedule-poll', pollerDebugState(poller));
  schedulePoll(poller, 0);
}

async function poll(poller: Poller): Promise<void> {
  const key = pollerKey(poller);
  if (poller.element && !globalThis.document?.contains(poller.element)) {
    if (poller.consumers.size > 0) poller.element = null;
    else {
      poller.detachedChecks += 1;
      if (poller.detachedChecks < 4) schedulePoll(poller, 250);
      else stopPoller(key);
      return;
    }
  }
  if (!poller.element && poller.consumers.size === 0) {
    stopPoller(key);
    return;
  }
  poller.detachedChecks = 0;
  if (poller.element) startFrontendClock(poller);
  if (poller.inFlight) {
    schedulePoll(poller);
    return;
  }
  poller.inFlight = true;
  const requestGeneration = poller.generation;
  debugContinue(poller.continueTraceId, 'poll-request', pollerDebugState(poller));
  const summary = await requestCardSkillRunStatus({
    projectId: poller.projectId,
    replicaNodeId: poller.replicaNodeId,
    ledgerId: poller.ledgerId,
    cardId: poller.cardId,
    runId: poller.runId,
    since: poller.since,
    traceId: poller.continueTraceId
  });
  if (pollers.get(key) !== poller || poller.generation !== requestGeneration) {
    poller.inFlight = false;
    schedulePoll(poller, 0);
    return;
  }
  poller.inFlight = false;
  debugContinue(poller.continueTraceId, 'poll-response', { ...pollerDebugState(poller), ok: summary.ok, status: summary.status, lineCount: summary.lineCount, nextSince: summary.nextSince, persistedEventCount: summary.persistedEventCount, latestEventType: summary.latestEvent?.type ?? '', latestEventLine: summary.latestEvent?.line ?? 0, error: summary.error ?? '' });
  if (summary.ok && poller.expectedExecutionId && summary.executionId !== poller.expectedExecutionId) {
    schedulePoll(poller, 250);
    return;
  }
  if (!summary.ok) {
    if (poller.element) {
      poller.element.dataset.runStatus = 'unknown';
      removeTimer(poller.element);
      setCancelButtonVisible(poller.element, false);
      setContinueButtonVisible(poller.element, false);
      setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
      setText(poller.element, '[data-codex-run-latest]', summary.error || 'Run unavailable');
    }
    terminalSummaries.set(key, summary);
    poller.lastSummary = summary;
    notifyConsumers(poller, summary);
    debugContinue(poller.continueTraceId, 'poll-error-stopping', pollerDebugState(poller));
    stopPoller(key);
    return;
  }
  const summaryStartedAt = timestampMs(summary.startedAt);
  if (summary.status === 'running' && summaryStartedAt) poller.startedAtMs = summaryStartedAt;
  poller.since = Math.max(poller.since, summary.nextSince, summary.lineCount);
  accumulateRunEvents(poller, summary.events);
  poller.lastSummary = { ...summary, events: [...poller.historyEvents] };
  if (poller.element) paintWidget(poller.element, summary);
  notifyConsumers(poller, summary);
  telemetry('codex-skill-run-polled', { runId: poller.runId, status: summary.status, lineCount: summary.lineCount });
  if (!isTerminalStatus(summary.status)) schedulePoll(poller);
  else {
    poller.terminal = true;
    poller.continueInFlight = false;
    if (poller.element) {
      const button = continueButton(poller.element);
      if (button) setContinueButtonState(button, 'ready');
    }
    terminalSummaries.set(key, { ...summary, events: [...poller.historyEvents] });
    debugContinue(poller.continueTraceId, 'poll-terminal-stopping', { ...pollerDebugState(poller), status: summary.status, lineCount: summary.lineCount, latestEventType: summary.latestEvent?.type ?? '', latestEventLine: summary.latestEvent?.line ?? 0 });
    stopPoller(key);
  }
}

export function resumeExternallyStartedCardSkillRun(input: PollerIdentity & { executionId?: string; status?: CardSkillRunStatus }): boolean {
  const identity = normalizedPollerIdentity(input);
  const key = pollerKey(identity);
  terminalSummaries.delete(key);
  let poller = pollers.get(key);
  if (!poller) {
    const consumers = runConsumers.get(key);
    if (!consumers?.size) return false;
    poller = createConsumerPoller(identity, consumers, String(input.executionId ?? ''));
  }
  poller.generation += 1;
  poller.expectedExecutionId = String(input.executionId ?? poller.expectedExecutionId);
  poller.continueInFlight = false;
  poller.since = Math.max(poller.since, poller.lastSummary?.lineCount ?? 0);
  poller.terminal = false;
  pollers.set(key, poller);
  schedulePoll(poller, 0);
  return true;
}

export function bindCardSkillRunLogConsumer(input: {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId: string;
  cardId: string;
  runId: string;
  expectedExecutionId?: string;
  expectedStatus?: CardSkillRunStatus;
  forceRevalidate?: boolean;
  consumerId: string;
  onSummary: (summary: CardSkillRunSummary) => void;
}): void {
  const identity = normalizedPollerIdentity(input);
  const key = pollerKey(identity);
  const consumers = consumersFor(key);
  const alreadyBound = consumers.has(input.consumerId);
  consumers.set(input.consumerId, input.onSummary);
  const cachedTerminalSummary = terminalSummaries.get(key);
  const expectedExecutionId = String(input.expectedExecutionId ?? '');
  const expectsLiveExecution = input.expectedStatus === 'pending' || input.expectedStatus === 'running';
  const terminalSummaryIsStale = Boolean(cachedTerminalSummary)
    && (input.forceRevalidate === true || (expectedExecutionId && cachedTerminalSummary?.executionId !== expectedExecutionId) || expectsLiveExecution);
  if (terminalSummaryIsStale) terminalSummaries.delete(key);
  const terminalSummary = terminalSummaryIsStale ? undefined : cachedTerminalSummary;
  if (terminalSummary) {
    if (!alreadyBound) input.onSummary(terminalSummary);
    return;
  }
  const existing = pollers.get(key);
  if (existing) {
    existing.consumers = consumers;
    if (input.forceRevalidate || (expectedExecutionId && existing.expectedExecutionId !== expectedExecutionId)) {
      existing.generation += 1;
      existing.expectedExecutionId = expectedExecutionId;
      existing.terminal = false;
    } else if (existing.lastSummary && !alreadyBound) input.onSummary(existing.lastSummary);
    if (!existing.timer && !existing.inFlight) schedulePoll(existing, 0);
    return;
  }
  const poller = createConsumerPoller(identity, consumers, expectedExecutionId);
  pollers.set(key, poller);
  schedulePoll(poller, 0);
}

function createConsumerPoller(identity: Required<PollerIdentity>, consumers: Map<string, (summary: CardSkillRunSummary) => void>, expectedExecutionId = ''): Poller {
  return {
    projectId: identity.projectId,
    replicaNodeId: identity.replicaNodeId,
    ledgerId: identity.ledgerId,
    cardId: identity.cardId,
    runId: identity.runId,
    element: null,
    consumers,
    historyEvents: [],
    lastSummary: null,
    since: 0,
    startedAtMs: runStartedAt(identity.runId),
    timer: null,
    clock: null,
    lastClockPaintMs: 0,
    inFlight: false,
    cancelInFlight: false,
    continueInFlight: false,
    continueTraceId: '',
    detachedChecks: 0,
    terminal: false,
    generation: 0,
    expectedExecutionId,
  };
}

export function unbindCardSkillRunLogConsumer(input: PollerIdentity & { consumerId: string }): void {
  const key = pollerKey(normalizedPollerIdentity(input));
  const consumers = runConsumers.get(key);
  if (!consumers) return;
  consumers.delete(input.consumerId);
  if (consumers.size > 0) return;
  runConsumers.delete(key);
  const poller = pollers.get(key);
  if (poller && !poller.element) stopPoller(key);
}

export function purgeCardSkillRunLog(input: PollerIdentity): void {
  const key = pollerKey(normalizedPollerIdentity(input));
  stopPoller(key);
  terminalSummaries.delete(key);
  runConsumers.delete(key);
}

export function bindCardSkillRunWidget(input: PollerIdentity & { element: HTMLElement }): void {
  const identity = normalizedPollerIdentity(input);
  const scopedInput = { ...input, projectId: identity.projectId, replicaNodeId: identity.replicaNodeId };
  const key = pollerKey(identity);
  const terminalSummary = terminalSummaries.get(key);
  if (terminalSummary) {
    const poller: Poller = { ...scopedInput, consumers: consumersFor(key), historyEvents: [...terminalSummary.events], lastSummary: terminalSummary, since: terminalSummary.lineCount, startedAtMs: runStartedAt(input.runId), timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, cancelInFlight: false, continueInFlight: false, continueTraceId: '', detachedChecks: 0, terminal: true, generation: 0, expectedExecutionId: '' };
    pollers.set(key, poller);
    paintWidget(input.element, terminalSummary);
    bindCancelButton(poller);
    bindContinueButton(poller);
    return;
  }
  const existing = pollers.get(key);
  if (existing) {
    existing.element = input.element;
    existing.projectId = identity.projectId;
    existing.replicaNodeId = identity.replicaNodeId;
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
  const poller: Poller = { ...scopedInput, consumers: consumersFor(key), historyEvents: [], lastSummary: null, since: 0, startedAtMs: runStartedAt(input.runId), timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, cancelInFlight: false, continueInFlight: false, continueTraceId: '', detachedChecks: 0, terminal: false, generation: 0, expectedExecutionId: '' };
  pollers.set(key, poller);
  bindCancelButton(poller);
  bindContinueButton(poller);
  startFrontendClock(poller);
  schedulePoll(poller, 0);
}

function pipelineStepPollerKey(input: { projectId: string; replicaNodeId: string; ledgerId: string; cardId: string; pipelineRunId: string }): string {
  return JSON.stringify([input.projectId, input.replicaNodeId, input.ledgerId, input.cardId, input.pipelineRunId]);
}

function restartButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('[data-codex-run-restart]');
}

function retryButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('[data-codex-run-retry]');
}

function setRestartButtonVisible(element: HTMLElement, visible: boolean): void {
  const button = restartButton(element);
  if (button) button.hidden = !visible;
}

function setRetryButtonVisible(element: HTMLElement, visible: boolean): void {
  const button = retryButton(element);
  if (button) button.hidden = !visible;
}

function setPipelineButtonState(button: HTMLButtonElement | null, busy: boolean, idleLabel: string, busyLabel: string): void {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

function pipelineStepFor(result: CodexPipelineRunStatusResult, poller: PipelineStepPoller): CodexPipelineRunStepDetail | null {
  return result.run?.steps.find((step) => step.outputCard.id === poller.cardId || step.stepId === poller.pipelineStepId) ?? null;
}

function displayedPipelineSkill(step: CodexPipelineRunStepDetail): CodexPipelineRunSkillDetail | null {
  return step.skills.find((skill) => skill.status === 'running')
    ?? step.skills.find((skill) => skill.status === 'failed' || skill.status === 'cancelled')
    ?? step.skills.find((skill) => skill.status === 'pending')
    ?? [...step.skills].reverse().find((skill) => skill.status === 'complete')
    ?? null;
}

function effectivePipelineStepStatus(result: CodexPipelineRunStatusResult, step: CodexPipelineRunStepDetail): PipelineWidgetStatus {
  if (step.status !== 'pending') return step.status;
  if (result.run?.status === 'failed') return 'failed';
  if (result.run?.status === 'cancelled') return 'cancelled';
  return 'pending';
}

export function pipelineLatestLabel(
  result: CodexPipelineRunStatusResult,
  step: CodexPipelineRunStepDetail,
  skill: CodexPipelineRunSkillDetail | null,
  status: PipelineWidgetStatus,
): string {
  if (result.run?.status === 'pending' && result.queuePosition) return `Queued · position ${result.queuePosition}`;
  if (status === 'pending') return `Waiting for ${skill?.skillName || 'the previous pipeline step'}`;
  if (status === 'running') return `Running ${skill?.skillName || step.name}`;
  if (status === 'complete') return result.run?.status === 'complete' ? 'Pipeline complete' : 'Step complete · pipeline continues';
  if (status === 'cancelled') return skill?.error || step.error || result.run?.error || 'Pipeline cancelled';
  if (status === 'failed') {
    if (step.status === 'pending') return 'Blocked after an earlier pipeline failure';
    return skill?.error || step.error || result.run?.error || 'Pipeline failed';
  }
  return result.error || 'Pipeline status is unavailable';
}

function paintPipelineContext(
  element: HTMLElement,
  result: CodexPipelineRunStatusResult,
  step: CodexPipelineRunStepDetail,
  skill: CodexPipelineRunSkillDetail | null,
): void {
  const context = element.querySelector<HTMLElement>('[data-codex-run-context]');
  if (context) {
    context.hidden = false;
    context.textContent = [result.run?.pipelineName, step.name, skill?.skillName].filter(Boolean).join(' › ');
    context.title = context.textContent;
  }
  const metadata = element.querySelector<HTMLElement>('[data-codex-run-metadata]');
  if (metadata) metadata.hidden = false;
  setText(element, '[data-codex-run-source]', result.run?.sourceCardTitle ?? '');
  setSelectValueIfUnset(element, '[data-codex-run-model]', String(skill?.codexModel ?? ''));
  setSelectValueIfUnset(element, '[data-codex-run-effort]', String(skill?.codexEffort ?? ''));
}

function setPipelineControls(
  poller: PipelineStepPoller,
  status: PipelineWidgetStatus,
  result: CodexPipelineRunStatusResult,
  skill: CodexPipelineRunSkillDetail | null,
): void {
  const running = status === 'running';
  const queued = result.run?.status === 'pending' && Boolean(result.queuePosition);
  const pipelineTerminal = result.run?.status === 'complete' || result.run?.status === 'failed' || result.run?.status === 'cancelled';
  setCancelButtonVisible(poller.element, (running || queued) && Boolean(result.canCancel));
  setContinueButtonVisible(poller.element, pipelineTerminal && Boolean(result.canContinue) && Boolean(skill?.runId));
  setRestartButtonVisible(poller.element, pipelineTerminal && Boolean(result.canRestart));
  setRetryButtonVisible(poller.element, false);
  setSelectionEnabled(poller.element, pipelineTerminal);
  const stop = cancelButton(poller.element);
  if (stop) setCancelButtonState(stop, poller.cancelInFlight ? 'stopping' : 'ready', queued ? 'pending' : status);
  setPipelineButtonState(continueButton(poller.element), poller.continueInFlight, 'Continue', 'Continuing');
  setPipelineButtonState(restartButton(poller.element), poller.restartInFlight, 'Restart', 'Restarting');
}

function paintPipelineStep(
  poller: PipelineStepPoller,
  result: CodexPipelineRunStatusResult,
  step: CodexPipelineRunStepDetail,
  skill: CodexPipelineRunSkillDetail | null,
): PipelineWidgetStatus {
  const status = effectivePipelineStepStatus(result, step);
  poller.element.dataset.runStatus = status;
  const queued = result.run?.status === 'pending' && Boolean(result.queuePosition);
  setText(poller.element, '[data-codex-run-status]', queued ? 'QUEUED' : statusLabel(status));
  paintPipelineContext(poller.element, result, step, skill);
  setPipelineControls(poller, status, result, skill);
  setText(poller.element, '[data-codex-run-latest]', pipelineLatestLabel(result, step, skill, status));
  if (status === 'running') showTimer(poller.element);
  else removeTimer(poller.element);
  if (status === 'pending') {
    setText(poller.element, '[data-codex-run-tools]', '0');
    setText(poller.element, '[data-codex-run-messages]', '0');
    setText(poller.element, '[data-codex-run-files]', '0');
  }
  return status;
}

function paintPipelineError(poller: PipelineStepPoller, message: string, options: { keepCancel?: boolean } = {}): void {
  poller.element.dataset.runStatus = 'unknown';
  setText(poller.element, '[data-codex-run-status]', 'NEEDS ATTENTION');
  setText(poller.element, '[data-codex-run-latest]', `${message || 'Pipeline status is unavailable.'} Retry status.`);
  removeTimer(poller.element);
  setCancelButtonVisible(poller.element, Boolean(options.keepCancel));
  setContinueButtonVisible(poller.element, false);
  setRestartButtonVisible(poller.element, false);
  setRetryButtonVisible(poller.element, true);
  setSelectionEnabled(poller.element, false);
}

function paintPipelineClock(poller: PipelineStepPoller): void {
  if (poller.terminal || poller.element.dataset.runStatus !== 'running') return;
  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - poller.startedAtMs));
}

function schedulePipelineClock(poller: PipelineStepPoller): void {
  if (poller.clock || poller.terminal || poller.element.dataset.runStatus !== 'running') return;
  const tick = (): void => {
    poller.clock = null;
    if (poller.terminal || poller.element.dataset.runStatus !== 'running' || !globalThis.document?.contains(poller.element)) return;
    const now = Date.now();
    if (now - poller.lastClockPaintMs >= 33) {
      poller.lastClockPaintMs = now;
      paintPipelineClock(poller);
    }
    schedulePipelineClock(poller);
  };
  if (typeof globalThis.requestAnimationFrame === 'function') {
    poller.clock = { kind: 'animation', id: globalThis.requestAnimationFrame(tick) };
  } else {
    poller.clock = { kind: 'timeout', id: setTimeout(tick, 33) };
  }
}

function stopPipelineClock(poller: PipelineStepPoller): void {
  if (poller.clock?.kind === 'animation') globalThis.cancelAnimationFrame?.(poller.clock.id);
  if (poller.clock?.kind === 'timeout') clearTimeout(poller.clock.id);
  poller.clock = null;
}

function schedulePipelinePoll(poller: PipelineStepPoller, delayMs = 1000): void {
  if (poller.timer) clearTimeout(poller.timer);
  poller.timer = setTimeout(() => runPipelinePoll(poller), delayMs);
}

function runPipelinePoll(poller: PipelineStepPoller): void {
  void pollPipelineStep(poller).catch((error) => {
    poller.inFlight = false;
    poller.terminal = true;
    const message = error instanceof Error ? error.message : String(error ?? 'Pipeline status failed.');
    paintPipelineError(poller, message);
    telemetry('codex-pipeline-widget-status-failed', { pipelineRunId: poller.pipelineRunId, cardId: poller.cardId, error: message });
  });
}

function triggerPipelinePoll(poller: PipelineStepPoller): void {
  if (poller.timer) clearTimeout(poller.timer);
  poller.timer = null;
  if (!poller.inFlight) runPipelinePoll(poller);
}

function removePipelinePoller(poller: PipelineStepPoller): void {
  if (poller.timer) clearTimeout(poller.timer);
  poller.timer = null;
  stopPipelineClock(poller);
  pipelineStepPollers.delete(pipelineStepPollerKey(poller));
}

function bindPipelineButtons(poller: PipelineStepPoller): void {
  const cancel = cancelButton(poller.element);
  if (cancel) cancel.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    void cancelPipelineStepRun(poller);
  };
  const resume = continueButton(poller.element);
  if (resume) resume.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    void continuePipelineStepRun(poller);
  };
  const restart = restartButton(poller.element);
  if (restart) restart.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    void restartPipelineRun(poller);
  };
  const retry = retryButton(poller.element);
  if (retry) retry.onclick = (event): void => {
    event.preventDefault();
    event.stopPropagation();
    poller.terminal = false;
    setPipelineButtonState(retry, true, 'Retry status', 'Checking');
    setText(poller.element, '[data-codex-run-latest]', 'Checking pipeline status');
    triggerPipelinePoll(poller);
  };
}

async function cancelPipelineStepRun(poller: PipelineStepPoller): Promise<void> {
  if (poller.cancelInFlight || poller.inFlight) return;
  poller.cancelInFlight = true;
  const stop = cancelButton(poller.element);
  if (stop) setCancelButtonState(stop, 'stopping', poller.element.dataset.runStatus);
  setText(poller.element, '[data-codex-run-latest]', poller.continuationMode ? 'Stopping continuation' : 'Stopping pipeline');
  const result = poller.continuationMode
    ? await requestCardSkillRunCancel({
        projectId: poller.projectId,
        replicaNodeId: poller.replicaNodeId,
        ledgerId: poller.ledgerId,
        cardId: poller.cardId,
        runId: poller.activeSkillRunId || poller.runId,
        executionId: poller.continuationExecutionId,
      })
    : await requestCodexPipelineRunCancel({ projectId: poller.projectId, replicaNodeId: poller.replicaNodeId, runId: poller.pipelineRunId, executionId: poller.lastStatus?.activeSkill?.executionId ?? '' });
  poller.cancelInFlight = false;
  if (!result.ok) {
    paintPipelineError(poller, result.error || 'Stop failed.');
    return;
  }
  poller.terminal = false;
  triggerPipelinePoll(poller);
}

async function restartPipelineRun(poller: PipelineStepPoller): Promise<void> {
  if (poller.restartInFlight || poller.inFlight) return;
  poller.restartInFlight = true;
  setPipelineButtonState(restartButton(poller.element), true, 'Restart', 'Restarting');
  setText(poller.element, '[data-codex-run-latest]', 'Clearing generated results and restarting pipeline');
  const result = await requestCodexPipelineRunRestart({ projectId: poller.projectId, replicaNodeId: poller.replicaNodeId, runId: poller.pipelineRunId });
  poller.restartInFlight = false;
  if (!result.ok) {
    paintPipelineError(poller, result.error || 'Pipeline restart failed.');
    return;
  }
  poller.continuationMode = false;
  poller.activeSkillRunId = '';
  poller.continuationExecutionId = '';
  poller.since = 0;
  poller.terminal = false;
  poller.startedAtMs = Date.now();
  poller.element.dataset.runStatus = 'pending';
  setText(poller.element, '[data-codex-run-status]', 'PENDING');
  setText(poller.element, '[data-codex-run-latest]', 'Pipeline restarted');
  setContinueButtonVisible(poller.element, false);
  setRestartButtonVisible(poller.element, false);
  triggerPipelinePoll(poller);
}

async function continuePipelineStepRun(poller: PipelineStepPoller): Promise<void> {
  if (poller.continueInFlight || poller.inFlight) return;
  const skillRunId = poller.activeSkillRunId || poller.runId;
  if (!skillRunId) {
    paintPipelineError(poller, 'No completed skill session is available.');
    return;
  }
  poller.continueInFlight = true;
  setPipelineButtonState(continueButton(poller.element), true, 'Continue', 'Continuing');
  setText(poller.element, '[data-codex-run-latest]', 'Continuing skill session');
  const preference = activeCardCodexRunPreference(poller.cardId);
  const result = await requestCardSkillRunContinue({
    projectId: poller.projectId,
    replicaNodeId: poller.replicaNodeId,
    ledgerId: poller.ledgerId,
    cardId: poller.cardId,
    runId: skillRunId,
    codexModel: preference.model,
    codexEffort: preference.effort,
  });
  poller.continueInFlight = false;
  if (!result.ok) {
    setPipelineButtonState(continueButton(poller.element), false, 'Continue', 'Continuing');
    setText(poller.element, '[data-codex-run-latest]', result.error || 'Continue failed');
    return;
  }
  poller.continuationMode = true;
  poller.activeSkillRunId = skillRunId;
  poller.continuationExecutionId = String(result.run?.executionId ?? '');
  poller.since = 0;
  poller.terminal = false;
  poller.startedAtMs = timestampMs(result.run?.startedAt) || timestampMs(result.run?.continuedAt) || Date.now();
  const acceptedStatus = result.status === 'running' ? 'running' : 'pending';
  poller.element.dataset.runStatus = acceptedStatus;
  setText(poller.element, '[data-codex-run-status]', acceptedStatus.toUpperCase());
  setText(poller.element, '[data-codex-run-latest]', acceptedStatus === 'pending' && Number.isInteger(result.queuePosition) ? `Queued · position ${result.queuePosition}` : 'Continuing skill session');
  setCancelButtonVisible(poller.element, true);
  const cancel = cancelButton(poller.element);
  if (cancel) setCancelButtonState(cancel, 'ready', acceptedStatus);
  setContinueButtonVisible(poller.element, false);
  setRestartButtonVisible(poller.element, false);
  showTimer(poller.element);
  schedulePipelineClock(poller);
  schedulePipelinePoll(poller, 0);
}

async function pollPipelineContinuation(poller: PipelineStepPoller): Promise<void> {
  const summary = await requestCardSkillRunStatus({
    projectId: poller.projectId,
    replicaNodeId: poller.replicaNodeId,
    ledgerId: poller.ledgerId,
    cardId: poller.cardId,
    runId: poller.activeSkillRunId || poller.runId,
    since: poller.since,
  });
  if (!summary.ok) {
    paintPipelineError(poller, summary.error || 'Continuation log could not be read.', { keepCancel: true });
    schedulePipelinePoll(poller);
    return;
  }
  poller.continuationExecutionId = summary.executionId || poller.continuationExecutionId;
  poller.since = Math.max(poller.since, summary.nextSince, summary.lineCount);
  const startedAt = timestampMs(summary.startedAt);
  if (startedAt) poller.startedAtMs = startedAt;
  poller.element.dataset.runStatus = summary.status;
  setText(poller.element, '[data-codex-run-status]', statusLabel(summary.status));
  setText(poller.element, '[data-codex-run-tools]', String(summary.toolCallCount));
  setText(poller.element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
  setText(poller.element, '[data-codex-run-files]', String(summary.fileChangeCount));
  setText(poller.element, '[data-codex-run-latest]', latestEventLabel(summary));
  setWidgetMetadata(poller.element, summary);
  if (summary.status === 'pending' || summary.status === 'running') {
    showTimer(poller.element);
    setCancelButtonVisible(poller.element, true);
    const cancel = cancelButton(poller.element);
    if (cancel) setCancelButtonState(cancel, poller.cancelInFlight ? 'stopping' : 'ready', summary.status);
    setContinueButtonVisible(poller.element, false);
    setRestartButtonVisible(poller.element, false);
    setRetryButtonVisible(poller.element, false);
    schedulePipelineClock(poller);
    schedulePipelinePoll(poller);
    return;
  }
  poller.terminal = isTerminalStatus(summary.status);
  stopPipelineClock(poller);
  removeTimer(poller.element);
  setCancelButtonVisible(poller.element, false);
  setContinueButtonVisible(poller.element, poller.terminal);
  setRestartButtonVisible(poller.element, Boolean(poller.lastStatus?.canRestart));
  setSelectionEnabled(poller.element, poller.terminal);
}

async function pollPipelineStep(poller: PipelineStepPoller): Promise<void> {
  poller.timer = null;
  if (!globalThis.document?.contains(poller.element)) {
    poller.detachedChecks += 1;
    if (poller.detachedChecks >= 4) {
      removePipelinePoller(poller);
      return;
    }
  } else poller.detachedChecks = 0;
  if (poller.inFlight) {
    schedulePipelinePoll(poller);
    return;
  }
  poller.inFlight = true;
  if (poller.continuationMode) {
    await pollPipelineContinuation(poller);
    poller.inFlight = false;
    return;
  }
  const result = await requestCodexPipelineRunStatus({ projectId: poller.projectId, replicaNodeId: poller.replicaNodeId, runId: poller.pipelineRunId });
  poller.inFlight = false;
  setPipelineButtonState(retryButton(poller.element), false, 'Retry status', 'Checking');
  if (!result.ok || !result.run) {
    poller.terminal = true;
    paintPipelineError(poller, result.error || 'Pipeline status could not be loaded.');
    telemetry('codex-pipeline-widget-status-failed', { pipelineRunId: poller.pipelineRunId, cardId: poller.cardId, error: result.error ?? '' });
    return;
  }
  const step = pipelineStepFor(result, poller);
  if (!step) {
    poller.terminal = true;
    paintPipelineError(poller, 'This generated card is no longer present in the pipeline run.');
    return;
  }
  poller.lastStatus = result;
  const skill = displayedPipelineSkill(step);
  const status = paintPipelineStep(poller, result, step, skill);
  const skillRunId = skill?.runId ?? '';
  if (skillRunId && skillRunId !== poller.activeSkillRunId) {
    poller.activeSkillRunId = skillRunId;
    poller.runId = skillRunId;
    poller.since = 0;
    setText(poller.element, '[data-codex-run-tools]', '0');
    setText(poller.element, '[data-codex-run-messages]', '0');
    setText(poller.element, '[data-codex-run-files]', '0');
  }
  if (status === 'running' && skill?.status === 'running') {
    poller.startedAtMs = timestampMs(skill.startedAt) || poller.startedAtMs || Date.now();
    schedulePipelineClock(poller);
    if (!skill.logAvailable) {
      paintPipelineError(poller, 'The active skill log is not available yet.', { keepCancel: result.canCancel });
      schedulePipelinePoll(poller, 500);
      return;
    }
    const summary = await requestCardSkillRunStatus({
      projectId: poller.projectId,
      replicaNodeId: poller.replicaNodeId,
      ledgerId: poller.ledgerId,
      cardId: poller.cardId,
      runId: skill.runId,
      since: poller.since,
    });
    if (!summary.ok) {
      paintPipelineError(poller, summary.error || 'The active skill log could not be read.', { keepCancel: result.canCancel });
      schedulePipelinePoll(poller);
      return;
    }
    poller.since = Math.max(poller.since, summary.nextSince, summary.lineCount);
    setText(poller.element, '[data-codex-run-tools]', String(summary.toolCallCount));
    setText(poller.element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
    setText(poller.element, '[data-codex-run-files]', String(summary.fileChangeCount));
    setText(poller.element, '[data-codex-run-latest]', latestEventLabel(summary));
  }
  const pipelineTerminal = result.run.status === 'complete' || result.run.status === 'failed' || result.run.status === 'cancelled';
  poller.terminal = pipelineTerminal;
  telemetry('codex-pipeline-widget-polled', {
    pipelineRunId: poller.pipelineRunId,
    cardId: poller.cardId,
    stepId: step.stepId,
    stepStatus: status,
    skillRunId,
    pipelineStatus: result.run.status,
  });
  if (pipelineTerminal) stopPipelineClock(poller);
  else schedulePipelinePoll(poller);
}

export function bindPipelineStepRunWidget(input: {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId: string;
  cardId: string;
  runId: string;
  pipelineRunId: string;
  pipelineStepId: string;
  element: HTMLElement;
}): void {
  const scopedInput = { ...input, projectId: input.projectId ?? projectIdFromLocation(), replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation() };
  const key = pipelineStepPollerKey(scopedInput);
  const existing = pipelineStepPollers.get(key);
  if (existing) {
    existing.element = scopedInput.element;
    existing.runId = scopedInput.runId;
    existing.pipelineStepId = scopedInput.pipelineStepId;
    existing.detachedChecks = 0;
    bindPipelineButtons(existing);
    if (!existing.continuationMode && existing.lastStatus?.run) {
      const step = pipelineStepFor(existing.lastStatus, existing);
      if (step) paintPipelineStep(existing, existing.lastStatus, step, displayedPipelineSkill(step));
    }
    if (!existing.timer && !existing.inFlight && !existing.terminal) triggerPipelinePoll(existing);
    return;
  }
  const poller: PipelineStepPoller = {
    ...scopedInput,
    timer: null,
    clock: null,
    lastClockPaintMs: 0,
    startedAtMs: runStartedAt(input.runId),
    since: 0,
    inFlight: false,
    cancelInFlight: false,
    restartInFlight: false,
    continueInFlight: false,
    detachedChecks: 0,
    terminal: false,
    continuationMode: false,
    activeSkillRunId: '',
    continuationExecutionId: '',
    lastStatus: null,
  };
  pipelineStepPollers.set(key, poller);
  bindPipelineButtons(poller);
  triggerPipelinePoll(poller);
}

export function resumeExternallyStartedPipelineRun(input: {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId: string;
  pipelineRunId: string;
  cardId?: string;
  cardIds?: readonly string[];
  runId?: string;
}): boolean {
  const projectId = input.projectId ?? projectIdFromLocation();
  const replicaNodeId = input.replicaNodeId ?? replicaNodeIdFromLocation();
  const targetCardIds = new Set([input.cardId ?? '', ...(input.cardIds ?? [])].filter(Boolean));
  let resumed = false;
  for (const poller of pipelineStepPollers.values()) {
    if (poller.projectId !== projectId || poller.replicaNodeId !== replicaNodeId) continue;
    if (poller.ledgerId !== input.ledgerId || poller.pipelineRunId !== input.pipelineRunId) continue;
    if (targetCardIds.size > 0 && !targetCardIds.has(poller.cardId)) continue;
    if (input.runId) {
      poller.runId = input.runId;
      poller.activeSkillRunId = input.runId;
    }
    poller.continuationMode = false;
    poller.terminal = false;
    poller.inFlight = false;
    poller.since = 0;
    poller.startedAtMs = Date.now();
    poller.detachedChecks = 0;
    triggerPipelinePoll(poller);
    resumed = true;
  }
  return resumed;
}
