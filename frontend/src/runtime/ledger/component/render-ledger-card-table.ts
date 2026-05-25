import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { appendInlineNodes } from './append-inline-nodes.js';

export function renderLedgerCardTable(block: Extract<LedgerMarkdownBlock, { kind: 'table' }>): HTMLElement {
  const scroll = document.createElement('div');
  scroll.className = 'ledger-card-table-scroll';
  const table = document.createElement('table');
  table.className = 'ledger-card-table';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const cell of block.headers) {
    const th = document.createElement('th');
    appendInlineNodes(th, cell);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  const tbody = document.createElement('tbody');
  for (const row of block.rows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      appendInlineNodes(td, cell);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  scroll.appendChild(table);
  return scroll;
}
