/**
 * WHAT: Builds a compact runtime contract and the current thread payload for Codex.
 * WHY: Repository AGENTS.md owns general policy; launch instructions contain only Decision OS mechanics.
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
    'Decision OS card run:',
    `- Intake: \`ledger-cli session-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id ${input.cardId} --json\`.`,
    '- Ledger writes use ledger-cli. Plan master/subtasks with `master-task-apply`; IDs are automatic.',
    '- Mark verified subtasks with `ledger-cli done` and sync projections. Master completion requires explicit operator authorization.',
    `- Gate: \`ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id ${input.cardId} --json\`; ledger status is truth.`,
    `- Reply: \`ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id ${input.threadId} --message-stdin\`.`,
    '- Card Markdown: lettered H2s, dividers, numbered lists, bold labels, literals in backticks.',
  ].join('\n');

  const taskContext = [
    'Execute the operator request from this Decision OS thread.',
    `Card: ${input.cardId} (${input.cardMarkdownFile})`,
    `Thread: ${input.threadId} (${input.threadMarkdownFile})`,
    `Run summary: ${input.runSummaryFile}`,
    '',
    'Thread:',
    '```markdown',
    input.threadMarkdown,
    '```',
    '',
    'Card:',
    '```markdown',
    input.cardMarkdown,
    '```',
  ].join('\n');

  return { developerInstructions, taskContext };
}
