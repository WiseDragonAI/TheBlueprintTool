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
    '- `ledger-cli` writes only; use `master-task-apply`.',
    '- One `master-task-progress --plan-stdin --json`; replicated lifecycle and positioned `subtask` relationships are authoritative.',
    '- Keep the master-task body a living strategic summary for a CTO, never as a run log, implementation inventory, or verification report; replace the complete body with the current strategic state.',
    '- Use short letter-prefixed H2 sections with `---` between sections and compact numbered lists only. Present one credible path and why it advances the objective.',
    '- Use **bold inside sentences**. Never use bold as a list-item label, bold an entire bullet, or use bold for implementation detail.',
    '- Wrap every exact supporting mechanism, system state, dependency, route, command, field, or literal in `backticks`, including `Exec`, `failed`, `task-execution`, and `project-sync`.',
    '- Include global context and objective; verified current state; strategic constraints and choices; current decision or blocker. Keep relationship membership and lifecycle state out of Markdown.',
    '- Omit test counts, routine verification results, file inventories, commits, pushes, process narration, and implementation chronology; never expose raw UUIDs, run IDs, card IDs, thread IDs, relationship IDs, hashes, encoded project IDs, or timestamps.',
    '- Master-task rendered-output gate: inspect the complete rendered summary. Do not submit a partially compliant summary.',
    '- The thread reply is a separate CTO-facing iteration record: very short numbered bullets with no heading or section for material outcomes from this iteration.',
    '- Never include raw UUIDs or other opaque internal identifiers in the reply; name the human-readable subject and outcome instead. Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions. Put all reasoning and complete task state in the master-task body.',
    '- Never close or mark the master task done from a normal card run except by direct operator action or an explicitly invoked closeout skill.',
    ...(input.disallowSkills ? ['- Do not invoke or use any skill for this run. Execute the operator request directly.'] : []),
    `- \`ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id ${input.cardId} --json\`.`,
    `- \`ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id ${input.threadId} --message-stdin\`.`,
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
