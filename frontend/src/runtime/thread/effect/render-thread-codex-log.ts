/**
 * WHAT: Renders the selected thread's chronological Codex run log.
 * WHY: Run diagnostics belong in an inspectable, independently scrolling surface instead of conversation notes.
 */
import { cardCodexRunId } from '../../codex/helper/card-codex-run-id.js';
import { groupSequentialToolCalls, type ThreadRunLogEvent, type ThreadRunToolGroup } from '../../codex/helper/thread-run-log.js';
import { threadRunToolGroupSummary } from '../../codex/helper/thread-run-tool-group-summary.js';
import { threadRunToolPresentation } from '../../codex/helper/thread-run-tool-presentation.js';
import type { CardSkillRunSummary } from '../../codex/effect/request-card-skill-run-status.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';
import { state, type ThreadPanelTab } from '../../state.js';
import { renderThreadCodexLogEvent } from '../component/render-thread-codex-log-event.js';
import { renderThreadCodexLogStatus } from '../component/render-thread-codex-log-status.js';
import { threadCodexStopState } from '../../codex/controller/stop-thread-codex-run-controller.js';
import { threadCodexSessionDeletionState } from '../../codex/controller/delete-thread-codex-session-controller.js';

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

export function renderThreadCodexLog(): void {
  const root = document.querySelector('.thread-codex-log') as HTMLElement | null;
  // WHAT: Skip the final DOM effect when the thread log surface is not mounted.
  // WHY: Headless and partially rendered callers may invoke the shared thread renderer.
  if (!root) return;
  const viewport = document.querySelector('.thread-log-scroll') as HTMLElement | null;
  const previousTop = Number(viewport?.scrollTop ?? 0);
  const bottomDistance = Math.max(0, Number(viewport?.scrollHeight ?? 0) - Number(viewport?.clientHeight ?? 0) - previousTop);
  const wasPinned = bottomDistance <= 8;
  const threadId = String(state.threadId ?? '');
  const card = selectedThreadCard(threadId);
  const runId = card ? cardCodexRunId(card) : '';
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
  root.append(renderAnnouncement(threadId), renderThreadCodexLogStatus({ summary: summary ?? null, card, runId, threadId }));
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
  for (const block of groupSequentialToolCalls(events)) {
    stream.append(block.kind === 'tool-group' ? renderToolGroup(block, threadId) : renderThreadCodexLogEvent(block.event));
  }
  // WHAT: Render a waiting state only for an available run without received events.
  // WHY: An unavailable response already provides its actionable failure message.
  if (events.length === 0 && summary?.ok !== false) {
    const waiting = document.createElement('p');
    waiting.className = 'codex-log-waiting';
    waiting.textContent = summary?.status === 'pending'
      ? `Queued${Number.isInteger(summary.queuePosition) ? ` · position ${summary.queuePosition}` : ''}. Codex will start when capacity is available.`
      : 'Waiting for Codex output.';
    stream.append(waiting);
  }
  root.append(stream, renderDeleteSession({ cardId: String(card.id ?? ''), runId, threadId }));

  const restore = () => {
    // WHAT: Skip scroll restoration when the independent log viewport is absent.
    // WHY: The log content can render in isolated test and partial-DOM surfaces.
    if (!viewport) return;
    viewport.scrollTop = wasPinned ? Number(viewport.scrollHeight ?? 0) : previousTop;
    recordState('threadLogScrollTopByThreadId')[threadId] = Math.max(0, Number(viewport.scrollTop ?? 0));
  };
  restore();
  globalThis.requestAnimationFrame?.(() => restore());
}
