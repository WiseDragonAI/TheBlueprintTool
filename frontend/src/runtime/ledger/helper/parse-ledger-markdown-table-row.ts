export function parseLedgerMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const normalized = withoutLeadingPipe.endsWith('|') ? withoutLeadingPipe.slice(0, -1) : withoutLeadingPipe;
  return normalized.split('|').map((cell) => cell.trim());
}
