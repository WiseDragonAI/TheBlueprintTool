/**
 * WHAT: Renders one task's synchronized execution history and the selected lightweight presentation.
 * WHY: The Codex Log must address executions directly and keep the latest todo snapshot visible above the stream.
 */
import type {
  TaskExecutionPresentation,
  TaskExecutionPresentationEvent,
  TaskExecutionStateItem,
  TaskExecutionStateSummary,
  TaskExecutionSubagentEvent,
  TaskExecutionTodoEvent,
  TaskExecutionToolEvent,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';
import { bindThreadCodexRunLog } from '../../codex/effect/bind-thread-codex-run-log.js';
import { findTaskExecution } from '../../codex/helper/find-task-execution.js';
import { groupTaskExecutionPresentationEvents } from '../../codex/helper/group-task-execution-presentation-events.js';
import { taskExecutionDisplayStatus } from '../../codex/helper/task-execution-display-status.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';
import { state } from '../../state.js';
import { renderThreadCodexLogStatus, type CodexLogStatusSummary } from '../component/render-thread-codex-log-status.js';
import { renderTaskExecutionTodoOverlay } from '../component/render-task-execution-todo-overlay.js';
import { renderTaskExecutionSubagentOverlay } from '../component/render-task-execution-subagent-overlay.js';
import { threadCodexStopState } from '../../codex/controller/stop-thread-codex-run-controller.js';
import { threadCodexSessionDeletionState } from '../../codex/controller/delete-thread-codex-session-controller.js';

type HistoryEntry = { sessionId: string; executionId: string };
type DisclosureByThread = Record<string, Record<string, boolean>>;

function recordState(name: string): Record<string, any> {
  // WHAT: Repair presentation state maps when restoring a pre-cutover browser session.
  // WHY: Rendering must tolerate state captured before the task execution projection existed.
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function disclosureState(name: string, threadId: string): Record<string, boolean> {
  const byThread = recordState(name) as DisclosureByThread;
  if (!byThread[threadId] || typeof byThread[threadId] !== 'object') byThread[threadId] = {};
  return byThread[threadId];
}

function selectedThreadCard(threadId: string): Record<string, unknown> | null {
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  if (!cardId) return null;
  return state.activeLedger?.cards?.find((card: Record<string, unknown>) => String(card.id ?? '') === cardId) ?? null;
}

function historyEntries(summary: TaskExecutionStateSummary | null): HistoryEntry[] {
  return summary?.sessions.flatMap((session) => session.executions.map((execution) => ({
    sessionId: session.sessionId,
    executionId: execution.executionId,
  }))) ?? [];
}

function elapsedMs(execution: TaskExecutionStateItem): number {
  const start = Date.parse(execution.startedAt ?? execution.requestedAt);
  const end = execution.finishedAt ? Date.parse(execution.finishedAt) : Date.now();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}

function statusSummary(input: {
  execution: TaskExecutionStateItem | null;
  presentation: TaskExecutionPresentation | null;
  card: Record<string, unknown>;
}): CodexLogStatusSummary | null {
  if (!input.execution) return null;
  const counts = input.presentation?.execution.executionId === input.execution.executionId
    ? input.presentation.execution.counts
    : { tools: 0, warnings: 0, errors: 0 };
  const status = taskExecutionDisplayStatus(input.execution.phase);
  return {
    ok: true,
    active: status === 'pending' || status === 'running',
    status,
    runId: input.execution.sessionId,
    executionId: input.execution.executionId,
    runKind: input.execution.kind === 'pipeline-skill' ? 'card' : 'thread',
    startedAt: input.execution.startedAt ?? input.execution.requestedAt,
    elapsedMs: elapsedMs(input.execution),
    queuePosition: input.execution.queuePosition,
    metadata: {
      codexModel: input.execution.model ?? '',
      codexEffort: input.execution.effort ?? '',
    },
    toolCallCount: counts.tools,
    warningCount: counts.warnings,
    errorCount: counts.errors,
    transportStatus: input.presentation?.events.some((event) => event.kind === 'transport') ? 'degraded' : 'ok',
    pipelineRunId: input.execution.kind === 'pipeline-skill'
      ? String(input.card.codexPipelineRunId ?? '') || null
      : null,
    pipelineName: String(input.card.codexPipelineName ?? ''),
    pipelineStatus: String(input.card.codexPipelineStatus ?? ''),
    pipelineStepName: String(input.card.codexPipelineStepName ?? ''),
    skillName: String(input.card.codexSkillName ?? ''),
  };
}

function renderRunNavigator(input: {
  entries: HistoryEntry[];
  selectedExecutionId: string;
  card: Record<string, unknown>;
  threadId: string;
}): HTMLElement | null {
  if (input.entries.length < 2) return null;
  const index = Math.max(0, input.entries.findIndex((entry) => entry.executionId === input.selectedExecutionId));
  const navigator = document.createElement('nav');
  navigator.className = 'codex-log-run-navigator';
  navigator.setAttribute('aria-label', 'Codex execution history');
  const select = (entry: HistoryEntry): void => {
    recordState('threadSelectedExecutionIdByThreadId')[input.threadId] = entry.executionId;
    recordState('threadSelectedRunIdByThreadId')[input.threadId] = entry.sessionId;
    recordState('threadLogScrollTopByThreadId')[input.threadId] = 0;
    // WHAT: Revalidate the exact selected execution without requesting the surrounding session log.
    // WHY: History navigation must never fall back to latest-execution inference.
    bindThreadCodexRunLog({
      projectId: String(state.projectId ?? ''),
      replicaNodeId: String(state.replicaNodeId ?? ''),
      ledgerId: String(state.activeTab ?? ''),
      cardId: String(input.card.id ?? ''),
      threadId: input.threadId,
      runId: entry.sessionId,
      expectedExecutionId: entry.executionId,
      forceRevalidate: true,
    });
    renderThreadCodexLog();
  };
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'codex-log-run-arrow codex-log-run-arrow--previous';
  previous.textContent = '←';
  previous.title = 'Previous Codex execution';
  previous.setAttribute('aria-label', previous.title);
  previous.disabled = index === 0;
  previous.addEventListener('click', () => select(input.entries[index - 1]));
  const position = document.createElement('span');
  position.className = 'codex-log-run-position';
  position.setAttribute('aria-live', 'polite');
  position.textContent = `Execution ${index + 1} of ${input.entries.length}`;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'codex-log-run-arrow codex-log-run-arrow--next';
  next.textContent = '→';
  next.title = 'Next Codex execution';
  next.setAttribute('aria-label', next.title);
  next.disabled = index === input.entries.length - 1;
  next.addEventListener('click', () => select(input.entries[index + 1]));
  navigator.append(previous, position, next);
  return navigator;
}

function renderTool(event: TaskExecutionToolEvent, threadId: string): HTMLElement {
  const rows = disclosureState('threadToolRowDisclosureByThreadId', threadId);
  const details = document.createElement('details');
  details.className = 'codex-tool-call';
  details.dataset.runStatus = event.status || 'pending';
  details.open = Boolean(rows[event.id]);
  details.addEventListener('toggle', () => { rows[event.id] = details.open; });
  const summary = document.createElement('summary');
  summary.className = 'codex-tool-call-summary';
  const action = document.createElement('span');
  action.className = 'codex-tool-call-action';
  action.textContent = 'Tool';
  const command = document.createElement('span');
  command.className = 'codex-tool-call-command';
  command.textContent = event.command;
  const status = document.createElement('span');
  status.className = 'codex-tool-call-status';
  status.textContent = [event.status, event.exitCode ? `code ${event.exitCode}` : ''].filter(Boolean).join(' / ');
  summary.append(action, command, status);
  const body = document.createElement('div');
  body.className = 'codex-tool-call-details';
  const fullCommand = document.createElement('code');
  fullCommand.className = 'codex-tool-call-full-command';
  fullCommand.textContent = event.command;
  // WHAT: Render command metadata without a result body.
  // WHY: Tool stdout and stderr remain backend artifacts and must not inflate the presentation.
  body.append(fullCommand);
  details.append(summary, body);
  return details;
}

function renderToolGroup(input: {
  id: string;
  tools: readonly TaskExecutionToolEvent[];
  threadId: string;
}): HTMLElement {
  const groups = disclosureState('threadToolGroupDisclosureByThreadId', input.threadId);
  const details = document.createElement('details');
  details.className = 'codex-tool-group';
  details.dataset.toolGroupKey = input.id;
  details.open = Boolean(groups[input.id]);
  details.addEventListener('toggle', () => { groups[input.id] = details.open; });
  const summary = document.createElement('summary');
  summary.className = 'codex-tool-group-summary';
  const settled = input.tools.filter((tool) => /complete|failed|cancel/i.test(tool.status)).length;
  summary.textContent = `${input.tools.length} tool call${input.tools.length === 1 ? '' : 's'} · ${settled}/${input.tools.length} settled`;
  const list = document.createElement('div');
  list.className = 'codex-tool-group-list';
  list.append(...input.tools.map((tool) => renderTool(tool, input.threadId)));
  details.append(summary, list);
  return details;
}

function renderPresentationEvent(
  event: Exclude<TaskExecutionPresentationEvent, TaskExecutionToolEvent>,
  subagentExecution: TaskExecutionStateItem | null = null,
): HTMLElement {
  const startDisclosure = event.kind === 'run_status'
    && (event.title === 'Thread started' || event.title === 'Turn started');
  const article = document.createElement(startDisclosure ? 'details' : 'article');
  article.className = `codex-log-event is-${event.kind} is-${event.severity}`;
  if (startDisclosure) article.classList.add('is-start-disclosure');
  article.dataset.eventKey = event.id;
  const heading = document.createElement(startDisclosure ? 'summary' : 'div');
  heading.className = 'codex-log-event-heading';
  const title = document.createElement('strong');
  title.textContent = event.title || event.kind;
  const status = document.createElement('span');
  const displayStatus = event.kind === 'subagent' && subagentExecution
    ? taskExecutionDisplayStatus(subagentExecution.phase)
    : event.status;
  status.textContent = displayStatus;
  status.hidden = !displayStatus;
  heading.append(title, status);
  article.append(heading);
  if (event.kind === 'file_change') {
    const list = document.createElement('ul');
    list.className = 'codex-log-event-body';
    for (const file of event.files) {
      const item = document.createElement('li');
      item.textContent = `${file.path}: ${file.action}`;
      list.append(item);
    }
    article.append(list);
  } else if (event.kind === 'subagent') {
    const body = document.createElement('div');
    body.className = 'codex-log-event-body codex-subagent-event-body';
    const skill = document.createElement('strong');
    skill.textContent = event.skillName;
    const configuration = document.createElement('span');
    configuration.textContent = [event.model, event.effort].filter(Boolean).join(' · ');
    body.append(skill, configuration);
    article.append(body);
  } else if (event.kind !== 'todo_list' && event.text) {
    const body = renderLedgerCardMarkdown(event.text);
    body.classList.add('codex-log-event-body');
    article.append(body);
  }
  return article;
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

function renderQueuedWaiting(queuePosition: number | null): HTMLElement {
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

export function renderThreadCodexLog(): void {
  const root = document.querySelector('.thread-codex-log') as HTMLElement | null;
  if (!root) return;
  const threadId = String(state.threadId ?? '');
  const card = selectedThreadCard(threadId);
  root.replaceChildren();
  if (!card) {
    const empty = document.createElement('p');
    empty.className = 'codex-log-empty';
    empty.textContent = 'No Codex run for this thread.';
    root.append(empty);
    return;
  }
  const taskSummary = (recordState('threadTaskExecutionStateByThreadId')[threadId] as TaskExecutionStateSummary | undefined) ?? null;
  const entries = historyEntries(taskSummary);
  if (taskSummary && entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'codex-log-empty';
    empty.textContent = 'No Codex run for this thread.';
    root.append(empty);
    return;
  }
  const requestedExecutionId = String(recordState('threadSelectedExecutionIdByThreadId')[threadId] ?? '');
  const selectedExecutionId = findTaskExecution(taskSummary, requestedExecutionId)
    ? requestedExecutionId
    : String(taskSummary?.defaultExecutionId ?? '');
  if (selectedExecutionId) recordState('threadSelectedExecutionIdByThreadId')[threadId] = selectedExecutionId;
  const selectedExecution = findTaskExecution(taskSummary, selectedExecutionId);
  const presentation = (recordState('threadExecutionPresentationByThreadId')[threadId] as TaskExecutionPresentation | undefined) ?? null;
  const selectedPresentation = presentation?.execution.executionId === selectedExecutionId ? presentation : null;
  const activeExecution = taskSummary?.activeExecutionIds
    .map((executionId) => findTaskExecution(taskSummary, executionId))
    .filter((execution): execution is TaskExecutionStateItem => Boolean(execution))
    .at(-1) ?? null;
  const selectedStatus = statusSummary({ execution: selectedExecution, presentation: selectedPresentation, card });
  const activeStatus = statusSummary({
    execution: activeExecution,
    presentation: activeExecution?.executionId === selectedExecutionId ? selectedPresentation : null,
    card,
  });
  const navigator = renderRunNavigator({ entries, selectedExecutionId, card, threadId });
  const stickyHeader = document.createElement('div');
  stickyHeader.className = 'codex-log-sticky-header';
  stickyHeader.append(...[
    navigator,
    renderThreadCodexLogStatus({
      summary: selectedStatus,
      sessionSummary: activeStatus,
      card,
      runId: selectedExecution?.sessionId ?? '',
      threadId,
    }),
  ].filter((element): element is HTMLElement => Boolean(element)));
  const actionRunId = activeExecution?.sessionId ?? selectedExecution?.sessionId ?? '';
  const stopError = threadCodexStopState(actionRunId).error;
  const readError = String(recordState('threadExecutionStateErrorByThreadId')[threadId]
    ?? recordState('threadExecutionPresentationErrorByThreadId')[threadId]
    ?? '');
  if (stopError || readError) {
    const error = document.createElement('p');
    error.className = readError ? 'codex-log-unavailable' : 'codex-log-stop-error';
    error.setAttribute('role', 'alert');
    error.textContent = stopError || readError;
    root.append(error);
  }
  const deleteError = threadCodexSessionDeletionState(selectedExecution?.sessionId ?? '').error;
  if (deleteError) {
    const error = document.createElement('p');
    error.className = 'codex-log-delete-error';
    error.setAttribute('role', 'alert');
    error.textContent = deleteError;
    root.append(error);
  }
  const todo = [...(selectedPresentation?.events ?? [])].reverse()
    .find((event): event is TaskExecutionTodoEvent => event.kind === 'todo_list');
  const subagentEvents = (selectedPresentation?.events ?? [])
    .filter((event): event is TaskExecutionSubagentEvent => event.kind === 'subagent');
  const childExecutions = taskSummary?.sessions
    .flatMap((session) => session.executions)
    .filter((execution) => execution.predecessorExecutionId === selectedExecutionId)
    .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt)) ?? [];
  const subagentExecutionByEventId = new Map(subagentEvents.map((event, index) => [
    event.id,
    childExecutions[index] ?? null,
  ]));
  if (subagentEvents.length > 0) {
    stickyHeader.append(renderTaskExecutionSubagentOverlay(subagentEvents.map((event, index) => ({
      event,
      execution: childExecutions[index] ?? null,
    }))));
  }
  if (todo) stickyHeader.append(renderTaskExecutionTodoOverlay(todo));
  root.prepend(stickyHeader);
  const stream = document.createElement('div');
  stream.className = 'codex-log-stream';
  for (const block of groupTaskExecutionPresentationEvents(
    (selectedPresentation?.events ?? []).filter((event) => event.kind !== 'todo_list'),
  )) {
    stream.append(block.kind === 'tool-group'
      ? renderToolGroup({ id: block.id, tools: block.tools, threadId })
      : renderPresentationEvent(
        block.event as Exclude<TaskExecutionPresentationEvent, TaskExecutionToolEvent>,
        block.event.kind === 'subagent' ? subagentExecutionByEventId.get(block.event.id) ?? null : null,
      ));
  }
  if (selectedExecution?.phase === 'queued'
    && (!selectedPresentation || selectedPresentation.events.length === 0)) {
    stream.append(renderQueuedWaiting(selectedExecution.queuePosition));
  } else if (!selectedPresentation && !readError) {
    const waiting = document.createElement('p');
    waiting.className = 'codex-log-waiting';
    waiting.textContent = entries.length > 0 ? 'Loading Codex output.' : 'No Codex execution for this task.';
    stream.append(waiting);
  } else if (selectedPresentation && selectedPresentation.events.filter((event) => event.kind !== 'todo_list').length === 0) {
    const waiting = document.createElement('p');
    waiting.className = 'codex-log-waiting';
    waiting.textContent = 'Waiting for Codex output.';
    stream.append(waiting);
  }
  root.append(stream);
  if (selectedExecution
    && selectedExecution.kind !== 'pipeline-skill'
    && !['preparing', 'queued', 'starting', 'running', 'cancelling'].includes(selectedExecution.phase)) {
    root.append(renderDeleteSession({
      cardId: String(card.id ?? ''),
      runId: selectedExecution.sessionId,
      threadId,
    }));
  }
}
