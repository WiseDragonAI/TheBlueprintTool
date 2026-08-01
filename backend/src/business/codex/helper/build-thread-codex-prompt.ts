/**
 * WHAT: Renders the admitted direct-run developer graph and builds the current thread user payload.
 * WHY: Direct Codex runs must use the same registered, single-pass prompt compiler as pipeline executions.
 */
import { readProtectedGitPatch } from '../../git-review/helper/git-review-patch.js';
import {
  createPipelinePromptRuntimeContext,
  renderPipelineDeveloperPrompt,
} from './pipeline-prompt-library.js';
import { decisionOsRuntimePlatform } from './resolve-codex-command.js';

function runSkillPolicy(disallowSkills: boolean | undefined): string {
  return disallowSkills
    ? '- Do not invoke or use any skill for this run. Execute the operator request directly.\n'
    : '';
}

function protectedGitPatch(workspaceRoot: string): string {
  const patch = readProtectedGitPatch(workspaceRoot);
  return patch ? [
    '',
    '- Git-index protection: the staged patch below is operator-approved. Do not modify, unstage, or overwrite these lines.',
    '```diff',
    patch,
    '```',
  ].join('\n') : '';
}

export function buildThreadCodexPrompt(input: {
  developerPromptSnapshot: string;
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
  const empty = () => '';
  const developerInstructions = renderPipelineDeveloperPrompt(
    input.developerPromptSnapshot,
    createPipelinePromptRuntimeContext({
      PLATFORM: () => decisionOsRuntimePlatform(),
      SKILL_NAME: empty,
      PIPELINE_RUN_ID: empty,
      PIPELINE_NAME: empty,
      LEDGER_FILE: () => input.ledgerFile,
      SOURCE_CARD_ID: () => input.cardId,
      SOURCE_CARD_TITLE: () => input.cardTitle,
      STEP_ID: empty,
      STEP_TITLE: empty,
      STEP_INPUT_CARD_ID: () => input.cardId,
      STEP_INPUT_CARD_CONTENT: () => input.cardMarkdown,
      OUTPUT_PARENT_CARD_ID: () => input.cardId,
      OUTPUT_CARD_ID: () => input.cardId,
      OUTPUT_SUBTASK_POSITION: empty,
      OUTPUT_MARKDOWN_FILE: () => input.runSummaryFile,
      SERVER_SKILL_CONTEXT: empty,
      MASTER_TASK: () => input.cardMarkdown,
      SUB_CONTEXT: empty,
      SUB_TASKS: empty,
      FULL_THREAD: () => input.threadMarkdown,
      FILE_MAP: empty,
      PREVIOUS_SKILL_RESULT: empty,
      EXECUTION_CONTEXT: () => JSON.stringify(input.context, null, 2),
      PROJECT_ID: () => input.projectId,
      CARD_ID: () => input.cardId,
      THREAD_ID: () => input.threadId,
      RUN_SKILL_POLICY: () => runSkillPolicy(input.disallowSkills),
      PROTECTED_GIT_PATCH: () => protectedGitPatch(input.workspaceRoot),
    }),
  );

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
