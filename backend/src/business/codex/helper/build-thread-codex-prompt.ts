/**
 * WHAT: Builds launch-scoped developer instructions and stdin context for one decision-os thread.
 * WHY: Stable execution rules belong in Codex configuration while the current task bodies belong on stdin.
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
  operatorNoteTimestamp: string;
}): { developerInstructions: string; taskContext: string } {
  const developerInstructions = [
    '## A. Scope',
    '',
    '1. **Task type:** Treat the supplied `decision-os` thread only.',
    `2. **Workspace root:** \`${input.workspaceRoot}\`.`,
    `3. **Ledger file:** \`${input.ledgerFile}\`.`,
    `4. **Card id:** \`${input.cardId}\`.`,
    `5. **Prompt card title at launch:** ${input.cardTitle}.`,
    `6. **Card markdown file:** \`${input.cardMarkdownFile}\`.`,
    `7. **Thread id:** \`${input.threadId}\`.`,
    `8. **Thread markdown file:** \`${input.threadMarkdownFile}\`.`,
    `9. **Run summary file:** \`${input.runSummaryFile}\`.`,
    `10. **Operator timestamp:** \`${input.operatorNoteTimestamp}\`.`,
    '11. **Runtime placeholders:** All launch values are resolved for the current workspace, card, thread, note, and run.',
    '',
    '---',
    '',
    '## B. Scoped Treatment Rules',
    '',
    '1. **Required reads:** Read the full thread markdown and card markdown before acting.',
    '2. **Request source:** Treat the thread markdown as the operator request source for this run.',
    '3. **Durable edits:** Apply requested durable edits to the card markdown and repo files with targeted patches; never delete the full card body to rewrite it.',
    '4. **Completion reply:** Append exactly one `# AGENT` reply to the thread markdown when you finish your turn.',
    '5. **Patch rule:** Patch the thread markdown file directly for multi-paragraph replies.',
    '6. **Ledger guard:** Do not edit the ledger JSON unless the operator explicitly asks for it.',
    '7. **Operator-owned completion:** Never set a card status to `done` and never declare a master task complete unless the operator explicitly instructs you to complete that specific card. Completing work or all subtasks is not completion authorization.',
    '8. **Markdown task metadata:** Keep master-task identity, lifecycle labels, timestamps, queue rank, and subtask links in the card Markdown contract. Do not create a parallel task-data object in ledger JSON. Linked subtask completion comes from each linked card status, not duplicated status prose in the master Markdown.',
    '',
    '---',
    '',
    '## C. Thread Reply Contract',
    '',
    '1. **Reply heading:** Start the agent reply with `# AGENT`.',
    '2. **Metadata comment:** Add `<!-- decision-os:note {"id":"note-agent-{epoch-ms}-{8-hex}","timestamp":"{ISO-8601}"} -->` with newly generated values.',
    '3. **Reply body:** Put the concrete answer markdown after the metadata comment.',
    '4. **Allowed roles:** Keep top-level thread messages limited to `# OPERATOR` and `# AGENT`.',
    '',
    '---',
    '',
    '## D. Card Markdown Formatting Rules',
    '',
    '1. **Section headings:** Use `H2` headings prefixed with uppercase section letters, for example `## A. Scope`.',
    '2. **Section dividers:** Put `---` between sections.',
    '3. **Requirement lists:** Use numbered lists for normal card requirements.',
    '4. **Important labels:** Start important requirement items with bold labels.',
    '5. **Exact values:** Use backticks for exact file paths, config keys, API routes, statuses, and literal values.',
    '6. **Implementation prose:** Keep prose concrete and implementation-ready.',
  ].join('\n');

  const taskContext = [
    'Execute the operator request from one decision-os card thread.',
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
  ].join('\n');

  return { developerInstructions, taskContext };
}
