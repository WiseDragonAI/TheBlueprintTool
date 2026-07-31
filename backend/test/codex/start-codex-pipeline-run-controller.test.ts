import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { discoverDecisionOsProjects } from '@backend/business/server/helper/project-catalog.js';
import { taskExecutionState } from '@backend/business/codex/helper/task-execution-runtime.js';
import { admitPipelinePromptSnapshots } from '@backend/business/codex/helper/pipeline-prompt-snapshot.js';
import { createCodexPipelineRunManifest, type PipelineDefinition } from '@backend/business/codex/helper/create-codex-pipeline-run-manifest.js';
import { buildPipelineSkillPrompt } from '@backend/business/codex/helper/build-pipeline-skill-prompt.js';
import {
  createPipelinePromptRuntimeContext,
  pipelinePromptRuntimeTokens,
  pipelinePromptRuntimeVariables,
  pipelinePromptTemplateVariables,
} from '@backend/business/codex/helper/pipeline-prompt-library.js';
import { startPipelineRun } from '@backend/business/codex/controller/start-codex-pipeline-run-controller.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

async function waitFor<T>(read: () => T | null, label: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const value = read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

async function waitForAsync<T>(read: () => Promise<T | null>, label: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const value = await read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

function createSkill(workspace: string, name: string): void {
  const directory = join(workspace, '.skills', name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} test skill\n---\n`);
}

const promptRecordTimestamp = '2026-07-28T00:00:00.000Z';
const testSkillWrapper = [
  '$<SKILL_NAME>',
  'Current skill: <SKILL_NAME>',
  '<SERVER_SKILL_CONTEXT>',
  'Direct previous skill result:',
  '<STEP_INPUT_CARD_CONTENT>',
  'Write the final result to this Markdown file: <OUTPUT_MARKDOWN_FILE>',
].join('\n');
function basePromptAuthoredContent() {
  return [
    {
      id: 'SYSTEM_PROMPT',
      kind: 'pipeline-prompt' as const,
      description: 'System prompt',
      contentFile: 'pipeline-prompts/SYSTEM_PROMPT.md' as const,
      createdAt: promptRecordTimestamp,
      updatedAt: promptRecordTimestamp,
    },
    {
      id: 'SKILL',
      kind: 'pipeline-prompt' as const,
      description: 'Skill wrapper',
      contentFile: 'pipeline-prompts/SKILL.md' as const,
      createdAt: promptRecordTimestamp,
      updatedAt: promptRecordTimestamp,
    },
  ];
}

function createWorkspace(prefix: string): { workspace: string; decisionOsRoot: string } {
  const workspace = mkdtempSync(join(tmpdir(), prefix));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }, null, 2));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{
      id: 'source-card', title: 'Source Card', x: 20, y: 40, w: 320, h: 180,
      comment: { what: 'Original source body' }, facts: [], fields: [],
    }],
    annotations: [], relationships: [], notes: {},
  }, null, 2));
  mkdirSync(join(decisionOsRoot, 'pipeline-prompts'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'pipeline-prompts', 'SYSTEM_PROMPT.md'), 'platform: <PLATFORM>');
  writeFileSync(join(decisionOsRoot, 'pipeline-prompts', 'SKILL.md'), testSkillWrapper);
  writeCodexPipelineStore({
    decisionOsRoot,
    store: {
      version: 2,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [],
      authoredContent: basePromptAuthoredContent(),
      activeWorkspaceRun: null,
    },
  });
  git(workspace, ['init', '-q']);
  git(workspace, ['config', 'user.name', 'Prompt Test']);
  git(workspace, ['config', 'user.email', 'prompt@example.test']);
  git(workspace, ['add', '.decision-os']);
  git(workspace, ['commit', '-q', '-m', 'Seed prompt compiler']);
  return { workspace, decisionOsRoot };
}

function git(workspace: string, args: string[]): string {
  return execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
}

function promptDefinition(): PipelineDefinition {
  return {
    pipelineId: 'prompt-pipeline',
    pipelineName: 'Prompt pipeline',
    temporary: false,
    steps: [{
      id: 'prompt-step',
      name: 'Prompt step',
      purpose: 'Execute immutable prompt evidence.',
      skills: [{
        id: 'prompt-skill',
        skillName: 'review-output',
        contentKind: 'pipeline-prompt',
        codexModel: null,
        codexEffort: null,
      }],
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    }],
  };
}

function runtimeContext(overrides: Partial<Record<string, string>> = {}) {
  const value = (name: string, fallback = '') => () => overrides[name] ?? fallback;
  return createPipelinePromptRuntimeContext({
    PLATFORM: value('PLATFORM', 'linux'),
    SKILL_NAME: value('SKILL_NAME', 'review-output'),
    PIPELINE_RUN_ID: value('PIPELINE_RUN_ID', 'pipeline-run'),
    PIPELINE_NAME: value('PIPELINE_NAME', 'Prompt pipeline'),
    LEDGER_FILE: value('LEDGER_FILE', '/ledger.json'),
    SOURCE_CARD_ID: value('SOURCE_CARD_ID', 'source-card'),
    SOURCE_CARD_TITLE: value('SOURCE_CARD_TITLE', 'Source Card'),
    STEP_ID: value('STEP_ID', 'prompt-step'),
    STEP_TITLE: value('STEP_TITLE', 'Prompt step'),
    STEP_INPUT_CARD_ID: value('STEP_INPUT_CARD_ID', 'source-card'),
    STEP_INPUT_CARD_CONTENT: value('STEP_INPUT_CARD_CONTENT', 'Input'),
    OUTPUT_PARENT_CARD_ID: value('OUTPUT_PARENT_CARD_ID', 'source-card'),
    OUTPUT_CARD_ID: value('OUTPUT_CARD_ID', 'output-card'),
    OUTPUT_SUBTASK_POSITION: value('OUTPUT_SUBTASK_POSITION', '1'),
    OUTPUT_MARKDOWN_FILE: value('OUTPUT_MARKDOWN_FILE', '/output.md'),
    SERVER_SKILL_CONTEXT: value('SERVER_SKILL_CONTEXT'),
    MASTER_TASK: value('MASTER_TASK', '# Master task'),
    SUB_CONTEXT: value('SUB_CONTEXT', '{}'),
    SUB_TASKS: value('SUB_TASKS'),
    FULL_THREAD: value('FULL_THREAD', '# OPERATOR'),
    FILE_MAP: value('FILE_MAP', '.'),
    PREVIOUS_SKILL_RESULT: value('PREVIOUS_SKILL_RESULT', 'Input'),
    EXECUTION_CONTEXT: value('EXECUTION_CONTEXT', '{}'),
    PROJECT_ID: value('PROJECT_ID'),
    CARD_ID: value('CARD_ID'),
    THREAD_ID: value('THREAD_ID'),
    RUN_SKILL_POLICY: value('RUN_SKILL_POLICY'),
    PROTECTED_GIT_PATCH: value('PROTECTED_GIT_PATCH'),
  });
}

test('FILE_MAP is recognized beside EXECUTION_CONTEXT in both syntax versions', () => {
  assert.deepEqual(
    pipelinePromptTemplateVariables('{{FILE_MAP}}\n{{EXECUTION_CONTEXT}}'),
    ['FILE_MAP', 'EXECUTION_CONTEXT'],
  );
  assert.deepEqual(
    pipelinePromptRuntimeTokens('<FILE_MAP>\n<EXECUTION_CONTEXT>'),
    ['FILE_MAP', 'EXECUTION_CONTEXT'],
  );
  assert.equal(pipelinePromptRuntimeVariables.has('FILE_MAP'), true);
  assert.equal(pipelinePromptRuntimeVariables.has('EXECUTION_CONTEXT'), true);
});

function createPromptRepository(input: {
  prefix: string;
  markdown?: string | Buffer;
  templates?: Readonly<Record<string, string>>;
  recordKind?: 'pipeline-prompt' | 'federated-skill';
  commitPrompt?: boolean;
  stagePrompt?: boolean;
}): { workspace: string; decisionOsRoot: string; promptFile: string } {
  const { workspace, decisionOsRoot } = createWorkspace(input.prefix);
  git(workspace, ['init', '-q']);
  git(workspace, ['config', 'user.name', 'Prompt Test']);
  git(workspace, ['config', 'user.email', 'prompt@example.test']);
  const promptFile = join(decisionOsRoot, 'pipeline-prompts', 'review-output.md');
  mkdirSync(join(promptFile, '..'), { recursive: true });
  writeFileSync(promptFile, input.markdown ?? [
    '# Review output',
    '',
    'GATE_SKILL',
    '',
    'MASTER_TASK',
    '<MASTER_TASK>',
    '',
    'SUB_CONTEXT',
    '<SUB_CONTEXT>',
    '',
    'FULL_THREAD',
    '<FULL_THREAD>',
    '',
    'FILE_MAP',
    '<FILE_MAP>',
    '',
    'PREVIOUS_SKILL_RESULT',
    '<PREVIOUS_SKILL_RESULT>',
    '',
    'EXECUTION_CONTEXT',
    '<EXECUTION_CONTEXT>',
  ].join('\n'));
  const templates = {
    SYSTEM_PROMPT: 'platform: <PLATFORM>',
    SKILL: testSkillWrapper,
    ...(input.templates ?? {}),
  };
  for (const [name, markdown] of Object.entries(templates)) {
    writeFileSync(join(decisionOsRoot, 'pipeline-prompts', `${name}.md`), markdown);
  }
  const definition = promptDefinition();
  const recordKind = input.recordKind ?? 'pipeline-prompt';
  const promptNames = ['review-output', ...Object.keys(templates)];
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: promptNames,
    availableContentKinds: promptNames.map((name) => [name, recordKind]),
    store: {
      version: 2,
      pipelines: [{
        id: 'prompt-pipeline',
        name: 'Prompt pipeline',
        purpose: '',
        stepIds: ['prompt-step'],
        createdAt: '2026-07-28T00:00:00.000Z',
        updatedAt: '2026-07-28T00:00:00.000Z',
      }],
      steps: definition.steps.map((step) => ({
        ...step,
        skills: step.skills.map((skill) => ({ ...skill, contentKind: recordKind })),
      })),
      runs: [],
      skillLibrary: [],
      authoredContent: [
        ...Object.keys(templates).map((name) => ({
            id: name,
            kind: 'pipeline-prompt' as const,
            description: name,
            contentFile: `pipeline-prompts/${name}.md` as const,
            createdAt: '2026-07-28T00:00:00.000Z',
            updatedAt: '2026-07-28T00:00:00.000Z',
          })),
        recordKind === 'pipeline-prompt'
          ? {
              id: 'review-output',
              kind: 'pipeline-prompt' as const,
              description: 'Review output',
              contentFile: 'pipeline-prompts/review-output.md' as const,
              createdAt: '2026-07-28T00:00:00.000Z',
              updatedAt: '2026-07-28T00:00:00.000Z',
            }
          : {
              id: 'review-output',
              kind: 'federated-skill' as const,
              description: 'Review output',
              contentFile: '.skills/review-output/SKILL.md' as const,
              createdAt: '2026-07-28T00:00:00.000Z',
              updatedAt: '2026-07-28T00:00:00.000Z',
            },
      ],
      activeWorkspaceRun: null,
    },
  });
  git(workspace, ['add', '.decision-os/codex-pipelines.json']);
  git(workspace, ['commit', '-q', '-m', 'Register prompt']);
  if (input.commitPrompt !== false) {
    git(workspace, ['add', '.decision-os/pipeline-prompts']);
    git(workspace, ['commit', '-q', '-m', 'Commit prompt']);
  } else if (input.stagePrompt) {
    git(workspace, ['add', '.decision-os/pipeline-prompts/review-output.md']);
  }
  return { workspace, decisionOsRoot, promptFile };
}

test('clean local prompt admission persists and injects one immutable snapshot without rereading its file', async () => {
  const fixture = createPromptRepository({
    prefix: 'decision-os-prompt-admission-',
    markdown: '# Review output\n\n{{AVAILABLE_SKILLS}}\n\n<MASTER_TASK>',
    templates: { AVAILABLE_SKILLS: '# Available skills\n\nUse task-list.' },
  });
  try {
    const definition = promptDefinition();
    const admitted = await admitPipelinePromptSnapshots({
      ownerDecisionOsRoot: fixture.decisionOsRoot,
      steps: definition.steps,
    });
    const snapshot = admitted.get('review-output');
    assert.ok(snapshot);
    assert.equal('syntaxVersion' in snapshot ? snapshot.syntaxVersion : undefined, 2);
    if (!('developerPromptSnapshot' in snapshot)) assert.fail('Expected version-2 developer prompt evidence.');
    assert.match(snapshot.developerPromptSnapshot, /platform: <PLATFORM>[\s\S]*# Available skills[\s\S]*Use task-list\./);
    assert.doesNotMatch(snapshot.developerPromptSnapshot, /\{\{AVAILABLE_SKILLS\}\}/);
    assert.match(snapshot.developerPromptSnapshot, /<MASTER_TASK>/);
    const store = readCodexPipelineStore({
      decisionOsRoot: fixture.decisionOsRoot,
      availableSkillNames: ['review-output'],
      availableContentKinds: [['review-output', 'pipeline-prompt']],
    }).store;
    const manifest = createCodexPipelineRunManifest({
      decisionOsRoot: fixture.decisionOsRoot,
      definition,
      store,
      workspaceRoot: fixture.workspace,
      runtime: {},
      ledgerId: 'specs',
      sourceCardId: 'source-card',
      sourceCardTitle: 'Source Card',
      outputParentCardId: 'source-card',
      firstOutputSubtaskPosition: 1,
      ledgerPath: join(fixture.decisionOsRoot, 'specs.json'),
      admittedPromptSnapshots: admitted,
    });
    const skill = manifest.steps[0].skills[0];
    assert.equal(skill.contentKind, 'pipeline-prompt');
    assert.equal(skill.syntaxVersion, 2);
    assert.equal(skill.syntaxVersion === 2 ? skill.developerPromptSnapshot : '', snapshot.developerPromptSnapshot);
    rmSync(fixture.promptFile);
    const processPrompt = buildPipelineSkillPrompt({
      skillName: skill.skillName,
      contentKind: skill.contentKind ?? 'federated-skill',
      ...(skill.syntaxVersion === 2 ? {
        syntaxVersion: skill.syntaxVersion,
        developerPromptRevision: skill.developerPromptRevision,
        developerPromptCommit: skill.developerPromptCommit,
        developerPromptSnapshot: skill.developerPromptSnapshot,
      } : {}),
      runtimeContext: runtimeContext({
        MASTER_TASK: '# Source card',
        PLATFORM: 'linux',
      }),
    });
    assert.match(processPrompt, /# Available skills[\s\S]*Use task-list\./);
    assert.doesNotMatch(processPrompt, /<MASTER_TASK>/);
    assert.equal(processPrompt.includes('$review-output'), false);
    assert.deepEqual(readCodexPipelineStore({ decisionOsRoot: fixture.decisionOsRoot }).store.runs, []);
  } finally {
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

test('direct card processing admits a pipeline prompt as a temporary one-step run', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const fixture = createPromptRepository({ prefix: 'decision-os-direct-prompt-' });
  const runnerRoot = mkdtempSync(join(tmpdir(), 'decision-os-direct-prompt-runner-'));
  const fakeCodex = join(runnerRoot, 'fake-codex.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const developerPrompt = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (developerPrompt.match(/"markdownFile": "([^"]+)"/) || [])[1] || "";',
    '  writeFileSync(output.trim(), developerPrompt.includes("# Review output") && prompt === "Execute this admitted Decision OS pipeline stage." ? "pipeline prompt seen\\n" : "pipeline prompt missing\\n");',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot: fixture.decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${baseUrl}/api/codex/skills/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ledgerId: 'specs',
        cardId: 'source-card',
        skillName: 'review-output',
        contentKind: 'pipeline-prompt',
      }),
    });
    const body = await response.json() as Record<string, any>;
    assert.equal(response.status, 202, JSON.stringify(body));
    const runSkill = body.pipelineRun.steps[0].skills[0];
    assert.equal(runSkill.contentKind, 'pipeline-prompt');
    assert.equal(runSkill.syntaxVersion, 2);
    assert.match(runSkill.developerPromptSnapshot, /# Review output/);
    await waitFor(() => {
      if (!existsSync(body.run.outputFile)) return null;
      const output = readFileSync(body.run.outputFile, 'utf8');
      return output.includes('pipeline prompt seen') ? output : null;
    }, 'direct prompt output');
    assert.match(readFileSync(body.run.outputFile, 'utf8'), /^pipeline prompt seen\n/);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(fixture.workspace, { recursive: true, force: true });
    rmSync(runnerRoot, { recursive: true, force: true });
  }
});

test('local prompt construction rejects corrupted immutable evidence before process launch', () => {
  const developerPromptSnapshot = '# Admitted local prompt';
  const valid: Parameters<typeof buildPipelineSkillPrompt>[0] = {
    skillName: 'review-output',
    contentKind: 'pipeline-prompt',
    syntaxVersion: 2,
    developerPromptRevision: createHash('sha256').update(developerPromptSnapshot).digest('hex'),
    developerPromptCommit: 'a'.repeat(40),
    developerPromptSnapshot,
    runtimeContext: runtimeContext(),
  };
  const cases: Array<[string, Partial<typeof valid>, RegExp]> = [
    ['snapshot', { developerPromptSnapshot: undefined }, /pipeline_developer_prompt_snapshot_missing/],
    ['revision', { developerPromptRevision: 'b'.repeat(64) }, /pipeline_developer_prompt_revision_mismatch/],
    ['commit', { developerPromptCommit: 'not-a-commit' }, /pipeline_developer_prompt_commit_invalid/],
    ['version', { syntaxVersion: 1 as 2 }, /pipeline_developer_prompt_version_invalid|pipeline_prompt_snapshot_kind_mismatch/],
  ];
  for (const [label, overrides, expected] of cases) {
    assert.throws(
      () => buildPipelineSkillPrompt({ ...valid, ...overrides }),
      expected,
      label,
    );
  }
});

test('pipeline prompt construction injects runtime tokens into only the admitted developer prompt', () => {
  const developerPromptSnapshot = [
    '# Dynamic gate',
    'MASTER=<MASTER_TASK>',
    'SUBTASKS=<SUB_CONTEXT>',
    'FACTS=<SUB_TASKS>',
    'THREAD=<FULL_THREAD>',
    'FILES=<FILE_MAP>',
    'PREVIOUS=<PREVIOUS_SKILL_RESULT>',
    'CONTEXT=<EXECUTION_CONTEXT>',
  ].join('\n');
  const prompt = buildPipelineSkillPrompt({
    skillName: 'dynamic-gate',
    contentKind: 'pipeline-prompt',
    syntaxVersion: 2,
    developerPromptRevision: createHash('sha256').update(developerPromptSnapshot).digest('hex'),
    developerPromptCommit: 'a'.repeat(40),
    developerPromptSnapshot,
    runtimeContext: runtimeContext({
      MASTER_TASK: '# Master task\n\nComplete objective.',
      SUB_CONTEXT: '## Subtask 1: Analyze\n\nAnalysis body.',
      SUB_TASKS: '## Analyze\n- Confirm evidence',
      FULL_THREAD: '# OPERATOR\n\nContinue the iteration.',
      FILE_MAP: '.\n backend/\n  src/\n   server.ts',
      PREVIOUS_SKILL_RESULT: '# Worker result\n\nVerified analysis.',
      EXECUTION_CONTEXT: JSON.stringify({
        projectId: 'project-a',
        executionId: 'execution-a',
        output: { markdownFile: '/workspace/.decision-os/cards/tasks/gate-output.md' },
      }, null, 2),
    }),
  });
  assert.equal(prompt.startsWith('# Dynamic gate\n'), true);
  assert.match(prompt, /Complete objective\./);
  assert.match(prompt, /SUBTASKS=## Subtask 1: Analyze[\s\S]*Analysis body\./);
  assert.match(prompt, /FACTS=## Analyze\n- Confirm evidence/);
  assert.match(prompt, /Continue the iteration\./);
  assert.match(prompt, /FILES=\.\n backend\/\n  src\/\n   server\.ts/);
  assert.match(prompt, /PREVIOUS=# Worker result[\s\S]*Verified analysis\./);
  assert.match(prompt, /"projectId": "project-a"/);
  assert.match(prompt, /"executionId": "execution-a"/);
  assert.match(prompt, /"markdownFile": "\/workspace\/\.decision-os\/cards\/tasks\/gate-output\.md"/);
  assert.doesNotMatch(prompt, /<[A-Z][A-Z0-9_]*>/);
  assert.doesNotMatch(prompt, /Decision OS pipeline-only prompt|Current skill:|Write the final result/);
});

test('a running pipeline prompt queues one worker then returns with the latest task conversation', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const fixture = createPromptRepository({ prefix: 'decision-os-dynamic-gate-' });
  const releaseGate = join(fixture.workspace, 'release-gate');
  const releaseWorker = join(fixture.workspace, 'release-worker');
  const fakeCodex = join(fixture.workspace, 'fake-codex-dynamic-gate.mjs');
  const taskCardId = 'master-task';
  const taskThreadId = `thread-${taskCardId}`;
  const taskCardFile = join(fixture.decisionOsRoot, 'cards', 'tasks', `${taskCardId}.md`);
  const subtaskCardId = 'existing-subtask';
  const subtaskCardFile = join(fixture.decisionOsRoot, 'cards', 'tasks', `${subtaskCardId}.md`);
  const taskThreadFile = join(fixture.decisionOsRoot, 'threads', 'tasks', `${taskThreadId}.md`);
  const sourceFile = join(fixture.workspace, 'src', 'dynamic-gate.ts');
  mkdirSync(join(taskCardFile, '..'), { recursive: true });
  mkdirSync(join(taskThreadFile, '..'), { recursive: true });
  mkdirSync(join(sourceFile, '..'), { recursive: true });
  writeFileSync(sourceFile, 'export const dynamicGate = true;\n');
  writeFileSync(join(fixture.decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }, null, 2));
  writeFileSync(taskCardFile, '# Master objective\n\nImplement the dynamic gate.');
  writeFileSync(subtaskCardFile, '# Existing subtask\n\nPreserve this complete subtask body.');
  writeFileSync(taskThreadFile, [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-initial","timestamp":"2026-07-29T01:00:00.000Z"} -->',
    '',
    'Start from the complete task conversation.',
    '',
  ].join('\n'));
  writeFileSync(join(fixture.decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [
      {
        id: taskCardId,
        title: 'Dynamic gate task',
        status: 'todo',
        labels: ['master-task'],
        x: 20,
        y: 40,
        w: 360,
        h: 220,
        comment: { contentFile: `.decision-os/cards/tasks/${taskCardId}.md` },
        facts: [],
        fields: [],
      },
      {
        id: subtaskCardId,
        title: 'Existing subtask',
        status: 'in-progress',
        labels: [],
        x: 420,
        y: 40,
        w: 360,
        h: 220,
        comment: { contentFile: `.decision-os/cards/tasks/${subtaskCardId}.md` },
        facts: [],
        fields: [],
      },
    ],
    annotations: [],
    relationships: [{
      id: 'relationship-existing-subtask',
      from: taskCardId,
      to: subtaskCardId,
      label: 'subtask',
      position: 0,
    }],
    notes: {},
    threadFiles: { [taskThreadId]: `.decision-os/threads/tasks/${taskThreadId}.md` },
  }, null, 2));
  writeFileSync(join(fixture.decisionOsRoot, 'project.json'), JSON.stringify({ id: 'dynamic-gate-project' }));
  writeFileSync(join(fixture.decisionOsRoot, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation' }));
  createSkill(fixture.workspace, 'worker');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { existsSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const skill = instructions.includes("GATE_SKILL") ? "review-output" : ((instructions.match(/Current skill: (.+)/) || [])[1] || "missing");',
    '  const output = (((instructions.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || (instructions.match(/"markdownFile": "([^"]+)"/) || [])[1]) || "").trim();',
    '  const returningGate = skill === "review-output" && instructions.includes("WORKER_RESULT");',
    '  const result = skill === "worker" ? "WORKER_RESULT" : returningGate ? "RETURNED_GATE_RESULT" : "GATE_RESULT";',
    '  writeFileSync(output, "# " + result + "\\n");',
    '  writeFileSync(output + ".input", instructions);',
    '  writeFileSync(output + ".turn", prompt);',
    '  writeFileSync(output + ".env.json", JSON.stringify({',
    '    executionId: process.env.DECISION_OS_EXECUTION_ID,',
    '    projectId: process.env.DECISION_OS_PROJECT_ID,',
    '    serverUrl: process.env.DECISION_OS_SERVER_URL,',
    '  }));',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-" + process.env.DECISION_OS_EXECUTION_ID }));',
    '  const release = skill === "worker"',
    `    ? ${JSON.stringify(releaseWorker)}`,
    `    : returningGate ? "" : ${JSON.stringify(releaseGate)};`,
    '  const finish = () => console.log(JSON.stringify({ type: "turn.completed" }));',
    '  if (!release || existsSync(release)) finish();',
    '  else {',
    '    const timer = setInterval(() => {',
    '      if (!existsSync(release)) return;',
    '      clearInterval(timer);',
    '      finish();',
    '    }, 10);',
    '  }',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  await migrateTaskCurrentState({
    decisionOsRoot: fixture.decisionOsRoot,
    projectId: 'dynamic-gate-project',
    nodeId: 'workstation',
    tasksLedgerFile: join(fixture.decisionOsRoot, 'tasks.json'),
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = {
    decisionOsRoot: fixture.decisionOsRoot,
    decisionOsSettings: { federationNodeId: 'workstation' },
  };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const startResponse = await fetch(`${baseUrl}/api/codex/skills/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ledgerId: 'tasks',
        cardId: taskCardId,
        skillName: 'review-output',
        contentKind: 'pipeline-prompt',
        codexModel: 'gpt-5.6-sol',
        codexEffort: 'max',
      }),
    });
    const started = await startResponse.json() as Record<string, any>;
    assert.equal(startResponse.status, 202, JSON.stringify(started));
    const firstExecutionId = String(started.run.executionId);
    await waitFor(
      () => taskExecutionState(runtime)?.executions.find(firstExecutionId)?.lifecycle.phase === 'running' ? true : null,
      'initial gate execution',
    );
    writeFileSync(fixture.promptFile, '# Edited after gate admission\n\nThis must not replace the running gate snapshot.');

    const queue = () => fetch(`${baseUrl}/api/codex/executions/${encodeURIComponent(firstExecutionId)}/queue-skill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skillName: 'worker', codexModel: 'gpt-5.5', codexEffort: 'high' }),
    });
    const concurrentQueueResponses = await Promise.all([queue(), queue()]);
    const concurrentQueues = await Promise.all(
      concurrentQueueResponses.map(async (response) => ({
        response,
        body: await response.json() as Record<string, any>,
      })),
    );
    assert.deepEqual(concurrentQueues.map(({ response }) => response.status), [202, 202]);
    assert.equal(new Set(concurrentQueues.map(({ body }) => body.run.id)).size, 1);
    assert.deepEqual(
      concurrentQueues.map(({ body }) => body.idempotent === true).sort(),
      [false, true],
    );
    const queued = concurrentQueues.find(({ body }) => body.idempotent !== true)?.body;
    assert.ok(queued);
    assert.equal(queued.run.queuedAfterExecutionId, firstExecutionId);
    assert.equal(queued.run.initialInputCardId, started.run.outputCardId);
    assert.deepEqual(
      queued.run.steps.map((step: Record<string, any>) =>
        step.skills.map((skill: Record<string, any>) => [skill.skillName, skill.codexModel, skill.codexEffort])),
      [[['worker', 'gpt-5.5', 'high']], [['review-output', 'gpt-5.6-sol', 'max']]],
    );
    assert.equal(queued.run.steps[1].skills[0].developerPromptSnapshot, started.pipelineRun.steps[0].skills[0].developerPromptSnapshot);
    assert.equal(queued.run.steps[1].skills[0].developerPromptRevision, started.pipelineRun.steps[0].skills[0].developerPromptRevision);
    assert.equal(queued.run.steps[1].skills[0].developerPromptCommit, started.pipelineRun.steps[0].skills[0].developerPromptCommit);

    const retryResponse = await queue();
    const retried = await retryResponse.json() as Record<string, any>;
    assert.equal(retryResponse.status, 202, JSON.stringify(retried));
    assert.equal(retried.idempotent, true);
    assert.equal(retried.run.id, queued.run.id);
    const conflictResponse = await fetch(`${baseUrl}/api/codex/executions/${encodeURIComponent(firstExecutionId)}/queue-skill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skillName: 'worker', codexModel: 'gpt-5.5', codexEffort: 'low' }),
    });
    assert.equal(conflictResponse.status, 409);

    const workerExecutionId = String(queued.run.steps[0].skills[0].executionId);
    const returningExecutionId = String(queued.run.steps[1].skills[0].executionId);
    assert.notEqual(firstExecutionId, returningExecutionId);
    assert.equal(taskExecutionState(runtime)?.executions.find(workerExecutionId)?.lifecycle.phase, 'queued');
    writeFileSync(releaseGate, '');
    await waitFor(
      () => taskExecutionState(runtime)?.executions.find(workerExecutionId)?.lifecycle.phase === 'running' ? true : null,
      'queued worker execution',
    );
    assert.equal(taskExecutionState(runtime)?.executions.find(returningExecutionId)?.lifecycle.phase, 'queued');
    writeFileSync(taskThreadFile, [
      readFileSync(taskThreadFile, 'utf8').trimEnd(),
      '',
      '# OPERATOR',
      '<!-- decision-os:note {"id":"note-latest","timestamp":"2026-07-29T01:05:00.000Z"} -->',
      '',
      'This latest operator message must reach the returning gate.',
      '',
    ].join('\n'));
    writeFileSync(releaseWorker, '');
    const returningExecution = await waitFor(
      () => {
        const execution = taskExecutionState(runtime)?.executions.find(returningExecutionId);
        return execution && ['succeeded', 'failed', 'cancelled'].includes(execution.lifecycle.phase)
          ? execution
          : null;
      },
      'returning gate completion',
    );
    assert.equal(returningExecution.lifecycle.phase, 'succeeded', JSON.stringify(returningExecution));

    const workerOutput = join(fixture.decisionOsRoot, 'cards', 'tasks', `${queued.run.steps[0].outputCardId}.md`);
    const returningOutput = join(fixture.decisionOsRoot, 'cards', 'tasks', `${queued.run.steps[1].outputCardId}.md`);
    const workerInput = readFileSync(`${workerOutput}.input`, 'utf8');
    assert.match(workerInput, /Direct previous skill result:[\s\S]*GATE_RESULT/);
    const returningInput = readFileSync(`${returningOutput}.input`, 'utf8');
    assert.match(returningInput, /# Master objective[\s\S]*Implement the dynamic gate\./);
    assert.match(returningInput, /Start from the complete task conversation\./);
    assert.match(returningInput, /This latest operator message must reach the returning gate\./);
    assert.match(returningInput, /SUB_CONTEXT[\s\S]*Existing subtask[\s\S]*Preserve this complete subtask body\./);
    assert.match(returningInput, /FILE_MAP[\s\S]*src\/[\s\S]*dynamic-gate\.ts/);
    assert.match(returningInput, /PREVIOUS_SKILL_RESULT[\s\S]*WORKER_RESULT/);
    assert.match(returningInput, new RegExp(`"threadId": "${taskThreadId}"`));
    assert.equal(readFileSync(`${returningOutput}.turn`, 'utf8'), 'Execute this admitted Decision OS pipeline stage.');
    const firstEnvironment = JSON.parse(readFileSync(`${started.run.outputFile}.env.json`, 'utf8')) as Record<string, unknown>;
    const returningEnvironment = JSON.parse(readFileSync(`${returningOutput}.env.json`, 'utf8')) as Record<string, unknown>;
    assert.equal(firstEnvironment.executionId, firstExecutionId);
    assert.equal(returningEnvironment.executionId, returningExecutionId);
    assert.equal(returningEnvironment.projectId, 'dynamic-gate-project');
    assert.equal(typeof returningEnvironment.serverUrl, 'string');
  } finally {
    writeFileSync(releaseGate, '');
    writeFileSync(releaseWorker, '');
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

test('invalid local prompt states fail before run, card, and process side effects', async () => {
  const cases: Array<{
    label: string;
    setup: () => { workspace: string; decisionOsRoot: string; promptFile: string };
    expected: RegExp;
    beforeAdmission?: (fixture: { workspace: string; decisionOsRoot: string; promptFile: string }) => void;
    race?: (context: { name: string; promptFile: string; storeFile: string }, fixture: { workspace: string; decisionOsRoot: string; promptFile: string }) => void;
  }> = [
    {
      label: 'missing',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-missing-' }),
      beforeAdmission: (fixture) => rmSync(fixture.promptFile),
      expected: /pipeline_prompt_missing/,
    },
    {
      label: 'dirty',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-dirty-' }),
      beforeAdmission: (fixture) => writeFileSync(fixture.promptFile, '# Dirty prompt'),
      expected: /pipeline_prompt_dirty/,
    },
    {
      label: 'untracked',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-untracked-', commitPrompt: false }),
      expected: /pipeline_prompt_untracked/,
    },
    {
      label: 'uncommitted',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-uncommitted-', commitPrompt: false, stagePrompt: true }),
      expected: /pipeline_prompt_uncommitted/,
    },
    {
      label: 'oversized',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-oversized-', markdown: 'x'.repeat(1_000_001) }),
      expected: /pipeline_prompt_oversized/,
    },
    {
      label: 'malformed',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-malformed-', markdown: Buffer.from([0xc3, 0x28]) }),
      expected: /pipeline_prompt_malformed/,
    },
    {
      label: 'kind mismatch',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-kind-', recordKind: 'federated-skill' }),
      expected: /pipeline_prompt_kind_mismatch/,
    },
    {
      label: 'stale',
      setup: () => createPromptRepository({ prefix: 'decision-os-prompt-stale-' }),
      race: (_context, fixture) => {
        writeFileSync(fixture.promptFile, '# Replacement committed during admission');
        git(fixture.workspace, ['add', '.decision-os/pipeline-prompts/review-output.md']);
        git(fixture.workspace, ['commit', '-q', '-m', 'Replace prompt during admission']);
      },
      expected: /pipeline_prompt_stale/,
    },
  ];
  for (const testCase of cases) {
    const fixture = testCase.setup();
    try {
      testCase.beforeAdmission?.(fixture);
      const storeFile = join(fixture.decisionOsRoot, 'codex-pipelines.json');
      const ledgerFile = join(fixture.decisionOsRoot, 'specs.json');
      const storeBefore = readFileSync(storeFile);
      const ledgerBefore = readFileSync(ledgerFile);
      let processLaunches = 0;
      if (testCase.race) {
        await assert.rejects(
          admitPipelinePromptSnapshots({
            ownerDecisionOsRoot: fixture.decisionOsRoot,
            steps: promptDefinition().steps,
            beforeGitValidation: (context) => context.name === 'review-output'
              ? testCase.race!(context, fixture)
              : undefined,
          }),
          testCase.expected,
          testCase.label,
        );
      } else {
        const result = await startPipelineRun({
          decisionOsRoot: fixture.decisionOsRoot,
          runtime: {
            scheduleCodexProcesses: () => {
              processLaunches += 1;
            },
          },
          ledgerId: 'specs',
          sourceCardId: 'source-card',
          definition: promptDefinition(),
        });
        assert.equal(result.ok, false, testCase.label);
        assert.match(`${result.code ?? ''}:${result.error ?? ''}`, testCase.expected, testCase.label);
      }
      assert.deepEqual(readFileSync(storeFile), storeBefore, testCase.label);
      assert.deepEqual(readFileSync(ledgerFile), ledgerBefore, testCase.label);
      const store = readCodexPipelineStore({ decisionOsRoot: fixture.decisionOsRoot }).store;
      assert.deepEqual(store.runs, [], testCase.label);
      assert.equal(JSON.parse(readFileSync(join(fixture.decisionOsRoot, 'specs.json'), 'utf8')).cards.length, 1, testCase.label);
      assert.equal(existsSync(join(fixture.decisionOsRoot, 'runs')), false, testCase.label);
      assert.equal(processLaunches, 0, testCase.label);
    } finally {
      rmSync(fixture.workspace, { recursive: true, force: true });
    }
  }
});

test('saved pipeline is idempotent while active and runs five isolated skills strictly in order', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-pipeline-run-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const lifecycleFile = join(workspace, 'lifecycle.txt');
  for (const name of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) createSkill(workspace, name);
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const skill = (instructions.match(/Current skill: (.+)/) || [])[1] || "missing";',
    '  const output = (instructions.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    `  appendFileSync(${JSON.stringify(lifecycleFile)}, "start:" + skill + "\\n");`,
    '  writeFileSync(output.trim(), "# " + skill + " result\\n\\nproduced-by=" + skill + "\\n");',
    '  writeFileSync(output.trim() + ".input", instructions);',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-" + skill }));',
    '  setTimeout(() => {',
    '    console.log(JSON.stringify({ type: "turn.completed" }));',
    `    appendFileSync(${JSON.stringify(lifecycleFile)}, "end:" + skill + "\\n");`,
    '  }, 35);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    store: {
      pipelines: [{ id: 'pipeline-five', name: 'Five skills', purpose: 'Order proof', stepIds: ['one', 'two', 'three'], createdAt: now, updatedAt: now }],
      steps: [
        { id: 'one', name: 'One', purpose: '', createdAt: now, updatedAt: now, skills: [
          { id: 'alpha-config', skillName: 'alpha', codexModel: null, codexEffort: null },
          { id: 'beta-config', skillName: 'beta', codexModel: 'gpt-5.5', codexEffort: 'low' },
        ] },
        { id: 'two', name: 'Two', purpose: '', createdAt: now, updatedAt: now, skills: [
          { id: 'gamma-config', skillName: 'gamma', codexModel: null, codexEffort: null },
        ] },
        { id: 'three', name: 'Three', purpose: '', createdAt: now, updatedAt: now, skills: [
          { id: 'delta-config', skillName: 'delta', codexModel: null, codexEffort: null },
          { id: 'epsilon-config', skillName: 'epsilon', codexModel: null, codexEffort: null },
        ] },
      ],
      runs: [],
      skillLibrary: [{ skillName: 'alpha', favorite: false, tags: [], defaultCodexModel: 'gpt-5.4', defaultCodexEffort: 'high', updatedAt: now }],
      authoredContent: basePromptAuthoredContent(),
      activeWorkspaceRun: null,
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const startResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'pipeline-five' }),
    });
    assert.equal(startResponse.status, 202);
    const started = await startResponse.json() as Record<string, any>;
    const pipelineRunId = started.run.id as string;
    assert.equal(started.run.steps.length, 3);
    assert.equal(started.run.steps.flatMap((step: Record<string, any>) => step.skills).length, 5);
    assert.equal(started.run.steps[0].skills[0].codexModel, 'gpt-5.4');
    assert.equal(started.run.steps[0].skills[0].codexEffort, 'high');
    assert.equal(started.run.steps[0].skills[1].codexModel, 'gpt-5.5');
    assert.equal(started.run.steps[0].skills[1].codexEffort, 'low');
    assert.equal(started.run.outputParentCardId, 'source-card');
    assert.deepEqual(started.run.steps.map((step: Record<string, any>) => step.outputSubtaskPosition), [0, 1, 2]);

    const queuedResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'pipeline-five' }),
    });
    assert.equal(queuedResponse.status, 202);
    const queuedBody = await queuedResponse.json() as Record<string, any>;
    // The scheduler may advance the active run before this response; idempotency guarantees its identity, not a transient phase.
    assert.equal(queuedBody.run.id, pipelineRunId);
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.runs.length, 1);
    const pendingLedger = JSON.parse(readFileSync(join(decisionOsRoot, 'specs.json'), 'utf8')) as Record<string, any>;
    const pendingSourceCard = pendingLedger.cards.find((card: Record<string, any>) => card.id === 'source-card');
    assert.equal(pendingSourceCard.executionStatus, undefined);
    assert.equal(pendingSourceCard.executionRunId, undefined);
    assert.equal(pendingSourceCard.codexActiveRunId, undefined);
    assert.equal(pendingSourceCard.codexActiveExecutionId, undefined);

    const completed = await waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(pipelineRunId)}`)
        .then((response) => response.json()) as Record<string, any>;
      return detail.run?.status === 'complete' ? detail.run : null;
    }, 'pipeline completion');
    assert.equal(completed.steps.every((step) => step.status === 'complete'), true);
    const immutableManifest = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === pipelineRunId);
    assert.equal(immutableManifest?.status, 'pending');
    assert.equal(immutableManifest?.outputParentCardId, 'source-card');
    assert.deepEqual(immutableManifest?.steps.map((step) => step.outputSubtaskPosition), [0, 1, 2]);
    assert.equal(immutableManifest?.steps.every((step) => step.skills.every((skill) => skill.status === 'pending')), true);
    assert.equal(immutableManifest?.steps.every((step) => step.skills.every((skill) => skill.processId === undefined && skill.processStartTime === undefined)), true);
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.activeWorkspaceRun, null);
    const allSkills = completed.steps.flatMap((step) => step.skills);
    assert.equal(new Set(allSkills.map((skill) => skill.runId)).size, 5);
    assert.equal(allSkills.every((skill) => existsSync(skill.stdoutFile) && existsSync(skill.stderrFile)), true);
    assert.deepEqual(readFileSync(lifecycleFile, 'utf8').trim().split('\n').slice(0, 10), [
      'start:alpha', 'end:alpha', 'start:beta', 'end:beta', 'start:gamma', 'end:gamma',
      'start:delta', 'end:delta', 'start:epsilon', 'end:epsilon',
    ]);
    const betaInput = `${join(decisionOsRoot, 'cards', 'specs', completed.steps[0].outputCardId + '.md')}.input`;
    const gammaInput = `${join(decisionOsRoot, 'cards', 'specs', completed.steps[1].outputCardId + '.md')}.input`;
    assert.match(readFileSync(betaInput, 'utf8'), /produced-by=alpha/);
    assert.match(readFileSync(gammaInput, 'utf8'), /produced-by=beta/);
    const ledger = JSON.parse(readFileSync(join(decisionOsRoot, 'specs.json'), 'utf8')) as Record<string, any>;
    const generated = ledger.cards.filter((card: Record<string, any>) => card.cardType === 'codex-skill-run' && card.codexPipelineRunId === completed.id);
    assert.equal(generated.length, 3);
    const sourceCard = ledger.cards.find((card: Record<string, any>) => card.id === 'source-card');
    assert.equal(sourceCard.executionStatus, undefined);
    assert.equal(sourceCard.executionRunId, undefined);
    assert.equal(sourceCard.codexActiveRunId, undefined);
    assert.equal(sourceCard.codexQueuedPipelineRunId, undefined);
    assert.equal(sourceCard.codexQueuedRunId, undefined);
    assert.equal(generated.every((card: Record<string, any>) => card.w === 700), true);
    const outputRelationships = ledger.relationships.slice(-3);
    assert.deepEqual(outputRelationships.map((relationship: Record<string, any>) => relationship.from), ['source-card', 'source-card', 'source-card']);
    assert.deepEqual(outputRelationships.map((relationship: Record<string, any>) => relationship.label), ['subtask', 'subtask', 'subtask']);
    assert.deepEqual(outputRelationships.map((relationship: Record<string, any>) => relationship.position), [0, 1, 2]);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('saved pipeline failure cancels every dependent execution without launching it', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-pipeline-failure-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const invocations = join(workspace, 'invocations.txt');
  for (const name of ['fails', 'blocked']) createSkill(workspace, name);
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const skill = (instructions.match(/Current skill: (.+)/) || [])[1] || "missing";',
    `  appendFileSync(${JSON.stringify(invocations)}, skill + "\\n");`,
    '  console.log(JSON.stringify({ type: "turn.failed", error: { message: "injected failure" } }));',
    '  process.exitCode = 7;',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['fails', 'blocked'],
    store: {
      pipelines: [{ id: 'failure-pipeline', name: 'Failure pipeline', purpose: '', stepIds: ['step'], createdAt: now, updatedAt: now }],
      steps: [{ id: 'step', name: 'Step', purpose: '', createdAt: now, updatedAt: now, skills: [
        { id: 'fails-config', skillName: 'fails', codexModel: null, codexEffort: null },
        { id: 'blocked-config', skillName: 'blocked', codexModel: null, codexEffort: null },
      ] }],
      runs: [], skillLibrary: [], authoredContent: basePromptAuthoredContent(), activeWorkspaceRun: null,
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${baseUrl}/api/codex/pipelines/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'failure-pipeline' }),
    });
    assert.equal(response.status, 202);
    const started = await response.json() as Record<string, any>;
    const [firstExecution, secondExecution] = started.run.steps[0].skills as Array<Record<string, any>>;
    await waitFor(() => {
      const executions = taskExecutionState(runtime)?.executions.byPipelineRunId(started.run.id) ?? [];
      return executions.find((execution) => execution.metadata.executionId === firstExecution.executionId)?.lifecycle.phase === 'failed'
        && executions.find((execution) => execution.metadata.executionId === secondExecution.executionId)?.lifecycle.phase === 'cancelled'
        ? true
        : null;
    }, 'dependent cancellation');
    const failed = await waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(started.run.id)}`)
        .then((entry) => entry.json()) as Record<string, any>;
      return detail.run?.status === 'failed' ? detail.run : null;
    }, 'failed pipeline settlement');
    assert.deepEqual(failed.steps[0].skills.map((skill: Record<string, unknown>) => skill.status), ['failed', 'cancelled']);
    assert.deepEqual(readFileSync(invocations, 'utf8').trim().split('\n'), ['fails']);
    const executions = taskExecutionState(runtime)?.executions.byPipelineRunId(started.run.id) ?? [];
    assert.equal(executions.find((execution) => execution.metadata.executionId === firstExecution.executionId)?.lifecycle.phase, 'failed');
    const dependent = executions.find((execution) => execution.metadata.executionId === secondExecution.executionId);
    assert.equal(dependent?.lifecycle.phase, 'cancelled');
    assert.equal(dependent?.lifecycle.result?.summary, 'pipeline_dependency_failed');
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('saved pipeline restart creates linked immutable run and execution history', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-pipeline-replacement-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  createSkill(workspace, 'alpha');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (instructions.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    '  writeFileSync(output.trim(), "# immutable result\\n");',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['alpha'],
    store: {
      pipelines: [{ id: 'restart-pipeline', name: 'Restart pipeline', purpose: '', stepIds: ['step'], createdAt: now, updatedAt: now }],
      steps: [{ id: 'step', name: 'Step', purpose: '', createdAt: now, updatedAt: now, skills: [
        { id: 'alpha-config', skillName: 'alpha', codexModel: null, codexEffort: null },
      ] }],
      runs: [], skillLibrary: [], authoredContent: basePromptAuthoredContent(), activeWorkspaceRun: null,
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const firstResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'restart-pipeline' }),
    });
    const first = await firstResponse.json() as Record<string, any>;
    await waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(first.run.id)}`)
        .then((entry) => entry.json()) as Record<string, any>;
      return detail.run?.status === 'complete' ? detail.run : null;
    }, 'first pipeline completion');
    const priorManifestBytes = readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8');
    const restartResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(first.run.id)}/restart`, { method: 'POST' });
    assert.equal(restartResponse.status, 202);
    const replacement = await restartResponse.json() as Record<string, any>;
    assert.notEqual(replacement.run.id, first.run.id);
    assert.equal(replacement.run.restartOfPipelineRunId, first.run.id);
    assert.notEqual(replacement.run.steps[0].skills[0].executionId, first.run.steps[0].skills[0].executionId);
    const store = readCodexPipelineStore({ decisionOsRoot }).store;
    assert.equal(store.runs.length, 2);
    assert.equal(store.runs[0].id, first.run.id);
    assert.equal(store.runs[1].restartOfPipelineRunId, first.run.id);
    assert.match(priorManifestBytes, new RegExp(first.run.id));
    const replacementExecutions = taskExecutionState(runtime)?.executions.byPipelineRunId(replacement.run.id) ?? [];
    assert.equal(replacementExecutions[0].metadata.restartOfExecutionId, first.run.steps[0].skills[0].executionId);
    await waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(replacement.run.id)}`)
        .then((entry) => entry.json()) as Record<string, any>;
      return detail.run?.status === 'complete' ? detail.run : null;
    }, 'replacement pipeline completion');
    const original = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(first.run.id)}`)
      .then((entry) => entry.json()) as Record<string, any>;
    assert.equal(original.run.status, 'complete');
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('direct temporary runs inherit skill defaults, preserve snapshots, and honor explicit overrides', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-direct-default-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  createSkill(workspace, 'alpha');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (instructions.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    '  const args = process.argv.slice(2);',
    '  writeFileSync(output.trim(), "model=" + args[args.indexOf("--model") + 1] + "\\neffort=" + args[args.indexOf("-c") + 1] + "\\n");',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['alpha'],
    store: {
      pipelines: [], steps: [], runs: [], authoredContent: basePromptAuthoredContent(), activeWorkspaceRun: null,
      skillLibrary: [{ skillName: 'alpha', favorite: false, tags: [], defaultCodexModel: 'gpt-5.4', defaultCodexEffort: 'high', updatedAt: now }],
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const inheritedResponse = await fetch(`${baseUrl}/api/codex/skills/process`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'alpha' }),
    });
    assert.equal(inheritedResponse.status, 202);
    const inherited = await inheritedResponse.json() as Record<string, any>;
    assert.equal(inherited.run.codexModel, 'gpt-5.4');
    assert.equal(inherited.run.codexEffort, 'high');
    await waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(inherited.pipelineRun.id)}`)
        .then((response) => response.json()) as Record<string, any>;
      return detail.run?.status === 'complete' ? true : null;
    }, 'inherited direct run');
    const afterFirst = readCodexPipelineStore({ decisionOsRoot }).store;
    writeCodexPipelineStore({
      decisionOsRoot,
      availableSkillNames: ['alpha'],
      store: {
        ...afterFirst,
        skillLibrary: [{ skillName: 'alpha', favorite: false, tags: [], defaultCodexModel: 'gpt-5.5', defaultCodexEffort: 'low', updatedAt: new Date().toISOString() }],
      },
    });
    const stable = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.id === inherited.pipelineRun.id);
    assert.equal(stable?.steps[0].skills[0].codexModel, 'gpt-5.4');
    assert.equal(stable?.steps[0].skills[0].codexEffort, 'high');

    const explicitResponse = await fetch(`${baseUrl}/api/codex/skills/process`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'alpha', codexModel: 'gpt-5.6-sol', codexEffort: 'ultra' }),
    });
    assert.equal(explicitResponse.status, 202);
    const explicit = await explicitResponse.json() as Record<string, any>;
    assert.equal(explicit.run.codexModel, 'gpt-5.6-sol');
    assert.equal(explicit.run.codexEffort, 'ultra');
    await waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(explicit.pipelineRun.id)}`)
        .then((response) => response.json()) as Record<string, any>;
      return detail.run?.status === 'complete' ? true : null;
    }, 'explicit direct run');
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('workspace capacity runs two pipelines concurrently and promotes the FIFO queue', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-capacity-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const lifecycleFile = join(workspace, 'lifecycle.txt');
  const releaseFile = join(workspace, 'release');
  createSkill(workspace, 'alpha');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, any>;
  ledger.cards.push(
    { ...ledger.cards[0], id: 'source-card-2', title: 'Source Card 2' },
    { ...ledger.cards[0], id: 'source-card-3', title: 'Source Card 3' },
  );
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({ maxConcurrentCodexProcesses: 2 }));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync, existsSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (instructions.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    `  appendFileSync(${JSON.stringify(lifecycleFile)}, "start" + String.fromCharCode(10));`,
    '  writeFileSync(output.trim(), "# result\\n");',
    '  const release = setInterval(() => {',
    `    if (!existsSync(${JSON.stringify(releaseFile)})) return;`,
    '    clearInterval(release);',
    '    console.log(JSON.stringify({ type: "turn.completed" }));',
    `    appendFileSync(${JSON.stringify(lifecycleFile)}, "end" + String.fromCharCode(10));`,
    '  }, 10);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((runtime.decisionOsSettings as Record<string, unknown>).maxConcurrentCodexProcesses, 2);
    assert.equal((runtime.globalCodexProcessCapacity as () => number)(), 2);
    const starts: Record<string, any>[] = [];
    for (let index = 0; index < 3; index += 1) {
      const response = await fetch(`${baseUrl}/api/codex/skills/process`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledgerId: 'specs', cardId: `source-card${index === 0 ? '' : `-${index + 1}`}`, skillName: 'alpha' }),
      });
      assert.equal(response.status, 202);
      starts.push(await response.json() as Record<string, any>);
    }
    assert.deepEqual(starts.map((entry) => entry.pipelineRun.status), ['pending', 'pending', 'pending']);
    assert.equal(starts.every((entry) => Number.isInteger(entry.queuePosition) && entry.queuePosition >= 1), true);
    const beforeRelease = await waitFor(() => {
      if (!existsSync(lifecycleFile)) return null;
      const lines = readFileSync(lifecycleFile, 'utf8').trim().split('\n');
      return lines.filter((line) => line === 'start').length === 2 ? lines : null;
    }, 'two concurrent capacity starts');
    assert.deepEqual(beforeRelease, ['start', 'start']);
    writeFileSync(releaseFile, 'release\n');
    await Promise.all(starts.map((entry) => waitForAsync(async () => {
      const detail = await fetch(`${baseUrl}/api/codex/pipelines/runs/${encodeURIComponent(entry.pipelineRun.id)}`)
        .then((response) => response.json()) as Record<string, any>;
      return detail.run?.status === 'complete' ? detail.run : null;
    }, 'capacity queue completion')));
    assert.deepEqual(
      readCodexPipelineStore({ decisionOsRoot }).store.runs.map((run) => run.status),
      ['pending', 'pending', 'pending'],
    );
    const lifecycle = readFileSync(lifecycleFile, 'utf8').trim().split('\n');
    assert.deepEqual(lifecycle.slice(0, 2), ['start', 'start']);
    assert.equal(lifecycle.filter((line) => line === 'start').length, 3);
    assert.equal(lifecycle.filter((line) => line === 'end').length, 3);
    assert.ok(lifecycle.findIndex((line, index) => line === 'start' && index >= 2) > lifecycle.indexOf('end'));
  } finally {
    if (!existsSync(releaseFile)) writeFileSync(releaseFile, 'release\n');
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('one catalog-level server skill executes directly and in saved pipelines from two managed projects', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const masterRoot = mkdtempSync(join(tmpdir(), 'decision-os-shared-server-skill-'));
  const masterDecisionOsRoot = join(masterRoot, '.decision-os');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  writeFileSync(join(masterDecisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  const projects = [join(masterRoot, 'repos', 'one'), join(masterRoot, 'repos', 'two')];
  for (const workspace of projects) {
    const decisionOsRoot = join(workspace, '.decision-os');
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] }));
    writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
      cards: [{ id: 'source-card', title: 'Source', x: 0, y: 0, w: 300, h: 180, comment: { what: 'Input' } }],
      annotations: [], relationships: [], notes: {},
    }));
  }
  const now = '2026-07-13T00:00:00.000Z';
  mkdirSync(join(masterDecisionOsRoot, 'pipeline-prompts'), { recursive: true });
  writeFileSync(join(masterDecisionOsRoot, 'pipeline-prompts', 'SYSTEM_PROMPT.md'), 'platform: <PLATFORM>');
  writeFileSync(join(masterDecisionOsRoot, 'pipeline-prompts', 'SKILL.md'), testSkillWrapper);
  writeCodexPipelineStore({
    decisionOsRoot: masterDecisionOsRoot,
    availableSkillNames: ['shared-catalog-skill'],
    store: {
      pipelines: [{ id: 'shared-pipeline', name: 'Shared pipeline', purpose: '', stepIds: ['shared-step'], createdAt: now, updatedAt: now }],
      steps: [{ id: 'shared-step', name: 'Shared step', purpose: '', createdAt: now, updatedAt: now, skills: [{ id: 'shared-config', skillName: 'shared-catalog-skill', contentKind: 'federated-skill', codexModel: null, codexEffort: null }] }],
      runs: [], skillLibrary: [], authoredContent: basePromptAuthoredContent(), activeWorkspaceRun: null,
    },
  });
  const skillDirectory = join(masterRoot, '.skills', 'shared-catalog-skill');
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(join(skillDirectory, 'SKILL.md'), '---\nname: shared-catalog-skill\ndescription: Shared catalog workflow\n---\n\n# Server-only instruction\n');
  const fakeCodex = join(masterRoot, 'fake-codex.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node', 'import { writeFileSync } from "node:fs";', 'let prompt = "";',
    'const developerArgument = process.argv.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    'const instructions = developerArgument ? JSON.parse(developerArgument.slice("developer_instructions=".length)) : "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });', 'process.stdin.on("end", () => {',
    ' const output = (instructions.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    ' writeFileSync(output.trim(), "# shared result\\n");', ' writeFileSync(output.trim() + ".input", instructions);',
    ' console.log(JSON.stringify({ type: "turn.completed" }));', '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  git(masterRoot, ['init', '-q']);
  git(masterRoot, ['config', 'user.name', 'Prompt Test']);
  git(masterRoot, ['config', 'user.email', 'prompt@example.test']);
  git(masterRoot, ['add', '.decision-os']);
  git(masterRoot, ['commit', '-q', '-m', 'Seed server pipeline']);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot: masterDecisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const catalog = discoverDecisionOsProjects({ masterRoot, masterDecisionOsRoot }).filter((project) => projects.includes(project.root));
  try {
    assert.equal(catalog.length, 2);
    assert.equal(readCodexPipelineStore({ decisionOsRoot: masterDecisionOsRoot }).store.pipelines[0].id, 'shared-pipeline');
    assert.equal(catalog.every((project) => readCodexPipelineStore({ decisionOsRoot: project.decisionOsRoot }).store.pipelines.length === 0), true);
    for (const project of catalog) {
      const scoped = `${baseUrl}/p/${encodeURIComponent(project.id)}`;
      const libraryResponse = await fetch(`${scoped}/api/codex/skills`);
      const library = await libraryResponse.json() as Record<string, any>;
      assert.equal(library.skills.some((skill: Record<string, unknown>) => skill.name === 'shared-catalog-skill'), true);
      const pipelineLibrary = await fetch(`${scoped}/api/codex/pipelines`).then((response) => response.json()) as Record<string, any>;
      assert.deepEqual(
        pipelineLibrary.pipelines.filter((pipeline: Record<string, unknown>) => pipeline.id === 'shared-pipeline').map((pipeline: Record<string, unknown>) => [pipeline.id, pipeline.scope]),
        [['shared-pipeline', 'server']],
      );
      const directResponse = await fetch(`${scoped}/api/codex/skills/process`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'shared-catalog-skill' }),
      });
      assert.equal(directResponse.status, 202);
      const direct = await directResponse.json() as Record<string, any>;
      await waitForAsync(async () => {
        const detail = await fetch(`${scoped}/api/codex/pipelines/runs/${encodeURIComponent(direct.pipelineRun.id)}`)
          .then((response) => response.json()) as Record<string, any>;
        return detail.run?.status === 'complete' ? true : null;
      }, 'shared direct run');
      assert.equal(
        readCodexPipelineStore({ decisionOsRoot: project.decisionOsRoot }).store.runs
          .find((run) => run.id === direct.pipelineRun.id)?.status,
        'pending',
      );
      const directInput = join(project.decisionOsRoot, 'cards', 'specs', `${direct.run.outputCardId}.md.input`);
      assert.match(readFileSync(directInput, 'utf8'), /# Server-only instruction/);
      const pipelineResponse = await fetch(`${scoped}/api/codex/pipelines/runs`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'shared-pipeline' }),
      });
      assert.equal(pipelineResponse.status, 202);
      const pipeline = await pipelineResponse.json() as Record<string, any>;
      const completed = await waitForAsync(async () => {
        const detail = await fetch(`${scoped}/api/codex/pipelines/runs/${encodeURIComponent(pipeline.run.id)}`)
          .then((response) => response.json()) as Record<string, any>;
        return detail.run?.status === 'complete' ? detail.run : null;
      }, 'shared saved pipeline');
      const pipelineInput = join(project.decisionOsRoot, 'cards', 'specs', `${completed.steps[0].outputCardId}.md.input`);
      assert.match(readFileSync(pipelineInput, 'utf8'), /Decision OS server skill package:/);
    }
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(masterRoot, { recursive: true, force: true });
  }
});
