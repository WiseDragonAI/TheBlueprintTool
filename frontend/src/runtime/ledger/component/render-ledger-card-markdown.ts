/**
 * WHAT: Renders the shared markdown body used by cards and thread notes.
 * WHY: Markdown display must stay canonical across the canvas and the conversation ledger.
 */
import { appendInlineNodes } from './append-inline-nodes.js';
import { parseLedgerCardMarkdown } from '../helper/parse-ledger-card-markdown.js';
import { renderLedgerCardCodeBlock } from './render-ledger-card-code-block.js';
import { renderLedgerCardTable } from './render-ledger-card-table.js';

export function renderLedgerCardMarkdown(markdown: string): HTMLElement {
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
    if (block.kind === 'table') {
      body.appendChild(renderLedgerCardTable(block));
      continue;
    }
    if (block.kind === 'code') {
      body.appendChild(renderLedgerCardCodeBlock(block));
      continue;
    }
    if (block.kind === 'hr') {
      const rule = document.createElement('hr');
      rule.className = 'ledger-card-hr';
      body.appendChild(rule);
      continue;
    }
    const paragraph = document.createElement('p');
    appendInlineNodes(paragraph, block.children);
    body.appendChild(paragraph);
  }

  return body;
}
