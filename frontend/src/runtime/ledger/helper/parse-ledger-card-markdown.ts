/**
 * WHAT: Parses markdown blocks for ledger cards and thread conversation notes.
 * WHY: Card bodies and thread notes must share one block model so markdown behavior cannot drift.
 */
import { isLedgerMarkdownTableDivider } from './is-ledger-markdown-table-divider.js';
import { normalizeLedgerMarkdown } from './normalize-ledger-markdown.js';
import { parseLedgerMarkdownInline } from './parse-ledger-markdown-inline.js';
import { parseLedgerMarkdownTableRow } from './parse-ledger-markdown-table-row.js';

export type LedgerMarkdownInline = {
  kind: 'text' | 'strong' | 'code';
  text: string;
};

export type LedgerMarkdownBlock =
  | { kind: 'heading'; level: number; children: LedgerMarkdownInline[] }
  | { kind: 'paragraph'; children: LedgerMarkdownInline[] }
  | { kind: 'list'; items: LedgerMarkdownInline[][] }
  | { kind: 'table'; headers: LedgerMarkdownInline[][]; rows: LedgerMarkdownInline[][][] }
  | { kind: 'hr' }
  | { kind: 'code'; language: string; text: string };

export function parseLedgerCardMarkdown(markdown: string): LedgerMarkdownBlock[] {
  const blocks: LedgerMarkdownBlock[] = [];
  let list: Extract<LedgerMarkdownBlock, { kind: 'list' }> | null = null;
  const lines = normalizeLedgerMarkdown(markdown).split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const fence = rawLine.match(/^```([A-Za-z0-9_+#.-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      for (; index < lines.length; index += 1) {
        if (/^```\s*$/.test(lines[index])) break;
        codeLines.push(lines[index]);
      }
      list = null;
      blocks.push({ kind: 'code', language: fence[1] ?? '', text: codeLines.join('\n') });
      continue;
    }
    const line = rawLine.trim();
    if (!line) {
      list = null;
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      list = null;
      blocks.push({ kind: 'hr' });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      list = null;
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        children: parseLedgerMarkdownInline(heading[2])
      });
      continue;
    }
    const headerCells = parseLedgerMarkdownTableRow(line);
    if (headerCells.length >= 2 && isLedgerMarkdownTableDivider(lines[index + 1] ?? '', headerCells.length)) {
      const table: Extract<LedgerMarkdownBlock, { kind: 'table' }> = {
        kind: 'table',
        headers: headerCells.map(parseLedgerMarkdownInline),
        rows: []
      };
      index += 2;
      for (; index < lines.length; index += 1) {
        const rowLine = lines[index].trim();
        if (!rowLine || isLedgerMarkdownTableDivider(rowLine)) break;
        const rowCells = parseLedgerMarkdownTableRow(rowLine);
        if (rowCells.length !== headerCells.length) break;
        table.rows.push(rowCells.map(parseLedgerMarkdownInline));
      }
      index -= 1;
      list = null;
      blocks.push(table);
      continue;
    }
    const item = line.match(/^[-*]\s+(.*)$/);
    if (item) {
      if (!list) {
        list = { kind: 'list', items: [] };
        blocks.push(list);
      }
      list.items.push(parseLedgerMarkdownInline(item[1]));
      continue;
    }
    list = null;
    blocks.push({ kind: 'paragraph', children: parseLedgerMarkdownInline(line) });
  }

  return blocks;
}
