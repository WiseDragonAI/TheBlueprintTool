/**
 * WHAT: Renders the shared markdown body used by cards and thread notes.
 * WHY: Markdown display must stay canonical across the canvas and the conversation ledger.
 */
import { appendInlineNodes } from './append-inline-nodes.js';
import { parseLedgerCardMarkdown } from '../helper/parse-ledger-card-markdown.js';
import { renderLedgerCardCodeBlock } from './render-ledger-card-code-block.js';
import { renderLedgerCardMedia, type LedgerCardImageSizes } from './render-ledger-card-media.js';
import { renderLedgerCardTable } from './render-ledger-card-table.js';

type LedgerCardMarkdownOptions = {
  cardId?: string;
  imageSizes?: LedgerCardImageSizes;
};

export function renderLedgerCardMarkdown(markdown: string, options: LedgerCardMarkdownOptions = {}): HTMLElement {
  const body = document.createElement('div');
  body.className = 'ledger-card-body';

  for (const block of parseLedgerCardMarkdown(markdown)) {
    if (block.kind === 'heading') {
      const heading = document.createElement(`h${Math.min(6, Math.max(1, block.level))}`);
      heading.className = `ledger-card-heading ledger-card-heading-${block.level}`;
      appendInlineNodes(heading, block.children, options);
      body.appendChild(heading);
      continue;
    }
    if (block.kind === 'list') {
      const list = document.createElement('ul');
      for (const item of block.items) {
        const li = document.createElement('li');
        appendInlineNodes(li, item, options);
        list.appendChild(li);
      }
      body.appendChild(list);
      continue;
    }
    if (block.kind === 'table') {
      body.appendChild(renderLedgerCardTable(block, options));
      continue;
    }
    if (block.kind === 'images') {
      body.appendChild(renderLedgerCardMedia(block, options));
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
    appendInlineNodes(paragraph, block.children, options);
    body.appendChild(paragraph);
  }

  return body;
}
