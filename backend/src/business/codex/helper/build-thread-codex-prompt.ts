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
  disallowSkills?: boolean;
}): { developerInstructions: string; taskContext: string } {
  const developerInstructions = [
    'Decision OS card run:',
    `- Project: \`${input.projectId}\`.`,
    '- `ledger-cli` writes only. `master-task-apply` creates IDs and JSON task labels.',
    '- One `master-task-progress --plan-stdin --json` writes content, labels, verified statuses, and reply. JSON status and `subtask` relationships are authoritative.',
    '- Never close or mark the master task done from a normal card run. Leave it open for direct operator action or an explicitly invoked closeout skill.',
    ...(input.disallowSkills ? ['- Do not invoke or use any skill for this run. Execute the operator request directly.'] : []),
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
