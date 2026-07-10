/**
 * WHAT: Renders one normalized non-tool Codex Log event.
 * WHY: Event DOM creation belongs to a component while the log effect owns stream replacement.
 */
import type { ThreadRunLogEvent } from '../../codex/helper/thread-run-log.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';

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
    const body = renderLedgerCardMarkdown(event.text);
    body.classList.add('codex-log-event-body');
    article.append(body);
  }
  return article;
}
