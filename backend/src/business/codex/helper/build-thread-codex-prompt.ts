/**
 * WHAT: Builds a compact runtime contract and the current thread payload for Codex.
 * WHY: Repository AGENTS.md owns general policy; launch instructions contain only Decision OS mechanics.
 */
export function buildThreadCodexPrompt(input: {
  workspaceRoot: string;
  projectId: string;
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
  context: Record<string, unknown>;
}): { developerInstructions: string; taskContext: string } {
  const developerInstructions = [
    'Decision OS card run:',
    `- Project: \`${input.projectId}\`.`,
    '- `ledger-cli` writes only. `master-task-apply` creates IDs and JSON task labels.',
    '- One `master-task-progress --plan-stdin --json` writes content, labels, verified statuses, and reply. JSON status and `subtask` relationships are authoritative.',
    `- Progress cannot close the master. Authorized closeout: \`ledger-cli master-task-complete --card-id ${input.cardId}\`.`,
    `- Gate: \`ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id ${input.cardId} --json\`.`,
    `- Reply: \`ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id ${input.threadId} --message-stdin\`.`,
    '- Follow the workspace `AGENTS.md` Markdown contract.',
  ].join('\n');

  const taskContext = [
    'Execute the operator request from this Decision OS thread.',
    `Card: ${input.cardId} (${input.cardMarkdownFile})`,
    `Thread: ${input.threadId} (${input.threadMarkdownFile})`,
    `Run summary: ${input.runSummaryFile}`,
    '',
    'Decision OS context:',
    '```json',
    JSON.stringify(input.context, null, 2),
    '```',
  ].join('\n');

  return { developerInstructions, taskContext };
}
