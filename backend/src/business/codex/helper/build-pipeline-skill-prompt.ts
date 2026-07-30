/**
 * WHAT: Builds the deterministic prompt for one skill inside a durable pipeline run.
 * WHY: Every isolated Codex process needs explicit source, stage input, and output ownership.
 */
import type { CodexContentKind } from '../../../../../shared/schemas/codex-pipeline-types.js';
import {
  assertPipelinePromptRunSkillSnapshot,
  assertPipelineRunSkillPromptEvidence,
} from './pipeline-prompt-snapshot.js';
import { renderPipelinePromptRuntimeVariables } from './pipeline-prompt-library.js';

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
  subtaskContext?: string;
  fileMap?: string;
  projectId?: string;
  ledgerId?: string;
  executionId?: string;
  serverSkill?: { markdown: string; packageRoot: string } | null;
}): string {
  assertPipelineRunSkillPromptEvidence(input);
  if (input.contentKind === 'pipeline-prompt') {
    assertPipelinePromptRunSkillSnapshot(input);
    const card = input.taskConversationContext?.card && typeof input.taskConversationContext.card === 'object'
      ? input.taskConversationContext.card as Record<string, unknown>
      : {};
    const thread = input.taskConversationContext?.thread && typeof input.taskConversationContext.thread === 'object'
      ? input.taskConversationContext.thread as Record<string, unknown>
      : {};
    const previousSkillResult = input.stepInputCardId === input.outputParentCardId
      ? 'No preceding skill result exists; this gate was launched from the canonical task.'
      : input.stepInputCardContent;
    return renderPipelinePromptRuntimeVariables(input.promptSnapshot, {
      MASTER_TASK: String(card.markdown ?? ''),
      SUB_CONTEXT: input.subtaskContext ?? '',
      FULL_THREAD: String(thread.markdown ?? ''),
      FILE_MAP: input.fileMap ?? '',
      PREVIOUS_SKILL_RESULT: previousSkillResult,
      EXECUTION_CONTEXT: JSON.stringify({
        projectId: input.projectId ?? '',
        ledgerId: input.ledgerId ?? '',
        ledgerFile: input.ledgerFile,
        masterTaskId: input.outputParentCardId,
        masterTaskTitle: String(card.title ?? ''),
        threadId: input.taskThreadId ?? String(thread.id ?? ''),
        pipelineRunId: input.pipelineRunId,
        pipelineName: input.pipelineName,
        executionId: input.executionId ?? '',
        sourceCardId: input.sourceCardId,
        sourceCardTitle: input.sourceCardTitle,
        stepId: input.stepId,
        stepTitle: input.stepTitle,
        inputCardId: input.stepInputCardId,
        output: {
          parentCardId: input.outputParentCardId,
          cardId: input.outputCardId,
          subtaskPosition: input.outputSubtaskPosition,
          markdownFile: input.outputMarkdownFile,
        },
      }, null, 2),
    });
  }
  const serverSkill = input.serverSkill ? [
    '',
    `Decision OS server skill package: ${input.serverSkill.packageRoot}`,
    'Apply the following exact SKILL.md instructions. Read referenced files from that package only when the instructions require them.',
    '```markdown',
    input.serverSkill.markdown,
    '```',
  ] : [];
  const directInput = [
    'Direct previous skill result:',
    '```markdown',
    input.stepInputCardContent,
    '```',
  ];
  return [
    `$${input.skillName}`,
    '',
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
