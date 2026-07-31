/**
 * WHAT: Normalizes markdown text before shared ledger block parsing.
 * WHY: Agent/CLI notes can arrive with escaped newline sequences that should behave like typed markdown lines.
 */
export function normalizeLedgerMarkdown(markdown: string): string {
  return normalizeLedgerMarkdownWithSourceMap(markdown).markdown;
}

export function normalizeLedgerMarkdownWithSourceMap(source: string): {
  markdown: string;
  sourceOffset(normalizedOffset: number): number;
} {
  // WHAT: Return an identity source map when the authored bytes need no newline normalization.
  // WHY: Building one boundary entry per byte blocks the input thread at the admitted 1,000,000-byte ceiling.
  if (!source.includes('\\n') && !source.includes('\r')) {
    return {
      markdown: source,
      sourceOffset: (normalizedOffset) => Math.max(0, Math.min(normalizedOffset, source.length)),
    };
  }
  let markdown = '';
  const boundaries = [0];
  for (let index = 0; index < source.length;) {
    let consumed = 1;
    let value = source[index];
    if (source.startsWith('\\r\\n', index)) {
      consumed = 4;
      value = '\n';
    } else if (source.startsWith('\\n', index)) {
      consumed = 2;
      value = '\n';
    } else if (source.startsWith('\r\n', index)) {
      consumed = 2;
      value = '\n';
    } else if (source[index] === '\r') {
      value = '\n';
    }
    markdown += value;
    index += consumed;
    boundaries.push(index);
  }
  return {
    markdown,
    sourceOffset: (normalizedOffset) => boundaries[Math.max(0, Math.min(normalizedOffset, boundaries.length - 1))],
  };
}
