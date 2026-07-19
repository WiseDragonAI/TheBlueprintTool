/**
 * WHAT: Renders the selected thread's chronological Codex run log.
 * WHY: Run diagnostics belong in an inspectable, independently scrolling surface instead of conversation notes.
 */
import { cardCodexRunIds, selectedCardCodexRunId } from '../../codex/helper/card-codex-run-id.js';
import { groupSequentialToolCalls, type ThreadRunLogEvent, type ThreadRunToolGroup } from '../../codex/helper/thread-run-log.js';
import { threadRunToolGroupSummary } from '../../codex/helper/thread-run-tool-group-summary.js';
import { threadRunToolPresentation } from '../../codex/helper/thread-run-tool-presentation.js';
import type { CardSkillRunExecution, CardSkillRunSummary } from '../../codex/effect/request-card-skill-run-status.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';
import { state, type ThreadPanelTab } from '../../state.js';
import { renderThreadCodexLogEvent } from '../component/render-thread-codex-log-event.js';
import { renderThreadCodexLogStatus } from '../component/render-thread-codex-log-status.js';
import { threadCodexStopState } from '../../codex/controller/stop-thread-codex-run-controller.js';
import { threadCodexSessionDeletionState } from '../../codex/controller/delete-thread-codex-session-controller.js';
import { isThreadFollowingBottom } from '../helper/thread-follow-bottom.js';
import { persistThreadViewportState } from './persist-thread-scroll.js';
import { hydrateThreadCodexRunHistory } from '../../codex/effect/hydrate-thread-codex-run-history.js';

type DisclosureByThread = Record<string, Record<string, boolean>>;

function recordState(name: string): Record<string, any> {
  // WHAT: Repair absent session-only run state at its access boundary.
  // WHY: Restored browser sessions may predate the Codex Log state maps.
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function disclosureState(name: string, threadId: string): Record<string, boolean> {
  const byThread = recordState(name) as DisclosureByThread;
  // WHAT: Allocate disclosure state only for the active thread on first access.
  // WHY: Disclosure identity is thread-scoped and must not leak across selected cards.
  if (!byThread[threadId] || typeof byThread[threadId] !== 'object') byThread[threadId] = {};
  return byThread[threadId];
}

function renderTool(event: ThreadRunLogEvent, threadId: string): HTMLDetailsElement {
  const presentation = threadRunToolPresentation(event);
  const rows = disclosureState('threadToolRowDisclosureByThreadId', threadId);
  const details = document.createElement('details');
  details.className = 'codex-tool-call';
  details.dataset.toolKey = event.toolKey;
  details.dataset.runStatus = event.status || 'pending';
  details.open = Boolean(rows[event.toolKey]);
  details.addEventListener('toggle', () => { rows[event.toolKey] = details.open; });

  const summary = document.createElement('summary');
  summary.className = 'codex-tool-call-summary';
  summary.title = presentation.command;
  const actionLabel = document.createElement('span');
  actionLabel.className = 'codex-tool-call-action';
  actionLabel.textContent = presentation.action;
  const commandLabel = document.createElement('span');
  commandLabel.className = 'codex-tool-call-command';
  commandLabel.textContent = presentation.compactCommand;
  const status = document.createElement('span');
  status.className = 'codex-tool-call-status';
  status.textContent = presentation.status;
  summary.append(actionLabel, commandLabel, status);

  const body = document.createElement('div');
  body.className = 'codex-tool-call-details';
  const fullCommand = document.createElement('code');
  fullCommand.className = 'codex-tool-call-full-command';
  fullCommand.textContent = presentation.command;
  body.append(fullCommand);
  const outputText = event.output || event.text;
  // WHAT: Append raw tool output only when the lifecycle exposes readable content.
  // WHY: Empty command starts should retain a compact disclosure body.
  if (outputText) {
    const output = document.createElement('pre');
    output.className = 'codex-tool-call-output';
    output.textContent = outputText;
    body.append(output);
  }
  details.append(summary, body);
  return details;
}

function renderToolGroup(group: ThreadRunToolGroup, threadId: string): HTMLDetailsElement {
  const groups = disclosureState('threadToolGroupDisclosureByThreadId', threadId);
  const details = document.createElement('details');
  details.className = 'codex-tool-group';
  details.dataset.toolGroupKey = group.key;
  details.open = Boolean(groups[group.key]);
  details.addEventListener('toggle', () => { groups[group.key] = details.open; });
  const summary = document.createElement('summary');
  summary.className = 'codex-tool-group-summary';
  summary.textContent = threadRunToolGroupSummary(group);
  const list = document.createElement('div');
  list.className = 'codex-tool-group-list';
  list.append(...group.tools.map((tool) => renderTool(tool, threadId)));
  details.append(summary, list);
  return details;
}

function selectedThreadCard(threadId: string): Record<string, unknown> | null {
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  // WHAT: Stop card resolution when the thread has no owning card id.
  // WHY: Searching every card cannot recover ownership without the thread-to-card mapping.
  if (!cardId) return null;
  return state.activeLedger?.cards?.find((card: Record<string, unknown>) => String(card.id ?? '') === cardId) ?? null;
}

function renderAnnouncement(threadId: string): HTMLElement {
  const activeTab = (recordState('threadActiveTabByThreadId')[threadId] ?? 'thread') as ThreadPanelTab;
  const threadPanel = document.querySelector('.thread-panel') as HTMLElement | null;
  const logPanel = document.querySelector('.thread-log-panel') as HTMLElement | null;
  const logIsActive = activeTab === 'codex-log' && !threadPanel?.hidden && !logPanel?.hidden;
  const announcement = recordState('threadRunAnnouncementByThreadId')[threadId] as { sequence?: number; text?: string } | undefined;
  const announced = recordState('threadRunAnnouncedSequenceByThreadId');
  const sequence = Number(announcement?.sequence ?? 0);
  const isNew = sequence > Number(announced[threadId] ?? 0);
  const live = document.createElement('p');
  live.className = 'codex-log-announcer';
  live.setAttribute('aria-live', logIsActive ? 'polite' : 'off');
  live.setAttribute('aria-atomic', 'true');
  live.textContent = logIsActive && isNew ? String(announcement?.text ?? '') : '';
  // WHAT: Advance the consumed sequence after constructing the active-panel announcement.
  // WHY: Rerenders must not repeat the same assistive-technology message.
  if (sequence > 0) announced[threadId] = sequence;
  return live;
}

function renderDeleteSession(input: { cardId: string; runId: string; threadId: string }): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'codex-log-session-footer';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'codex-log-delete-session terminal-button terminal-button--stop';
  button.dataset.action = 'confirm-delete-thread-codex-session';
  button.dataset.codexCardId = input.cardId;
  button.dataset.codexRunId = input.runId;
  button.dataset.threadId = input.threadId;
  button.title = 'Delete Codex session';
  button.setAttribute('aria-label', button.title);
  button.textContent = 'Delete session';
  footer.append(button);
  return footer;
}

function appendExecutionLog(input: { stream: HTMLElement; events: ThreadRunLogEvent[]; threadId: string }): void {
  for (const block of groupSequentialToolCalls(input.events)) input.stream.append(block.kind === 'tool-group' ? renderToolGroup(block, input.threadId) : renderThreadCodexLogEvent(block.event));
}

function renderQueuedWaiting(queuePosition: number | null | undefined): HTMLElement {
  const waiting = document.createElement('p');
  waiting.className = 'codex-log-waiting is-queued';
  waiting.setAttribute('role', 'status');
  const indicator = document.createElement('span');
  indicator.className = 'codex-log-queue-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.append(...[0, 1, 2].map(() => document.createElement('i')));
  const message = document.createElement('span');
  message.textContent = `Queued${Number.isInteger(queuePosition) ? ` · position ${queuePosition}` : ''}. Waiting for Codex capacity.`;
  waiting.append(indicator, message);
  return waiting;
}

type ThreadRunHistoryEntry = { runId: string; executionId: string };

function runHistoryEntries(card: Record<string, unknown>, threadId: string, summary?: CardSkillRunSummary): ThreadRunHistoryEntry[] {
  const cache = recordState('threadRunExecutionsByRunId') as Record<string, CardSkillRunExecution[]>;
  if (summary?.runId && Array.isArray(summary.executions) && summary.executions.length > 0) cache[summary.runId] = summary.executions;
  const entries = cardCodexRunIds(card).flatMap((runId) => {
    const executions = Array.isArray(cache[runId]) ? cache[runId] : [];
    return executions.length > 0
      ? executions.map((execution) => ({ runId, executionId: execution.executionId }))
      : [{ runId, executionId: '' }];
  });
  const requestedRunId = String(recordState('threadSelectedRunIdByThreadId')[threadId] ?? '');
  const requestedExecutionId = String(recordState('threadSelectedExecutionIdByThreadId')[threadId] ?? '');
  if (requestedRunId && requestedExecutionId && !entries.some((entry) => entry.runId === requestedRunId && entry.executionId === requestedExecutionId)) {
    let insertionIndex = 0;
    entries.forEach((entry, index) => {
      if (entry.runId === requestedRunId) insertionIndex = index + 1;
    });
    entries.splice(Math.max(0, insertionIndex), 0, { runId: requestedRunId, executionId: requestedExecutionId });
  }
  return entries;
}

function selectThreadCodexRun(threadId: string, entry: ThreadRunHistoryEntry): void {
  recordState('threadSelectedRunIdByThreadId')[threadId] = entry.runId;
  recordState('threadSelectedExecutionIdByThreadId')[threadId] = entry.executionId;
  recordState('threadLogScrollTopByThreadId')[threadId] = 0;
  void import('./render-thread-panel.js').then(({ renderThreadPanel }) => renderThreadPanel());
}

function renderRunNavigator(input: { entries: ThreadRunHistoryEntry[]; selected: ThreadRunHistoryEntry; threadId: string }): HTMLElement | null {
  if (input.entries.length < 2) return null;
  const index = Math.max(0, input.entries.findIndex((entry) => entry.runId === input.selected.runId && entry.executionId === input.selected.executionId));
  const navigator = document.createElement('nav');
  navigator.className = 'codex-log-run-navigator';
  navigator.setAttribute('aria-label', 'Codex run history');

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'codex-log-run-arrow codex-log-run-arrow--previous';
  previous.textContent = '←';
  previous.title = 'Previous Codex run';
  previous.setAttribute('aria-label', previous.title);
  previous.dataset.codexRunHistory = 'previous';
  previous.disabled = index === 0;
  previous.addEventListener('click', () => selectThreadCodexRun(input.threadId, input.entries[index - 1]));

  const position = document.createElement('span');
  position.className = 'codex-log-run-position';
  position.setAttribute('aria-live', 'polite');
  position.textContent = `Run ${index + 1} of ${input.entries.length}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'codex-log-run-arrow codex-log-run-arrow--next';
  next.textContent = '→';
  next.title = 'Next Codex run';
  next.setAttribute('aria-label', next.title);
  next.dataset.codexRunHistory = 'next';
  next.disabled = index === input.entries.length - 1;
  next.addEventListener('click', () => selectThreadCodexRun(input.threadId, input.entries[index + 1]));

  navigator.append(previous, position, next);
  return navigator;
}

function selectedHistoryEntry(input: { entries: ThreadRunHistoryEntry[]; runId: string; threadId: string }): ThreadRunHistoryEntry {
  const selectedExecutionIds = recordState('threadSelectedExecutionIdByThreadId');
  const requestedExecutionId = String(selectedExecutionIds[input.threadId] ?? '');
  const runEntries = input.entries.filter((entry) => entry.runId === input.runId);
  const selected = runEntries.find((entry) => entry.executionId === requestedExecutionId) ?? runEntries.at(-1) ?? { runId: input.runId, executionId: '' };
  selectedExecutionIds[input.threadId] = selected.executionId;
  return selected;
}

function executionEvents(input: { events: ThreadRunLogEvent[]; summary?: CardSkillRunSummary; executionId: string }): ThreadRunLogEvent[] {
  if (!input.executionId || !input.summary) return input.events;
  const executions = Array.isArray(input.summary.executions) ? input.summary.executions : [];
  const index = executions.findIndex((execution) => execution.executionId === input.executionId);
  // A newly accepted continuation is selected before its first status response. Never hydrate it with the prior execution's log.
  if (index < 0) return [];
  const execution = executions[index];
  const endLine = execution.endLine ?? executions[index + 1]?.startLine ?? Number.POSITIVE_INFINITY;
  return input.events.filter((event) => event.source === 'jsonl'
    ? event.line > execution.startLine && event.line <= endLine
    : index === executions.length - 1);
}

function executionSummary(summary: CardSkillRunSummary | undefined, executionId: string, events: ThreadRunLogEvent[]): CardSkillRunSummary | undefined {
  if (!summary || !executionId) return summary;
  const execution = (Array.isArray(summary.executions) ? summary.executions : []).find((candidate) => candidate.executionId === executionId);
  if (!execution) return {
    ...summary,
    executionId,
    currentExecution: null,
    startedAt: '',
    elapsedMs: 0,
    toolCallCount: 0,
    agentMessageCount: 0,
    fileChangeCount: 0,
    thinkingCount: 0,
    warningCount: 0,
    errorCount: 0,
    transportStatus: 'unknown',
    latestEvent: null,
  };
  return {
    ...summary,
    active: execution.active,
    status: execution.status,
    executionId: execution.executionId,
    currentExecution: execution,
    startedAt: execution.startedAt,
    elapsedMs: execution.elapsedMs,
    toolCallCount: execution.toolCallCount,
    agentMessageCount: execution.agentMessageCount,
    fileChangeCount: execution.fileChangeCount,
    thinkingCount: execution.thinkingCount,
    warningCount: execution.warningCount,
    errorCount: execution.errorCount,
    transportStatus: execution.transportStatus,
    latestEvent: events.at(-1) ?? null,
  };
}

export function renderThreadCodexLog(): void {
  const root = document.querySelector('.thread-codex-log') as HTMLElement | null;
  // WHAT: Skip the final DOM effect when the thread log surface is not mounted.
  // WHY: Headless and partially rendered callers may invoke the shared thread renderer.
  if (!root) return;
  const viewport = document.querySelector('.thread-log-scroll') as HTMLElement | null;
  const previousTop = Number(viewport?.scrollTop ?? 0);
  const threadId = String(state.threadId ?? '');
  const following = isThreadFollowingBottom(threadId, 'codex-log');
  const card = selectedThreadCard(threadId);
  const selectedRunIds = recordState('threadSelectedRunIdByThreadId');
  const runId = card ? selectedCardCodexRunId(card, selectedRunIds[threadId]) : '';
  if (runId) selectedRunIds[threadId] = runId;
  root.replaceChildren();
  // WHAT: Render the exact empty state when the selected thread owns no Codex run.
  // WHY: Missing ownership is distinct from an unavailable run response.
  if (!card) {
    const empty = document.createElement('p');
    empty.className = 'codex-log-empty';
    empty.textContent = 'No Codex run for this thread.';
    root.append(empty);
    return;
  }
  if (!runId) {
    const empty = document.createElement('p');
    empty.className = 'codex-log-empty';
    empty.textContent = 'No Codex run for this thread.';
    root.append(renderThreadCodexLogStatus({ summary: null, card, runId: '', threadId }), empty);
    return;
  }

  const summary = String(recordState('threadRunIdByThreadId')[threadId] ?? '') === runId
    ? recordState('threadRunSummaryByThreadId')[threadId] as CardSkillRunSummary | undefined
    : undefined;
  const events = String(recordState('threadRunIdByThreadId')[threadId] ?? '') === runId
    && Array.isArray(recordState('threadRunEventsByThreadId')[threadId])
    ? recordState('threadRunEventsByThreadId')[threadId] as ThreadRunLogEvent[]
    : [];
  const retainedRunIds = cardCodexRunIds(card);
  hydrateThreadCodexRunHistory({
    projectId: String(state.projectId ?? ''),
    ledgerId: String(state.activeLedger?.id ?? ''),
    cardId: String(card.id ?? ''),
    threadId,
    runIds: retainedRunIds.filter((retainedRunId) => retainedRunId !== runId),
  });
  const historyEntries = runHistoryEntries(card, threadId, summary);
  const selectedEntry = selectedHistoryEntry({ entries: historyEntries, runId, threadId });
  const selectedEvents = executionEvents({ events, summary, executionId: selectedEntry.executionId });
  const selectedSummary = executionSummary(summary, selectedEntry.executionId, selectedEvents);
  const navigator = renderRunNavigator({ entries: historyEntries, selected: selectedEntry, threadId });
  root.append(...[navigator, renderAnnouncement(threadId), renderThreadCodexLogStatus({ summary: selectedSummary ?? null, sessionSummary: summary ?? null, card, runId, threadId })].filter((element): element is HTMLElement => Boolean(element)));
  const stopError = threadCodexStopState(runId).error;
  if (stopError) {
    const error = document.createElement('p');
    error.className = 'codex-log-stop-error';
    error.dataset.codexLogStopError = '';
    error.setAttribute('role', 'alert');
    error.textContent = stopError;
    root.append(error);
  }
  const deleteError = threadCodexSessionDeletionState(runId).error;
  if (deleteError) {
    const error = document.createElement('p');
    error.className = 'codex-log-delete-error';
    error.dataset.codexLogDeleteError = '';
    error.setAttribute('role', 'alert');
    error.textContent = deleteError;
    root.append(error);
  }
  // WHAT: Surface an unavailable response separately from chronological run events.
  // WHY: Transport and ownership failures are not producer log records.
  if (summary?.ok === false) {
    const unavailable = document.createElement('p');
    unavailable.className = 'codex-log-unavailable';
    unavailable.textContent = summary.error || 'Codex run unavailable.';
    root.append(unavailable);
  }
  const stream = document.createElement('div');
  stream.className = 'codex-log-stream';
  appendExecutionLog({ stream, events: selectedEvents, threadId });
  // WHAT: Render a waiting state only for an available run without received events.
  // WHY: An unavailable response already provides its actionable failure message.
  if (selectedEvents.length === 0 && selectedSummary?.ok !== false) {
    const waiting = selectedSummary?.status === 'pending' ? renderQueuedWaiting(selectedSummary.queuePosition) : document.createElement('p');
    if (selectedSummary?.status !== 'pending') {
      waiting.className = 'codex-log-waiting';
      waiting.textContent = 'Waiting for Codex output.';
    }
    stream.append(waiting);
  }
  root.append(stream);
  if (summary?.status !== 'pending') root.append(renderDeleteSession({ cardId: String(card.id ?? ''), runId, threadId }));

  const restore = () => {
    // WHAT: Skip scroll restoration when the independent log viewport is absent.
    // WHY: The log content can render in isolated test and partial-DOM surfaces.
    if (!viewport) return;
    viewport.scrollTop = following ? Number(viewport.scrollHeight ?? 0) : previousTop;
    recordState('threadLogScrollTopByThreadId')[threadId] = Math.max(0, Number(viewport.scrollTop ?? 0));
    persistThreadViewportState();
  };
  restore();
  globalThis.requestAnimationFrame?.(() => restore());
}
