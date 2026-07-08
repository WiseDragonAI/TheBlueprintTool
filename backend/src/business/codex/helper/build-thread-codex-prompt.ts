/**
 * WHAT: Builds the first-run prompt for a Codex session scoped to one decision-os thread.
 * WHY: The thread-panel action must reuse treatment rules without asking Codex to scan every open note.
 */
export function buildThreadCodexPrompt(input: {
  workspaceRoot: string;
  ledgerFile: string;
  cardId: string;
  cardTitle: string;
  cardMarkdownFile: string;
  cardMarkdown: string;
  threadId: string;
  threadMarkdownFile: string;
  threadMarkdown: string;
  runSummaryFile: string;
}): string {
  return [
    'You are treating one decision-os thread, not scanning all open notes.',
    '',
    'Scope:',
    `Workspace root: ${input.workspaceRoot}`,
    `Ledger file: ${input.ledgerFile}`,
    `Card id: ${input.cardId}`,
    `Card title: ${input.cardTitle}`,
    `Card markdown file: ${input.cardMarkdownFile}`,
    `Thread id: ${input.threadId}`,
    `Thread markdown file: ${input.threadMarkdownFile}`,
    `Run summary file: ${input.runSummaryFile}`,
    '',
    'Scoped treatment rules adapted from the decision-os treat-open-notes workflow:',
    '1. Read the full thread markdown and card markdown before acting.',
    '2. Treat the thread markdown as the operator request source for this run.',
    '3. Apply requested durable edits to the card markdown or repo files as needed.',
    '4. Append exactly one # AGENT reply to the thread markdown when the work is complete or blocked.',
    '5. Use only # OPERATOR and # AGENT as top-level thread message headings.',
    '6. For multi-paragraph replies, patch the thread markdown file directly.',
    '7. Do not query or treat unrelated open notes.',
    '8. Do not change card status unless the operator explicitly asks.',
    '9. Do not manually edit ledger JSON unless changing structured card data is explicitly required.',
    '10. Keep unrelated files unchanged.',
    '',
    'Thread reply metadata format:',
    '```markdown',
    '# AGENT',
    '<!-- decision-os:note {"id":"note-agent-<epoch-ms>-<8-hex>","timestamp":"<ISO-8601>"} -->',
    '',
    'Concrete answer markdown here.',
    '```',
    '',
    'Card content formatting rules when rewriting durable card prose:',
    '1. Use H2 section headings.',
    '2. Prefix H2 headings with an uppercase section letter, for example ## A. Scope.',
    '3. Put --- horizontal rules between sections.',
    '4. Use numbered lists for normal card requirements.',
    '5. Use bold labels at the start of important requirement items.',
    '6. Use backticks for exact file paths, config keys, API routes, statuses, and literal values.',
    '7. Keep prose concrete and implementation-ready.',
    '',
    'Current thread markdown:',
    '```markdown',
    input.threadMarkdown,
    '```',
    '',
    'Current card markdown:',
    '```markdown',
    input.cardMarkdown,
    '```',
    '',
    'Use English only.',
    'When finished, update the run summary file with a concise summary if it helps the operator inspect the run card.',
  ].join('\n');
}
