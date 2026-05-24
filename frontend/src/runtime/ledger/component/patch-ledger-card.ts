import { ledgerCardBody } from '../helper/ledger-card-body.js';
import { type LedgerMarkdownInline, parseLedgerCardMarkdown } from '../helper/parse-ledger-card-markdown.js';

function renderLedgerCardMarkdown(markdown: string): HTMLElement {
  const body = document.createElement('div');
  body.className = 'ledger-card-body';

  for (const block of parseLedgerCardMarkdown(markdown)) {
    if (block.kind === 'list') {
      const list = document.createElement('ul');
      for (const item of block.items) {
        const li = document.createElement('li');
        appendInlineNodes(li, item);
        list.appendChild(li);
      }
      body.appendChild(list);
      continue;
    }
    const paragraph = document.createElement('p');
    appendInlineNodes(paragraph, block.children);
    body.appendChild(paragraph);
  }

  return body;
}

function appendInlineNodes(parent: HTMLElement, nodes: LedgerMarkdownInline[]): void {
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

export function patchLedgerCard(card: Record<string, unknown>, existing?: HTMLElement | null): HTMLElement {
  const element = existing ?? document.createElement('article');
  const id = String(card.id ?? '');
  element.className = 'card ledger-node';
  element.dataset.cardId = id;
  element.dataset.threadId = `thread-${id}`;
  element.dataset.ledgerNode = 'card';
  element.style.left = `${Number(card.x ?? 0)}px`;
  element.style.top = `${Number(card.y ?? 0)}px`;
  element.style.width = `${Math.max(220, Number(card.w ?? 280))}px`;
  const hash = document.createElement('span');
  hash.className = 'hash';
  hash.textContent = `#${id}`;
  const title = document.createElement('strong');
  title.className = 'ledger-card-title';
  title.textContent = String(card.title ?? id);
  const body = renderLedgerCardMarkdown(ledgerCardBody(card));
  element.replaceChildren(hash, title, body);
  return element;
}
