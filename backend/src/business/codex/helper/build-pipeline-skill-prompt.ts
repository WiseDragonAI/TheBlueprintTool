/**
 * WHAT: Builds the deterministic prompt for one skill inside a durable pipeline run.
 * WHY: Every isolated Codex process needs explicit source, stage input, and output ownership.
 */
import type { CodexContentKind } from '../../../../../shared/schemas/codex-pipeline-types.js';
import {
  assertPipelinePromptRunSkillSnapshot,
  assertPipelineRunSkillPromptEvidence,
} from './pipeline-prompt-snapshot.js';

export function buildPipelineSkillPrompt(input: {
  skillName: string;
  contentKind: CodexContentKind;
  contentRevision?: string;
  contentCommit?: string;
  promptSnapshot?: string;
  ledgerFile: string;
  pipelineRunId: string;
  pipelineName: string;
  sourceCardId: string;
  sourceCardTitle: string;
  stepId: string;
  stepTitle: string;
  stepInputCardId: string;
  stepInputCardContent: string;
  outputParentCardId: string;
  outputCardId: string;
  outputSubtaskPosition: number;
  outputMarkdownFile: string;
  taskThreadId?: string;
  taskConversationContext?: Record<string, unknown>;
  serverSkill?: { markdown: string; packageRoot: string } | null;
}): string {
  assertPipelineRunSkillPromptEvidence(input);
  let promptSnapshot: string | null = null;
  if (input.contentKind === 'pipeline-prompt') {
    assertPipelinePromptRunSkillSnapshot(input);
    promptSnapshot = input.promptSnapshot;
  }
  const serverSkill = input.serverSkill ? [
    '',
    `Decision OS server skill package: ${input.serverSkill.packageRoot}`,
    'Apply the following exact SKILL.md instructions. Read referenced files from that package only when the instructions require them.',
    '```markdown',
    input.serverSkill.markdown,
    '```',
  ] : [];
  const pipelinePrompt = promptSnapshot !== null ? [
    'Decision OS pipeline-only prompt:',
    'Apply the following exact injected instructions. This prompt is intentionally unavailable to natural Codex skill discovery.',
    '```markdown',
    promptSnapshot,
    '```',
    '',
  ] : [];
  const taskConversation = promptSnapshot !== null && input.taskConversationContext && input.taskThreadId ? [
    'Canonical task and operator conversation:',
    '```json',
    JSON.stringify(input.taskConversationContext, null, 2),
    '```',
    '',
    'This pipeline-only prompt owns operator-facing communication for this run.',
    'Append its concise operator-facing conclusion or blocking question to the canonical task thread by running:',
    `ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id "${input.taskThreadId}" --message-stdin`,
    'Keep the output Markdown separate: it is the direct handoff consumed by the next queued skill.',
    '',
  ] : [];
  const directInput = promptSnapshot !== null && input.stepInputCardId === input.outputParentCardId ? [
    'Direct previous skill result:',
    'No preceding skill result exists; this gate was launched from the canonical task.',
  ] : [
    'Direct previous skill result:',
    '```markdown',
    input.stepInputCardContent,
    '```',
  ];
  return [
    ...(input.contentKind === 'pipeline-prompt' ? [] : [`$${input.skillName}`, '']),
    'ledger-cli is on PATH; use $DECISION_OS_LEDGER_FILE and do not locate the CLI.',
    'You are processing one stage of a decision-os card pipeline from the active workspace.',
    '',
    `Pipeline run id: ${input.pipelineRunId}`,
    `Pipeline: ${input.pipelineName}`,
    `Ledger file: ${input.ledgerFile}`,
    `Source card id: ${input.sourceCardId}`,
    `Source card title: ${input.sourceCardTitle}`,
    `Active step id: ${input.stepId}`,
    `Active step title: ${input.stepTitle}`,
    `Current skill: ${input.skillName}`,
    `Input card id: ${input.stepInputCardId}`,
    `Output subtask parent card id: ${input.outputParentCardId}`,
    `Output subtask card id: ${input.outputCardId}`,
    `Output subtask position: ${input.outputSubtaskPosition}`,
    `Output card role: linked subtask of ${input.outputParentCardId}`,
    ...serverSkill,
    '',
    ...pipelinePrompt,
    ...taskConversation,
    ...directInput,
    '',
    `Write the final result to this Markdown file: ${input.outputMarkdownFile}`,
    'Update the output subtask card title to a concise result-specific title by running:',
    `ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id "${input.outputCardId}" --card-title "<result-specific-title>"`,
    '',
    'Use English only.',
    'Use letter-prefixed H2 sections, --- between sections, numbered list items.',
    'Do not edit ledger JSON manually.',
    'Keep unrelated files unchanged.',
  ].join('\n');
}
