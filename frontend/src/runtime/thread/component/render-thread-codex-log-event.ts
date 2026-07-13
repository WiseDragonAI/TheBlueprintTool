/**
 * WHAT: Renders one normalized non-tool Codex Log event.
 * WHY: Event DOM creation belongs to a component while the log effect owns stream replacement.
 */
import type { ThreadRunLogEvent } from '../../codex/helper/thread-run-log.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';
import { codexTodoListItems } from '../../codex/helper/codex-todo-list-items.js';

function renderTodoList(event: ThreadRunLogEvent): HTMLElement | null {
  const items = codexTodoListItems(event.output);
  if (items.length === 0) return null;
  const list = document.createElement('ol');
  list.className = 'codex-todo-list';
  for (const item of items) {
    const row = document.createElement('li');
    row.className = item.completed ? 'is-completed' : 'is-pending';
    const marker = document.createElement('span');
    marker.className = 'codex-todo-list-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = item.completed ? '✓' : '○';
    const label = document.createElement('span');
    label.textContent = item.text;
    row.append(marker, label);
    list.append(row);
  }
  return list;
}

export function renderThreadCodexLogEvent(event: ThreadRunLogEvent): HTMLElement {
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
  // WHAT: Render a Markdown body only when the event carries readable content.
  // WHY: Empty lifecycle markers should retain a compact single-row presentation.
  if (event.text) {
    const body = event.kind === 'todo_list' ? renderTodoList(event) ?? renderLedgerCardMarkdown(event.text) : renderLedgerCardMarkdown(event.text);
    body.classList.add('codex-log-event-body');
    article.append(body);
  }
  return article;
}
