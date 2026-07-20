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
    '- Treat the master-task body as a living strategic summary for a CTO, never as a run log, implementation inventory, or verification report. On every run, replace the complete body with the current strategic state.',
    '- Master-task formatting: use short letter-prefixed H2 sections with `---` between sections and compact numbered lists only. Use **bold inside sentences** only for strategically important objectives, decisions, constraints, risks, blockers, and outcomes. Never use bold as a list-item label, bold an entire bullet, or use bold for implementation detail. Wrap every exact supporting mechanism, system state, dependency, route, command, field, or literal in `backticks`, for example `Exec`, `failed`, `task-execution`, and `project-sync`; do not backtick ordinary strategic prose.',
    '- Master-task exclusions: never expose raw UUIDs, run IDs, card IDs, thread IDs, relationship IDs, hashes, encoded project IDs, or timestamps. The only exception is the hidden target inside canonical links in the letter-prefixed `Subtasks` section. Omit test counts, routine verification results, file inventories, commits, pushes, process narration, and implementation chronology unless one materially changes a decision, blocker, or risk.',
    '- Master-task required content: global context and objective; verified current state; strategic constraints and choices; current decision or blocker; one credible path and why it advances the objective; expected outcome; open operator questions; and canonical relationship-backed links under the final letter-prefixed `Subtasks` section.',
    '- Master-task rendered-output gate: before writing the card, inspect the complete rendered summary. Rewrite it if any required strategic section is missing, a raw opaque identifier is visible, an exact mechanism/state/dependency is not backticked, bold is used as a label or for a whole bullet, or routine implementation or verification detail remains. Do not submit a partially compliant summary.',
    '- The thread reply is a separate CTO-facing iteration record: write only a few very short numbered bullets with no heading or section. Report only material outcomes from this iteration: results, decisions, resolved blockers, new blockers, and changed risks. Never include raw UUIDs or other opaque internal identifiers; name the human-readable subject and outcome instead. Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions such as updating the master task. Put all reasoning and complete task state in the master-task body.',
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
