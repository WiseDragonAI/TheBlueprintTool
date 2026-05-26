/**
 * WHAT: Normalizes markdown text before shared ledger block parsing.
 * WHY: Agent/CLI notes can arrive with escaped newline sequences that should behave like typed markdown lines.
 */
export function normalizeLedgerMarkdown(markdown: string): string {
  return markdown.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n?/g, '\n');
}
