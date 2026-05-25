import { type LedgerMarkdownInline } from '../helper/parse-ledger-card-markdown.js';

export function appendInlineNodes(parent: HTMLElement, nodes: LedgerMarkdownInline[]): void {
  for (const node of nodes) {
    if (node.kind === 'text') {
      parent.appendChild(document.createTextNode(node.text));
      continue;
    }
    const child = document.createElement(node.kind);
    child.textContent = node.text;
    parent.appendChild(child);
  }
}
