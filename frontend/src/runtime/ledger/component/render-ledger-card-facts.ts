/**
 * WHAT: Renders structured card facts as a Markdown-aware list.
 * WHY: Canvas and responsive cards must share one safe fact presentation boundary.
 */
import { parseLedgerMarkdownInline } from '../helper/parse-ledger-markdown-inline.js';
import { appendInlineNodes } from './append-inline-nodes.js';

export function renderLedgerCardFacts(facts: readonly string[], className = 'ledger-card-facts'): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = className;
  // WHAT: Parse each fact with the existing inline Markdown subset before appending it to its list item.
  // WHY: Facts must render supported formatting while retaining the established text-node safety boundary.
  for (const fact of facts) {
    const item = document.createElement('li');
    appendInlineNodes(item, parseLedgerMarkdownInline(fact));
    list.appendChild(item);
  }
  return list;
}
