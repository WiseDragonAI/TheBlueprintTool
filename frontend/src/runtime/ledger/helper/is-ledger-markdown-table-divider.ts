import { parseLedgerMarkdownTableRow } from './parse-ledger-markdown-table-row.js';

export function isLedgerMarkdownTableDivider(line: string, expectedCells = 0): boolean {
  const cells = parseLedgerMarkdownTableRow(line);
  if (cells.length < 2) return false;
  if (expectedCells > 0 && cells.length !== expectedCells) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}
