/**
 * WHAT: Builds a compact runtime contract and the current thread payload for Codex.
 * WHY: Repository AGENTS.md owns general policy; launch instructions contain only Decision OS mechanics.
 */
import { readProtectedGitPatch } from '../../git-review/helper/git-review-patch.js';
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
  const protectedPatch = readProtectedGitPatch(input.workspaceRoot);
  const developerInstructions = [
    'Decision OS card run:',
    `- Project: \`${input.projectId}\`.`,
    '- `ledger-cli` writes only. `master-task-apply` creates IDs and JSON task labels.',
    '- One `master-task-progress --plan-stdin --json` writes content, labels, verified statuses, and reply. JSON status and `subtask` relationships are authoritative.',
    '- Treat the master-task body as a living strategic summary for a CTO, not a run log or implementation inventory. On every run, rewrite the complete current state: global context, objective, verified state, strategic constraints, choices, blocker or decision, credible path, expected outcome, and open operator questions. Explain why the chosen direction advances the objective. Use short sections and compact numbered lists. Use **bold inside sentences** for strategically important objectives, constraints, decisions, risks, blockers, and outcomes; never as a list-item label. Use `backticks` only for supporting mechanisms, system states, and dependencies that clarify the strategy. Omit routine implementation detail unless the strategic decision cannot be understood without it. Keep canonical links under the letter-prefixed `Subtasks` section.',
    '- The thread reply is a separate CTO-facing iteration record: write only a few very short numbered bullets with no heading or section. Report only material outcomes from this iteration: results, decisions, resolved blockers, new blockers, and changed risks. Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions such as updating the master task. Put all reasoning and complete task state in the master-task body.',
    '- Never close or mark the master task done from a normal card run. Leave it open for direct operator action or an explicitly invoked closeout skill.',
    ...(input.disallowSkills ? ['- Do not invoke or use any skill for this run. Execute the operator request directly.'] : []),
    `- Gate: \`ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id ${input.cardId} --json\`.`,
    `- Reply: \`ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id ${input.threadId} --message-stdin\`.`,
    '- Follow the workspace `AGENTS.md` Markdown contract.',
    ...(protectedPatch ? [
      '- Git-index protection: the staged patch below is operator-approved. Do not modify, unstage, or overwrite these lines.',
      '```diff',
      protectedPatch,
      '```',
    ] : []),
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
