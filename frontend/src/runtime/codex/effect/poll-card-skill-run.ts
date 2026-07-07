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
  inFlight: boolean;
};

const pollers = new Map<string, Poller>();

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
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${remainingMinutes}:${String(seconds).padStart(2, '0')}`;
}

function setText(element: HTMLElement, selector: string, text: string): void {
  const target = element.querySelector(selector);
  if (target) target.textContent = text;
}

function latestEventLabel(summary: CardSkillRunSummary): string {
  const latest = summary.latestEvent;
  if (!latest) return summary.status === 'running' ? 'Waiting for output' : statusLabel(summary.status);
  if (latest.tool) return latest.tool;
  return latest.title || latest.kind || latest.type || statusLabel(summary.status);
}

function paintWidget(element: HTMLElement, summary: CardSkillRunSummary): void {
  element.dataset.runStatus = summary.status;
  setText(element, '[data-codex-run-status]', statusLabel(summary.status));
  setText(element, '[data-codex-run-timer]', durationLabel(summary.elapsedMs));
  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
}

function schedulePoll(poller: Poller): void {
  if (poller.timer) clearTimeout(poller.timer);
  poller.timer = setTimeout(() => void poll(poller), 1000);
}

function stopPoller(key: string): void {
  const poller = pollers.get(key);
  if (!poller) return;
  if (poller.timer) clearTimeout(poller.timer);
  pollers.delete(key);
}

async function poll(poller: Poller): Promise<void> {
  const key = pollerKey(poller);
  if (!globalThis.document?.contains(poller.element)) {
    stopPoller(key);
    return;
  }
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
  else stopPoller(key);
}

export function bindCardSkillRunWidget(input: { ledgerId: string; cardId: string; runId: string; element: HTMLElement }): void {
  const key = pollerKey(input);
  const existing = pollers.get(key);
  if (existing) {
    existing.element = input.element;
    existing.ledgerId = input.ledgerId;
    existing.cardId = input.cardId;
    existing.runId = input.runId;
    if (!existing.timer && !existing.inFlight) schedulePoll(existing);
    return;
  }
  const poller: Poller = { ...input, since: 0, timer: null, inFlight: false };
  pollers.set(key, poller);
  void poll(poller);
}
