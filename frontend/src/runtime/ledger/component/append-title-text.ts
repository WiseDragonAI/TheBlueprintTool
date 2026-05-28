/**
 * WHAT: Appends inline-markdown title content while preserving card-title word breaks.
 * WHY: Titles need the same code/bold readability as card bodies without losing zoom wrap behavior.
 */
import { parseLedgerMarkdownInline } from '../helper/parse-ledger-markdown-inline.js';

export function appendTitleText(parent: HTMLElement, text: string): void {
  const heading = text.match(/^(#{1,6})\s+(.*)$/);
  delete parent.dataset.titleHeading;
  if (heading) parent.dataset.titleHeading = String(heading[1].length);
  const inlineNodes = parseLedgerMarkdownInline(heading ? heading[2] : text);
  for (const node of inlineNodes) {
    if (node.kind === 'image') {
      parent.appendChild(document.createTextNode(node.alt || node.src));
      continue;
    }
    if (node.kind !== 'text') {
      const child = document.createElement(node.kind);
      child.textContent = node.text;
      parent.appendChild(child);
      continue;
    }
    const segments = node.text.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g).filter(Boolean);
    for (const [index, segment] of segments.entries()) {
      if (index > 0) parent.appendChild(document.createElement('wbr'));
      parent.appendChild(document.createTextNode(segment));
    }
  }
}
