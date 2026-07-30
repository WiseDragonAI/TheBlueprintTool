/**
 * WHAT: Renders one admitted pipeline developer prompt from a typed runtime context.
 * WHY: Prompt references and execution data have separate immutable-admission and process-launch authorities.
 */
import type {
  CodexContentKind,
  CodexDeveloperPromptEnvelopeV2,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { assertPipelineRunSkillPromptEvidence } from './pipeline-prompt-snapshot.js';
import {
  renderPipelineDeveloperPrompt,
  renderPipelinePromptRuntimeVariables,
  type PipelinePromptRuntimeContext,
} from './pipeline-prompt-library.js';

type PipelinePromptEvidence = Partial<CodexDeveloperPromptEnvelopeV2> & {
  contentRevision?: string;
  contentCommit?: string;
  promptSnapshot?: string;
};

export type BuildPipelineSkillPromptInput = PipelinePromptEvidence & {
  skillName: string;
  contentKind: CodexContentKind;
  runtimeContext: PipelinePromptRuntimeContext;
};

export function buildPipelineSkillPrompt(input: BuildPipelineSkillPromptInput): string {
  assertPipelineRunSkillPromptEvidence(input);
  if (input.syntaxVersion === 2) {
    return renderPipelineDeveloperPrompt(input.developerPromptSnapshot!, input.runtimeContext);
  }
  if (input.contentKind === 'pipeline-prompt') {
    return renderPipelinePromptRuntimeVariables(input.promptSnapshot!, {
      MASTER_TASK: input.runtimeContext.MASTER_TASK(),
      SUB_CONTEXT: input.runtimeContext.SUB_CONTEXT(),
      FULL_THREAD: input.runtimeContext.FULL_THREAD(),
      FILE_MAP: input.runtimeContext.FILE_MAP(),
      PREVIOUS_SKILL_RESULT: input.runtimeContext.PREVIOUS_SKILL_RESULT(),
      EXECUTION_CONTEXT: input.runtimeContext.EXECUTION_CONTEXT(),
    });
  }
  const serverSkillContext = input.runtimeContext.SERVER_SKILL_CONTEXT();
  return [
    `$${input.runtimeContext.SKILL_NAME()}`,
    '',
    'ledger-cli is on PATH; use $DECISION_OS_LEDGER_FILE and do not locate the CLI.',
    'You are processing one stage of a decision-os card pipeline from the active workspace.',
    '',
    `Pipeline run id: ${input.runtimeContext.PIPELINE_RUN_ID()}`,
    `Pipeline: ${input.runtimeContext.PIPELINE_NAME()}`,
    `Ledger file: ${input.runtimeContext.LEDGER_FILE()}`,
    `Source card id: ${input.runtimeContext.SOURCE_CARD_ID()}`,
    `Source card title: ${input.runtimeContext.SOURCE_CARD_TITLE()}`,
    `Active step id: ${input.runtimeContext.STEP_ID()}`,
    `Active step title: ${input.runtimeContext.STEP_TITLE()}`,
    `Current skill: ${input.runtimeContext.SKILL_NAME()}`,
    `Input card id: ${input.runtimeContext.STEP_INPUT_CARD_ID()}`,
    `Output subtask parent card id: ${input.runtimeContext.OUTPUT_PARENT_CARD_ID()}`,
    `Output subtask card id: ${input.runtimeContext.OUTPUT_CARD_ID()}`,
    `Output subtask position: ${input.runtimeContext.OUTPUT_SUBTASK_POSITION()}`,
    `Output card role: linked subtask of ${input.runtimeContext.OUTPUT_PARENT_CARD_ID()}`,
    ...(serverSkillContext ? serverSkillContext.split('\n') : []),
    '',
    'Direct previous skill result:',
    '```markdown',
    input.runtimeContext.STEP_INPUT_CARD_CONTENT(),
    '```',
    '',
    `Write the final result to this Markdown file: ${input.runtimeContext.OUTPUT_MARKDOWN_FILE()}`,
    'Update the output subtask card title to a concise result-specific title by running:',
    `ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id "${input.runtimeContext.OUTPUT_CARD_ID()}" --card-title "<result-specific-title>"`,
    '',
    'Use English only.',
    'Use letter-prefixed H2 sections, --- between sections, numbered list items.',
    'Do not edit ledger JSON manually.',
    'Keep unrelated files unchanged.',
  ].join('\n');
}
