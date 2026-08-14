import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPipelineSkillPrompt } from '@backend/business/codex/helper/build-pipeline-skill-prompt.js';
import { buildThreadCodexPrompt } from '@backend/business/codex/helper/build-thread-codex-prompt.js';
import {
  compilePipelinePromptGraph,
  createPipelinePromptRuntimeContext,
  renderPipelineDeveloperPrompt,
} from '@backend/business/codex/helper/pipeline-prompt-library.js';

function runtimeContext(overrides: Partial<Record<string, () => string>> = {}) {
  const empty = () => '';
  return createPipelinePromptRuntimeContext({
    PLATFORM: overrides.PLATFORM ?? (() => 'linux'),
    SKILL_NAME: overrides.SKILL_NAME ?? empty,
    PIPELINE_RUN_ID: overrides.PIPELINE_RUN_ID ?? empty,
    PIPELINE_NAME: overrides.PIPELINE_NAME ?? empty,
    LEDGER_FILE: overrides.LEDGER_FILE ?? empty,
    SOURCE_CARD_ID: overrides.SOURCE_CARD_ID ?? empty,
    SOURCE_CARD_TITLE: overrides.SOURCE_CARD_TITLE ?? empty,
    STEP_ID: overrides.STEP_ID ?? empty,
    STEP_TITLE: overrides.STEP_TITLE ?? empty,
    STEP_INPUT_CARD_ID: overrides.STEP_INPUT_CARD_ID ?? empty,
    STEP_INPUT_CARD_CONTENT: overrides.STEP_INPUT_CARD_CONTENT ?? empty,
    OUTPUT_PARENT_CARD_ID: overrides.OUTPUT_PARENT_CARD_ID ?? empty,
    OUTPUT_CARD_ID: overrides.OUTPUT_CARD_ID ?? empty,
    OUTPUT_SUBTASK_POSITION: overrides.OUTPUT_SUBTASK_POSITION ?? empty,
    OUTPUT_MARKDOWN_FILE: overrides.OUTPUT_MARKDOWN_FILE ?? empty,
    SERVER_SKILL_CONTEXT: overrides.SERVER_SKILL_CONTEXT ?? empty,
    MASTER_TASK: overrides.MASTER_TASK ?? empty,
    SUB_CONTEXT: overrides.SUB_CONTEXT ?? empty,
    SUB_TASKS: overrides.SUB_TASKS ?? empty,
    FULL_THREAD: overrides.FULL_THREAD ?? empty,
    PENDING_NOTES: overrides.PENDING_NOTES ?? empty,
    LAST_AGENT_NOTE: overrides.LAST_AGENT_NOTE ?? empty,
    FILE_MAP: overrides.FILE_MAP ?? empty,
    PREVIOUS_SKILL_RESULT: overrides.PREVIOUS_SKILL_RESULT ?? empty,
    EXECUTION_CONTEXT: overrides.EXECUTION_CONTEXT ?? empty,
    PROJECT_ID: overrides.PROJECT_ID ?? empty,
    CARD_ID: overrides.CARD_ID ?? empty,
    THREAD_ID: overrides.THREAD_ID ?? empty,
    RUN_SKILL_POLICY: overrides.RUN_SKILL_POLICY ?? empty,
    PROTECTED_GIT_PATCH: overrides.PROTECTED_GIT_PATCH ?? empty,
  });
}

test('compiler expands recursive prompt references and preserves runtime tokens for launch', () => {
  const prompts = new Map([
    ['SYSTEM_PROMPT', 'platform: <PLATFORM>'],
    ['GateTest', '{{CLI_TOOLS}}\n\n<MASTER_TASK>'],
    ['CLI_TOOLS', 'Use ledger-cli.'],
  ]);
  const compiled = compilePipelinePromptGraph({
    roots: ['SYSTEM_PROMPT', 'GateTest'],
    resolve: (name) => prompts.get(name) ?? null,
  });
  assert.deepEqual(compiled.dependencies, ['SYSTEM_PROMPT', 'GateTest', 'CLI_TOOLS']);
  assert.equal(
    compiled.developerPromptSnapshot,
    'platform: <PLATFORM>\n\nUse ledger-cli.\n\n<MASTER_TASK>',
  );
  assert.equal(renderPipelineDeveloperPrompt(compiled.developerPromptSnapshot, runtimeContext({
    MASTER_TASK: () => '# Master task',
  })), 'platform: linux\n\nUse ledger-cli.\n\n# Master task');
});

test('runtime rendering is single-pass, strict, lazy, and leaves lowercase angle text literal', () => {
  let fileMapCalls = 0;
  let threadCalls = 0;
  const context = runtimeContext({
    FILE_MAP: () => {
      fileMapCalls += 1;
      return '<FULL_THREAD>';
    },
    FULL_THREAD: () => {
      threadCalls += 1;
      return 'must not be gathered';
    },
  });
  assert.equal(
    renderPipelineDeveloperPrompt('<FILE_MAP>\n<result-specific-title>', context),
    '<FULL_THREAD>\n<result-specific-title>',
  );
  assert.equal(fileMapCalls, 1);
  assert.equal(threadCalls, 0);
  assert.throws(
    () => renderPipelineDeveloperPrompt('<UNKNOWN_RUNTIME_TOKEN>', context),
    /Unknown pipeline prompt runtime token/,
  );
  assert.equal(fileMapCalls, 1);
  assert.equal(threadCalls, 0);
});

test('compiler rejects missing references and recursive prompt cycles', () => {
  assert.throws(
    () => compilePipelinePromptGraph({
      roots: ['A'],
      resolve: (name) => name === 'A' ? '{{MISSING}}' : null,
    }),
    /template "MISSING" was not found/,
  );
  assert.throws(
    () => compilePipelinePromptGraph({
      roots: ['A'],
      resolve: (name) => name === 'A' ? '{{B}}' : name === 'B' ? '{{A}}' : null,
    }),
    /A -> B -> A/,
  );
});

test('registered template roots preserve the pipeline wrapper and direct-run developer bytes', () => {
  const repositoryRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
  const promptTemplateRoot = resolve(repositoryRoot, 'backend/templates/pipeline-prompts');
  const systemPrompt = readFileSync(resolve(promptTemplateRoot, 'SYSTEM_PROMPT.md'), 'utf8');
  const skillPrompt = readFileSync(resolve(promptTemplateRoot, 'SKILL.md'), 'utf8');
  const codexRunPrompt = readFileSync(resolve(promptTemplateRoot, 'CODEX_RUN.md'), 'utf8');
  const context = runtimeContext({
    SKILL_NAME: () => 'analysis',
    PIPELINE_RUN_ID: () => 'run-1',
    PIPELINE_NAME: () => 'Pipeline',
    LEDGER_FILE: () => '/workspace/.decision-os/tasks.json',
    SOURCE_CARD_ID: () => 'source',
    SOURCE_CARD_TITLE: () => 'Source',
    STEP_ID: () => 'step',
    STEP_TITLE: () => 'Step',
    STEP_INPUT_CARD_ID: () => 'input',
    STEP_INPUT_CARD_CONTENT: () => '# Input',
    OUTPUT_PARENT_CARD_ID: () => 'master',
    OUTPUT_CARD_ID: () => 'output',
    OUTPUT_SUBTASK_POSITION: () => '2',
    OUTPUT_MARKDOWN_FILE: () => '/workspace/.decision-os/cards/tasks/output.md',
    SERVER_SKILL_CONTEXT: () => [
      '',
      'Decision OS server skill package: /server/analysis',
      'Apply the following exact SKILL.md instructions. Read referenced files from that package only when the instructions require them.',
      '```markdown',
      '# Analysis',
      '```',
    ].join('\n'),
  });
  assert.equal(systemPrompt, [
    'platform: <PLATFORM>',
    'Git commits you create, including merges, require a concise subject and body:',
    '- WHAT: changed boundary.',
    '- WHY: reason and decision evidence.',
    '',
  ].join('\n'));
  assert.equal(
    renderPipelineDeveloperPrompt(skillPrompt, context),
    `${buildPipelineSkillPrompt({
      skillName: 'analysis',
      contentKind: 'federated-skill',
      runtimeContext: context,
    })}\n`,
  );
  const directSnapshot = compilePipelinePromptGraph({
    roots: ['CODEX_RUN'],
    resolve: (name) => name === 'SYSTEM_PROMPT'
      ? systemPrompt
      : name === 'CODEX_RUN'
        ? codexRunPrompt
        : null,
  }).developerPromptSnapshot;
  const directPrompt = buildThreadCodexPrompt({
    developerPromptSnapshot: directSnapshot,
    workspaceRoot: '/workspace',
    projectId: 'project-a',
    ledgerFile: '/workspace/.decision-os/tasks.json',
    cardId: 'card-a',
    cardTitle: 'Card A',
    cardMarkdownFile: '/workspace/.decision-os/cards/tasks/card-a.md',
    cardMarkdown: '# Card A\n',
    threadId: 'thread-card-a',
    threadMarkdownFile: '/workspace/.decision-os/threads/tasks/thread-card-a.md',
    threadMarkdown: '# OPERATOR\n\nImplement this request.\n',
    runSummaryFile: '/workspace/.decision-os/runs/codex-skills/tasks/run.md',
    operatorNoteTimestamp: '2026-07-31T00:00:00.000Z',
    context: {},
  });
  assert.equal(
    directPrompt.developerInstructions,
    renderPipelineDeveloperPrompt(directSnapshot, runtimeContext({
      PROJECT_ID: () => 'project-a',
      CARD_ID: () => 'card-a',
      THREAD_ID: () => 'thread-card-a',
    })),
  );
});

test('direct runs include shared policy only when CODEX_RUN authors the reference', () => {
  const authoredPrompts = new Map([
    ['SYSTEM_PROMPT', 'shared policy'],
    ['CODEX_RUN', '{{SYSTEM_PROMPT}}\n\ndirect run'],
  ]);
  const authored = compilePipelinePromptGraph({
    roots: ['CODEX_RUN'],
    resolve: (name) => authoredPrompts.get(name) ?? null,
  });
  const standalonePrompts = new Map([['CODEX_RUN', 'direct run']]);
  const standalone = compilePipelinePromptGraph({
    roots: ['CODEX_RUN'],
    resolve: (name) => standalonePrompts.get(name) ?? null,
  });

  assert.equal(authored.developerPromptSnapshot, 'shared policy\n\ndirect run');
  assert.equal(standalone.developerPromptSnapshot, 'direct run');
  assert.deepEqual(authored.dependencies, ['CODEX_RUN', 'SYSTEM_PROMPT']);
  assert.deepEqual(standalone.dependencies, ['CODEX_RUN']);
});
