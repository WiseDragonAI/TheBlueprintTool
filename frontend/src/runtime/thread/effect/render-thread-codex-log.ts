/**
 * WHAT: Renders the selected thread's chronological Codex run log.
 * WHY: Run diagnostics belong in an inspectable, independently scrolling surface instead of conversation notes.
 */
import { cardCodexRunId } from '../../codex/helper/card-codex-run-id.js';
import { groupSequentialToolCalls, type ThreadRunLogEvent, type ThreadRunToolGroup } from '../../codex/helper/thread-run-log.js';
import { codexRunDurationLabel, liveCodexRunElapsedMs } from '../../codex/helper/live-codex-run-elapsed-ms.js';
import type { CardSkillRunSummary } from '../../codex/effect/request-card-skill-run-status.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';
import { state, type ThreadPanelTab } from '../../state.js';

type DisclosureByThread = Record<string, Record<string, boolean>>;

function recordState(name: string): Record<string, any> {
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function disclosureState(name: string, threadId: string): Record<string, boolean> {
  const byThread = recordState(name) as DisclosureByThread;
  if (!byThread[threadId] || typeof byThread[threadId] !== 'object') byThread[threadId] = {};
  return byThread[threadId];
}

function compactText(value: string, maxLength = 108): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const head = Math.max(22, Math.floor(maxLength * 0.64));
  const tail = Math.max(12, maxLength - head - 5);
  return `${text.slice(0, head).trimEnd()} ... ${text.slice(-tail).trimStart()}`;
}

function stripOuterQuotes(value: string): string {
  const text = value.trim();
  const quote = text[0];
  return (quote === '"' || quote === "'") && text.endsWith(quote) ? text.slice(1, -1).trim() : text;
}

function displayCommand(value: string): string {
  const command = value.replace(/\s+/g, ' ').trim();
  const shell = command.match(/^(?:\/usr\/bin\/env\s+)?(?:\/[^\s]+\/)?(?:zsh|bash|sh)\s+-lc\s+(.+)$/);
  return shell?.[1] ? stripOuterQuotes(shell[1]) : command || 'command';
}

function commandHasToken(command: string, tokens: string[]): boolean {
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(^|[\\s;&|()])(?:${escaped})(?=\\s|$)`, 'i').test(command);
}

function toolAction(command: string): string {
  if (commandHasToken(command, ['git', 'gh'])) return 'Git';
  if (commandHasToken(command, ['rg', 'grep', 'find', 'fd'])) return 'Search';
  if (commandHasToken(command, ['apply_patch', 'tee', 'touch', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'chown'])) return 'Write';
  if (commandHasToken(command, ['cat', 'sed', 'nl', 'head', 'tail', 'less', 'wc'])) return 'Read';
  return 'Ran';
}

function statusText(event: ThreadRunLogEvent): string {
  const parts = [event.status];
  if (event.exitCode) parts.push(`code ${event.exitCode}`);
  return parts.filter(Boolean).join(' / ') || 'pending';
}

function renderTool(event: ThreadRunLogEvent, threadId: string): HTMLDetailsElement {
  const command = displayCommand(event.tool || event.title);
  const action = toolAction(command);
  const rows = disclosureState('threadToolRowDisclosureByThreadId', threadId);
  const details = document.createElement('details');
  details.className = 'codex-tool-call';
  details.dataset.toolKey = event.toolKey;
  details.dataset.runStatus = event.status || 'pending';
  details.open = Boolean(rows[event.toolKey]);
  details.addEventListener('toggle', () => { rows[event.toolKey] = details.open; });

  const summary = document.createElement('summary');
  summary.className = 'codex-tool-call-summary';
  summary.title = command;
  const actionLabel = document.createElement('span');
  actionLabel.className = 'codex-tool-call-action';
  actionLabel.textContent = action;
  const commandLabel = document.createElement('span');
  commandLabel.className = 'codex-tool-call-command';
  commandLabel.textContent = compactText(command);
  const status = document.createElement('span');
  status.className = 'codex-tool-call-status';
  status.textContent = statusText(event);
  summary.append(actionLabel, commandLabel, status);

  const body = document.createElement('div');
  body.className = 'codex-tool-call-details';
  const fullCommand = document.createElement('code');
  fullCommand.className = 'codex-tool-call-full-command';
  fullCommand.textContent = command;
  body.append(fullCommand);
  const outputText = event.output || event.text;
  if (outputText) {
    const output = document.createElement('pre');
    output.className = 'codex-tool-call-output';
    output.textContent = outputText;
    body.append(output);
  }
  details.append(summary, body);
  return details;
}

function groupSummary(group: ThreadRunToolGroup): string {
  const count = group.tools.length;
  const statuses = new Map<string, number>();
  for (const tool of group.tools) {
    const status = tool.status || 'pending';
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
  }
  const counts = [...statuses.entries()].map(([status, value]) => `${value} ${status}`).join(' · ');
  return `${count} ${count === 1 ? 'tool' : 'tools'}${counts ? ` · ${counts}` : ''}`;
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
  summary.textContent = groupSummary(group);
  const list = document.createElement('div');
  list.className = 'codex-tool-group-list';
  list.append(...group.tools.map((tool) => renderTool(tool, threadId)));
  details.append(summary, list);
  return details;
}

function renderEvent(event: ThreadRunLogEvent): HTMLElement {
  const article = document.createElement('article');
  article.className = `codex-log-event is-${event.kind.replace(/[^a-z0-9_-]+/gi, '-')} is-${event.severity}`;
  article.dataset.eventKey = event.eventKey;
  const heading = document.createElement('div');
  heading.className = 'codex-log-event-heading';
  const title = document.createElement('strong');
  title.textContent = event.title || event.kind || event.type || 'Codex event';
  const status = document.createElement('span');
  status.textContent = event.status;
  status.hidden = !event.status;
  heading.append(title, status);
  article.append(heading);
  if (event.text) {
    const body = renderLedgerCardMarkdown(event.text);
    body.classList.add('codex-log-event-body');
    article.append(body);
  }
  return article;
}

function selectedThreadCard(threadId: string): Record<string, unknown> | null {
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  if (!cardId) return null;
  return state.activeLedger?.cards?.find((card: Record<string, unknown>) => String(card.id ?? '') === cardId) ?? null;
}

function renderStatus(input: { summary: CardSkillRunSummary | null; card: Record<string, unknown>; runId: string }): HTMLElement {
  const summary = input.summary;
  const status = summary?.ok === false ? 'unavailable' : summary?.status ?? 'running';
  const strip = document.createElement('dl');
  strip.className = 'codex-log-status';
  strip.dataset.runStatus = status;
  strip.dataset.runId = input.runId;
  const values: Array<[string, string, string?]> = [
    ['Status', status],
    ['Model', summary?.metadata.codexModel || String(input.card.codexRunModel ?? '') || '—'],
    ['Effort', summary?.metadata.codexEffort || String(input.card.codexRunEffort ?? '') || '—'],
    ['Elapsed', codexRunDurationLabel(summary ? liveCodexRunElapsedMs(summary) : 0), 'codex-log-elapsed'],
    ['Tools', String(summary?.toolCallCount ?? 0)],
  ];
  for (const [label, value, dataName] of values) {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    if (dataName) description.setAttribute(`data-${dataName}`, '');
    item.append(term, description);
    strip.append(item);
  }
  if ((summary?.warningCount ?? 0) > 0 || (summary?.errorCount ?? 0) > 0 || summary?.transportStatus === 'degraded') {
    const diagnostics = document.createElement('div');
    diagnostics.className = 'codex-log-diagnostic-summary';
    const term = document.createElement('dt');
    term.textContent = 'Diagnostics';
    const description = document.createElement('dd');
    description.textContent = [
      summary.warningCount ? `${summary.warningCount} warning${summary.warningCount === 1 ? '' : 's'}` : '',
      summary.errorCount ? `${summary.errorCount} error${summary.errorCount === 1 ? '' : 's'}` : '',
      summary.transportStatus === 'degraded' ? 'transport degraded' : '',
    ].filter(Boolean).join(' · ');
    diagnostics.append(term, description);
    strip.append(diagnostics);
  }
  return strip;
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
  if (sequence > 0) announced[threadId] = sequence;
  return live;
}

export function renderThreadCodexLog(): void {
  const root = document.querySelector('.thread-codex-log') as HTMLElement | null;
  if (!root) return;
  const viewport = document.querySelector('.thread-log-scroll') as HTMLElement | null;
  const previousTop = Number(viewport?.scrollTop ?? 0);
  const bottomDistance = Math.max(0, Number(viewport?.scrollHeight ?? 0) - Number(viewport?.clientHeight ?? 0) - previousTop);
  const wasPinned = bottomDistance <= 8;
  const threadId = String(state.threadId ?? '');
  const card = selectedThreadCard(threadId);
  const runId = card ? cardCodexRunId(card) : '';
  root.replaceChildren();
  if (!runId || !card) {
    const empty = document.createElement('p');
    empty.className = 'codex-log-empty';
    empty.textContent = 'No Codex run for this thread.';
    root.append(empty);
    return;
  }

  const summary = String(recordState('threadRunIdByThreadId')[threadId] ?? '') === runId
    ? recordState('threadRunSummaryByThreadId')[threadId] as CardSkillRunSummary | undefined
    : undefined;
  const events = String(recordState('threadRunIdByThreadId')[threadId] ?? '') === runId
    && Array.isArray(recordState('threadRunEventsByThreadId')[threadId])
    ? recordState('threadRunEventsByThreadId')[threadId] as ThreadRunLogEvent[]
    : [];
  root.append(renderAnnouncement(threadId), renderStatus({ summary: summary ?? null, card, runId }));
  if (summary?.ok === false) {
    const unavailable = document.createElement('p');
    unavailable.className = 'codex-log-unavailable';
    unavailable.textContent = summary.error || 'Codex run unavailable.';
    root.append(unavailable);
  }
  const stream = document.createElement('div');
  stream.className = 'codex-log-stream';
  for (const block of groupSequentialToolCalls(events)) {
    stream.append(block.kind === 'tool-group' ? renderToolGroup(block, threadId) : renderEvent(block.event));
  }
  if (events.length === 0 && summary?.ok !== false) {
    const waiting = document.createElement('p');
    waiting.className = 'codex-log-waiting';
    waiting.textContent = 'Waiting for Codex output.';
    stream.append(waiting);
  }
  root.append(stream);

  const restore = () => {
    if (!viewport) return;
    viewport.scrollTop = wasPinned ? Number(viewport.scrollHeight ?? 0) : previousTop;
    recordState('threadLogScrollTopByThreadId')[threadId] = Math.max(0, Number(viewport.scrollTop ?? 0));
  };
  restore();
  globalThis.requestAnimationFrame?.(() => restore());
}
