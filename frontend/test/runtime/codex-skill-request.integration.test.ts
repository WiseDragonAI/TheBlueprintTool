/**
 * WHAT: Integration coverage for frontend Codex skill start, poll, continue, and cancellation requests.
 * WHY: Widget request routing must preserve run identity while lifecycle notes arrive independently.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCodexSkills, loadCodexSkillsResult } from '../../src/runtime/codex/effect/load-codex-skills.js';
import { loadCodexPipelines } from '../../src/runtime/codex/effect/load-codex-pipelines.js';
import { loadCodexSkillLibrary } from '../../src/runtime/codex/effect/load-codex-skill-library.js';
import { loadCodexSkillRevision, loadCodexSkillRevisionHistory } from '../../src/runtime/codex/effect/load-codex-skill-revision.js';
import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
import { requestCardSkillRunCancel } from '../../src/runtime/codex/effect/request-card-skill-run-cancel.js';
import { requestThreadCodexSessionDelete } from '../../src/runtime/codex/effect/request-thread-codex-session-delete.js';
import { requestCardSkillRunContinue } from '../../src/runtime/codex/effect/request-card-skill-run-continue.js';
import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
import { requestThreadCodexProcess } from '../../src/runtime/codex/effect/request-thread-codex-process.js';
import { requestCodexPipelineSave } from '../../src/runtime/codex/effect/request-codex-pipeline-save.js';
import { requestCodexPipelineRun } from '../../src/runtime/codex/effect/request-codex-pipeline-run.js';
import { requestCodexPipelineRunCancel, requestCodexPipelineRunRestart, requestCodexPipelineRunStatus } from '../../src/runtime/codex/effect/request-codex-pipeline-run-status.js';
import { requestCodexSkillLibrarySave, requestCodexSkillRevisionRetry } from '../../src/runtime/codex/effect/request-codex-skill-library-save.js';
import { requestCodexSkillLibraryCreate } from '../../src/runtime/codex/effect/request-codex-skill-library-create.js';
import { requestCodexSkillFavoriteSave, requestCodexSkillMetadataSave } from '../../src/runtime/codex/effect/request-codex-skill-favorite-save.js';
import { bindCardSkillRunLogConsumer, bindCardSkillRunWidget, bindPipelineStepRunWidget, pipelineLatestLabel, purgeCardSkillRunLog, resumeExternallyStartedCardSkillRun, resumeExternallyStartedPipelineRun, unbindCardSkillRunLogConsumer } from '../../src/runtime/codex/effect/poll-card-skill-run.js';
import type { CardSkillRunEvent, CardSkillRunStatus, CardSkillRunSummary } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
import { cardCodexRunId, cardCodexThreadRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
import { groupSequentialToolCalls, mergeThreadRunEvents } from '../../src/runtime/codex/helper/thread-run-log.js';
import { threadCodexCardId } from '../../src/runtime/codex/helper/thread-codex-card-id.js';
import { state } from '../../src/runtime/state.js';

type FakeNode = {
  dataset: Record<string, string>;
  disabled: boolean;
  hidden: boolean;
  onclick?: (event: Event) => void;
  setAttribute: () => void;
  textContent: string;
  value: string;
};

function fakeNode(): FakeNode {
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    setAttribute() {},
    textContent: '',
    value: ''
  };
}

function fakeCodexRunWidget(): HTMLElement & { nodes: Record<string, FakeNode> } {
  const selectors = [
    '[data-codex-run-cancel]',
    '[data-codex-run-continue]',
    '[data-codex-run-effort]',
    '[data-codex-run-files]',
    '[data-codex-run-latest]',
    '[data-codex-run-messages]',
    '[data-codex-run-metadata]',
    '[data-codex-run-model]',
    '[data-codex-run-new-session]',
    '[data-codex-run-context]',
    '[data-codex-run-restart]',
    '[data-codex-run-retry]',
    '[data-codex-run-source]',
    '[data-codex-run-status]',
    '[data-codex-run-timer]',
    '[data-codex-run-tools]'
  ];
  const nodes = Object.fromEntries(selectors.map((selector) => [selector, fakeNode()])) as Record<string, FakeNode>;
  return {
    dataset: {},
    nodes,
    querySelector(selector: string) {
      return nodes[selector] ?? null;
    }
  } as unknown as HTMLElement & { nodes: Record<string, FakeNode> };
}

function runEvent(input: Partial<CardSkillRunEvent> & { line: number; kind: string }): CardSkillRunEvent {
  return {
    runId: input.runId ?? 'codex-skill-5000-log',
    line: input.line,
    source: input.source ?? 'jsonl',
    sourceLine: input.sourceLine ?? input.line,
    type: input.type ?? 'item.completed',
    kind: input.kind,
    title: input.title ?? input.tool ?? input.kind,
    text: input.text ?? '',
    status: input.status ?? '',
    itemId: input.itemId ?? '',
    tool: input.tool ?? '',
    output: input.output ?? '',
    exitCode: input.exitCode ?? '',
    severity: input.severity ?? 'info',
    persist: input.persist ?? false,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for condition.');
}

test('loadCodexSkills returns server skill summaries', async () => {
  const previousFetch = globalThis.fetch;
  try {
    const summary = {
      name: 'analysis',
      description: 'Analyze code',
      source: 'workspace',
      editable: true,
      readOnlyReason: null,
      revision: 'revision-a',
      defaultCodexModel: 'gpt-5.5',
      defaultCodexEffort: 'high',
      effectiveCodexModel: 'gpt-5.5',
      effectiveCodexEffort: 'high'
    };
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, '/api/codex/skills');
      return new Response(JSON.stringify({ ok: true, skills: [summary] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const skills = await loadCodexSkills();
    assert.deepEqual(skills, [summary]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('loadCodexSkillsResult distinguishes catalog failure from a valid empty catalog', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Catalog unavailable.' }), { status: 503 })) as typeof fetch;
    const failed = await loadCodexSkillsResult();
    assert.equal(failed.ok, false);
    assert.equal(failed.statusCode, 503);
    assert.equal(failed.error, 'Catalog unavailable.');
    assert.deepEqual(failed.skills, []);
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, skills: [] }), { status: 200 })) as typeof fetch;
    const empty = await loadCodexSkillsResult();
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.skills, []);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('skill creation keeps shared content projectless and workspace content project-scoped', async () => {
  const previousFetch = globalThis.fetch;
  const kinds = ['federated-skill', 'workspace-skill', 'pipeline-prompt'] as const;
  let index = 0;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const contentKind = kinds[index];
      assert.equal(url, contentKind === 'workspace-skill'
        ? '/p/project-a/api/codex/skill-library'
        : '/api/codex/skill-library');
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.deepEqual(body, {
        name: `content-${index}`,
        description: `Description ${index}`,
        instructions: `Instructions ${index}`,
        contentKind: kinds[index],
      });
      assert.equal('path' in body, false);
      index += 1;
      return new Response(JSON.stringify({
        ok: true,
        skill: {
          name: String(body.name),
          description: String(body.description),
          contentKind,
          executionVisibility: contentKind === 'pipeline-prompt' ? 'pipeline-only' : 'agent',
        },
      }), { status: 201 });
    }) as typeof fetch;
    for (let requestIndex = 0; requestIndex < kinds.length; requestIndex += 1) {
      const result = await requestCodexSkillLibraryCreate({
        name: `content-${requestIndex}`,
        description: `Description ${requestIndex}`,
        instructions: `Instructions ${requestIndex}`,
        contentKind: kinds[requestIndex],
        requestProjectId: 'project-a',
      });
      assert.equal(result.ok, true);
      assert.equal(result.skill?.contentKind, kinds[requestIndex]);
      assert.equal(result.skill?.executionVisibility, kinds[requestIndex] === 'pipeline-prompt' ? 'pipeline-only' : 'agent');
    }
    assert.equal(index, kinds.length);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('server-owned skill authoring uses the projectless detail, revision, and metadata routes', async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/revisions?limit=50')) {
        return new Response(JSON.stringify({ ok: true, history: [], nextCursor: null }), { status: 200 });
      }
      if (url.endsWith('/revisions/commit-a')) {
        return new Response(JSON.stringify({
          ok: true,
          revision: { commit: 'commit-a', authoredAt: '2026-07-28T00:00:00.000Z', subject: 'Revise', markdown: '# Skill', patch: '' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        ok: true,
        skill: {
          name: 'global-skill',
          markdown: '# Skill',
          references: [],
          history: [],
        },
      }), { status: 200 });
    }) as typeof fetch;

    await loadCodexSkillLibrary('global-skill', '');
    await requestCodexSkillLibrarySave({
      skillName: 'global-skill',
      markdown: '# Skill',
      revision: 'revision-a',
      defaultCodexModel: null,
      defaultCodexEffort: null,
      requestProjectId: '',
    });
    await requestCodexSkillMetadataSave('global-skill', { tags: ['Implementation'] }, '');
    await loadCodexSkillRevisionHistory('global-skill', { requestProjectId: '' });
    await loadCodexSkillRevision('global-skill', 'commit-a', '');
    await requestCodexSkillRevisionRetry({
      skillName: 'global-skill',
      contentRevision: 'revision-a',
      recoveryToken: 'retry-a',
      requestProjectId: '',
    });

    assert.deepEqual(requests, [
      { url: '/api/codex/server-skills/global-skill', method: 'GET' },
      { url: '/api/codex/server-skills/global-skill', method: 'PUT' },
      { url: '/api/codex/server-skills/global-skill', method: 'PUT' },
      { url: '/api/codex/server-skills/global-skill/revisions?limit=50', method: 'GET' },
      { url: '/api/codex/server-skills/global-skill/revisions/commit-a', method: 'GET' },
      { url: '/api/codex/server-skills/global-skill/revisions/retry', method: 'POST' },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('authored-content read, save, retry, and history requests retain one explicit project context', async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/revisions?limit=50')) {
        return new Response(JSON.stringify({ ok: true, history: [], nextCursor: null }), { status: 200 });
      }
      if (url.endsWith('/revisions/commit-a')) {
        return new Response(JSON.stringify({
          ok: true,
          revision: { commit: 'commit-a', authoredAt: '2026-07-28T00:00:00.000Z', subject: 'Revise', markdown: '# Prompt', patch: '' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        ok: true,
        skill: {
          name: 'shared-prompt',
          markdown: '# Prompt',
          revision: 'revision-a',
          contentKind: 'pipeline-prompt',
          executionVisibility: 'pipeline-only',
        },
      }), { status: 200 });
    }) as typeof fetch;

    await loadCodexSkillLibrary('shared-prompt', 'project-a');
    await requestCodexSkillLibrarySave({
      skillName: 'shared-prompt',
      markdown: '# Prompt',
      revision: 'revision-a',
      defaultCodexModel: null,
      defaultCodexEffort: null,
      requestProjectId: 'project-a',
    });
    await requestCodexSkillRevisionRetry({
      skillName: 'shared-prompt',
      contentRevision: 'revision-a',
      recoveryToken: 'recovery-a',
      requestProjectId: 'project-a',
    });
    await loadCodexSkillRevisionHistory('shared-prompt', { requestProjectId: 'project-a' });
    await loadCodexSkillRevision('shared-prompt', 'commit-a', 'project-a');

    assert.deepEqual(requests, [
      { url: '/p/project-a/api/codex/skill-library/shared-prompt', method: 'GET' },
      { url: '/p/project-a/api/codex/skill-library/shared-prompt', method: 'PUT' },
      { url: '/p/project-a/api/codex/skill-library/shared-prompt/revisions/retry', method: 'POST' },
      { url: '/p/project-a/api/codex/skill-library/shared-prompt/revisions?limit=50', method: 'GET' },
      { url: '/p/project-a/api/codex/skill-library/shared-prompt/revisions/commit-a', method: 'GET' },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('pipeline clients preserve ordered reusable definitions and lifecycle request contracts', async () => {
  const previousFetch = globalThis.fetch;
  const pipeline = {
    id: 'delivery/path',
    name: 'Delivery path',
    purpose: 'Run ordered work.',
    stepIds: ['step-a'],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z'
  };
  const step = {
    id: 'step-a',
    name: 'Analyze',
    purpose: 'Read the source.',
    skills: [{ id: 'skill-a', skillName: 'analysis', contentKind: 'workspace-skill' as const, codexModel: null, codexEffort: 'high' as const }],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z'
  };
  const availableContent = [{
    name: 'pipeline-outline',
    description: 'Pipeline-only outline.',
    source: 'pipeline-prompt',
    editable: true,
    readOnlyReason: null,
    revision: 'prompt-a',
    defaultCodexModel: null,
    defaultCodexEffort: null,
    effectiveCodexModel: '',
    effectiveCodexEffort: '',
    contentKind: 'pipeline-prompt',
    executionVisibility: 'pipeline-only',
  }];
  let requestIndex = 0;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requestIndex += 1;
      if (requestIndex === 1) {
        assert.equal(url, '/api/codex/pipelines');
        assert.equal(init, undefined);
        return new Response(JSON.stringify({ ok: true, pipelines: [pipeline], steps: [step], availableContent, empty: false, invalidReferences: [], issues: [] }), { status: 200 });
      }
      if (requestIndex === 2 || requestIndex === 3) {
        assert.equal(url, requestIndex === 2 ? '/api/codex/pipelines' : '/api/codex/pipelines/delivery%2Fpath');
        assert.equal(init?.method, requestIndex === 2 ? 'POST' : 'PUT');
        assert.deepEqual(JSON.parse(String(init?.body)), {
          pipeline: { id: pipeline.id, name: pipeline.name, purpose: pipeline.purpose, stepIds: ['step-a'] },
          steps: [{ id: step.id, name: step.name, purpose: step.purpose, skills: step.skills }]
        });
        return new Response(JSON.stringify({ ok: true, pipeline, pipelines: [pipeline], steps: [step], invalidReferences: [], issues: [] }), { status: requestIndex === 2 ? 201 : 200 });
      }
      if (requestIndex === 4) {
        assert.equal(url, '/api/codex/pipelines/runs');
        assert.equal(init?.method, 'POST');
        assert.deepEqual(JSON.parse(String(init?.body)), { ledgerId: 'specs', sourceCardId: 'card-a', pipelineId: pipeline.id });
        return new Response(JSON.stringify({ ok: true, run: { id: 'run-a', status: 'pending' }, queuePosition: 3, invalidReferences: [] }), { status: 202 });
      }
      if (requestIndex === 5) {
        assert.equal(url, '/api/codex/pipelines/runs/run%2Fa');
        assert.equal(init, undefined);
        return new Response(JSON.stringify({ ok: true, status: 'running', canCancel: true, canRestart: false, canContinue: false }), { status: 200 });
      }
      if (requestIndex === 6) {
        assert.equal(url, '/api/codex/pipelines/runs/run%2Fa/cancel');
        assert.equal(init?.method, 'POST');
        assert.deepEqual(JSON.parse(String(init?.body)), { executionId: 'execution-a' });
        return new Response(JSON.stringify({ ok: true, status: 'cancelled', canCancel: false, canRestart: true, canContinue: false }), { status: 200 });
      }
      assert.equal(url, '/api/codex/pipelines/runs/run%2Fa/restart');
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ ok: true, run: { id: 'run/a', status: 'running' } }), { status: 202 });
    }) as typeof fetch;

    const library = await loadCodexPipelines();
    assert.equal(library.ok, true);
    assert.deepEqual(library.pipelines[0].stepIds, ['step-a']);
    assert.equal(library.steps[0].skills[0].codexModel, null);
    assert.equal(library.availableContent[0].contentKind, 'pipeline-prompt');
    assert.equal(library.availableContent[0].executionVisibility, 'pipeline-only');
    const saveDraft = {
      pipeline: { id: pipeline.id, name: pipeline.name, purpose: pipeline.purpose, stepIds: ['step-a'] },
      steps: [{ id: step.id, name: step.name, purpose: step.purpose, skills: step.skills }]
    };
    assert.equal((await requestCodexPipelineSave(saveDraft)).ok, true);
    assert.equal((await requestCodexPipelineSave({ ...saveDraft, operation: 'update', pipelineId: pipeline.id })).ok, true);
    const queued = await requestCodexPipelineRun({ ledgerId: 'specs', sourceCardId: 'card-a', pipelineId: pipeline.id });
    assert.equal(queued.statusCode, 202);
    assert.equal(queued.queuePosition, 3);
    assert.equal((await requestCodexPipelineRunStatus({ runId: 'run/a' })).canCancel, true);
    assert.equal((await requestCodexPipelineRunCancel({ runId: 'run/a', executionId: 'execution-a' })).status, 'cancelled');
    assert.equal((await requestCodexPipelineRunRestart({ runId: 'run/a' })).ok, true);
    assert.equal(requestIndex, 7);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('queued pipeline labels expose the one-based FIFO position', () => {
  const result = { run: { status: 'pending' }, queuePosition: 2 } as any;
  const step = { name: 'Analysis' } as any;
  const skill = { skillName: 'analyze' } as any;
  assert.equal(pipelineLatestLabel(result, step, skill, 'pending'), 'Queued · position 2');
});

test('pipeline cards poll lifecycle without querying execution presentations', async () => {
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const widget = fakeCodexRunWidget();
  const requests: string[] = [];
  let status: 'running' | 'complete' = 'running';
  const skill = {
    id: 'skill-run-a',
    pipelineSkillId: 'skill-a',
    skillName: 'analysis',
    runId: 'run-a',
    executionId: 'execution-a',
    status: 'running',
    codexModel: 'gpt-5.6-sol',
    codexEffort: 'medium',
    stdoutFile: 'run.jsonl',
    stderrFile: 'run.log',
    startedAt: '2026-07-29T00:00:00.000Z',
    finishedAt: null,
    error: '',
    stdoutAvailable: true,
    stderrAvailable: true,
    logAvailable: true,
    lastLogWriteAt: '2026-07-29T00:00:01.000Z',
  };
  const step = {
    id: 'step-run-a',
    stepId: 'step-a',
    name: 'Analyze',
    purpose: 'Analyze.',
    outputCardId: 'output-a',
    outputCard: { id: 'output-a', title: 'Output', contentAvailable: true, contentBytes: 10 },
    status: 'running',
    startedAt: '2026-07-29T00:00:00.000Z',
    finishedAt: null,
    error: '',
    skills: [skill],
  };
  try {
    (globalThis as unknown as { document: unknown }).document = { contains: () => true };
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      const terminal = status === 'complete';
      return new Response(JSON.stringify({
        ok: true,
        run: {
          id: 'pipeline-run-a',
          status,
          steps: [{ ...step, status, skills: [{ ...skill, status }] }],
        },
        activeStep: terminal ? null : step,
        activeSkill: terminal ? null : skill,
        canCancel: !terminal,
        canRestart: terminal,
        canContinue: terminal,
      }), { status: 200 });
    }) as typeof fetch;

    bindPipelineStepRunWidget({
      ledgerId: 'tasks',
      cardId: 'output-a',
      runId: 'run-a',
      pipelineRunId: 'pipeline-run-a',
      pipelineStepId: 'step-a',
      element: widget,
    });
    await waitFor(() => widget.dataset.runStatus === 'running');
    status = 'complete';
    assert.equal(resumeExternallyStartedPipelineRun({
      ledgerId: 'tasks',
      pipelineRunId: 'pipeline-run-a',
      cardId: 'output-a',
      runId: 'run-a',
    }), true);
    await waitFor(() => widget.dataset.runStatus === 'complete');

    assert.equal(requests.length, 2);
    assert.equal(requests.every((url) => url === '/api/codex/pipelines/runs/pipeline-run-a'), true);
    assert.equal(requests.some((url) => url.includes('/api/task-executions/')), false);
  } finally {
    (globalThis as unknown as { document?: unknown }).document = previousDocument;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test('pipeline-card continuation preserves pending status and cancels the accepted execution', async () => {
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const widget = fakeCodexRunWidget();
  const pipelineRunId = 'pipeline-widget-continuation';
  const skillRunId = 'skill-widget-continuation';
  let continuationStatusRequests = 0;
  let cancellationBody: Record<string, unknown> | null = null;
  const run = {
    id: pipelineRunId,
    pipelineId: 'pipeline-a',
    pipelineName: 'Pipeline A',
    temporary: false,
    executionMode: 'local',
    ledgerId: 'specs',
    sourceCardId: 'source',
    sourceCardTitle: 'Source',
    status: 'complete',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:01:00.000Z',
    startedAt: '2026-07-20T00:00:00.000Z',
    finishedAt: '2026-07-20T00:01:00.000Z',
    resumedAt: null,
    error: '',
    steps: [{
      id: 'pipeline-run-step',
      stepId: 'step-a',
      name: 'Analyze',
      purpose: 'Analyze the source.',
      outputCardId: 'output',
      outputCard: { id: 'output', title: 'Output', contentAvailable: true, contentBytes: 20 },
      status: 'complete',
      startedAt: '2026-07-20T00:00:00.000Z',
      finishedAt: '2026-07-20T00:01:00.000Z',
      error: '',
      skills: [{
        id: 'pipeline-run-skill', pipelineSkillId: 'skill-a', skillName: 'analysis', runId: skillRunId,
        executionId: 'execution-old', status: 'complete', codexModel: 'gpt-5.6-sol', codexEffort: 'medium',
        stdoutFile: 'run.jsonl', stderrFile: 'run.log', startedAt: '2026-07-20T00:00:00.000Z',
        finishedAt: '2026-07-20T00:01:00.000Z', error: '', stdoutAvailable: true, stderrAvailable: true,
        logAvailable: true, lastLogWriteAt: '2026-07-20T00:01:00.000Z',
      }],
    }],
  };
  try {
    (globalThis as unknown as { document: unknown }).document = { contains: () => true };
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    state.activeLedger = { cards: [{ id: 'output' }], annotations: [], relationships: [], notes: {} };
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (url === `/api/codex/pipelines/runs/${pipelineRunId}`) {
        return new Response(JSON.stringify({ ok: true, run, activeStep: run.steps[0], activeSkill: run.steps[0].skills[0], canCancel: false, canRestart: true, canContinue: true }), { status: 200 });
      }
      if (url.endsWith(`/api/codex/skills/runs/${skillRunId}/continue`)) {
        return new Response(JSON.stringify({ ok: true, status: 'pending', queuePosition: 2, run: { id: skillRunId, executionId: 'execution-new', status: 'pending' } }), { status: 202 });
      }
      if (url.includes(`/api/codex/skills/runs/${skillRunId}?`)) {
        continuationStatusRequests += 1;
        const status = cancellationBody ? 'cancelled' : 'pending';
        return new Response(JSON.stringify({ ok: true, runId: skillRunId, status, executionId: 'execution-new', queuePosition: status === 'pending' ? 2 : null, lineCount: 0, nextSince: 0, events: [], diagnostics: [], executions: [], metadata: {} }), { status: 200 });
      }
      if (url.endsWith(`/api/codex/skills/runs/${skillRunId}/cancel`)) {
        cancellationBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return new Response(JSON.stringify({ ok: true, status: 'cancelled' }), { status: 202 });
      }
      return new Response(JSON.stringify({ ok: false, error: `Unexpected request: ${url}` }), { status: 500 });
    }) as typeof fetch;

    bindPipelineStepRunWidget({ ledgerId: 'specs', cardId: 'output', runId: skillRunId, pipelineRunId, pipelineStepId: 'step-a', element: widget });
    await waitFor(() => widget.nodes['[data-codex-run-latest]'].textContent === 'Pipeline complete');
    widget.nodes['[data-codex-run-continue]'].onclick?.(new Event('click'));
    await waitFor(() => continuationStatusRequests === 1 && widget.dataset.runStatus === 'pending');
    assert.equal(widget.nodes['[data-codex-run-status]'].textContent, 'PENDING');
    assert.equal(widget.nodes['[data-codex-run-cancel]'].textContent, 'CANCEL');
    widget.nodes['[data-codex-run-cancel]'].onclick?.(new Event('click'));
    await waitFor(() => cancellationBody !== null);
    assert.deepEqual(cancellationBody, { ledgerId: 'specs', cardId: 'output', executionId: 'execution-new' });
    await waitFor(() => widget.dataset.runStatus === 'cancelled');
  } finally {
    (globalThis as unknown as { document?: unknown }).document = previousDocument;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test('skill-library clients encode identity, exclude paths, and surface revision conflicts', async () => {
  const previousFetch = globalThis.fetch;
  const skill = {
    name: 'workspace/skill',
    description: 'Editable skill',
    source: 'workspace',
    editable: true,
    readOnlyReason: null,
    revision: 'revision-a',
    defaultCodexModel: null,
    defaultCodexEffort: 'high',
    effectiveCodexModel: 'gpt-5.5',
    effectiveCodexEffort: 'high',
    markdown: '---\nname: workspace/skill\ndescription: Editable skill\n---\n'
  };
  let requestIndex = 0;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requestIndex += 1;
      assert.equal(url, '/p/project-a/api/codex/skill-library/workspace%2Fskill');
      if (requestIndex === 1) {
        assert.equal(init, undefined);
        return new Response(JSON.stringify({ ok: true, skill }), { status: 200 });
      }
      assert.equal(init?.method, 'PUT');
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, {
        markdown: skill.markdown,
        revision: 'revision-a',
        defaultCodexModel: null,
        defaultCodexEffort: 'high'
      });
      assert.equal('skillName' in body, false);
      assert.equal('path' in body, false);
      return new Response(JSON.stringify({ ok: false, error: 'Revision conflict.', currentRevision: 'revision-b' }), { status: 409 });
    }) as typeof fetch;

    const detail = await loadCodexSkillLibrary(skill.name, 'project-a');
    assert.equal(detail.skill?.editable, true);
    const save = await requestCodexSkillLibrarySave({
      skillName: skill.name,
      markdown: skill.markdown,
      revision: skill.revision,
      defaultCodexModel: null,
      defaultCodexEffort: 'high',
      requestProjectId: 'project-a',
    });
    assert.equal(save.ok, false);
    assert.equal(save.conflict, true);
    assert.equal(save.currentRevision, 'revision-b');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('skill favorite save sends only the favorite value and returns canonical detail', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/p/project-a/api/codex/skill-library/system%2Fskill');
      assert.equal(init?.method, 'PUT');
      assert.deepEqual(JSON.parse(String(init?.body)), { favorite: true });
      return new Response(JSON.stringify({ ok: true, skill: { name: 'system/skill', favorite: true } }), { status: 200 });
    }) as typeof fetch;
    const result = await requestCodexSkillFavoriteSave('system/skill', true, 'project-a');
    assert.equal(result.ok, true);
    assert.equal(result.skill?.favorite, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('skill tag save sends path-free metadata and returns canonical tags', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/p/project-a/api/codex/skill-library/system%2Fskill');
      assert.equal(init?.method, 'PUT');
      assert.deepEqual(JSON.parse(String(init?.body)), { tags: ['Research'] });
      return new Response(JSON.stringify({ ok: true, skill: { name: 'system/skill', tags: ['Research'] } }), { status: 200 });
    }) as typeof fetch;
    const result = await requestCodexSkillMetadataSave('system/skill', { tags: ['Research'] }, 'project-a');
    assert.deepEqual(result.skill?.tags, ['Research']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillProcess posts active card skill payload', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/process');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
        ledgerId: 'specs',
        cardId: 'card-a',
        skillName: 'analysis',
        codexModel: 'gpt-5.5',
        codexEffort: 'xhigh'
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'run-a' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillProcess({ ledgerId: 'specs', cardId: 'card-a', skillName: 'analysis', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
    assert.equal(result.ok, true);
    assert.equal(result.run?.id, 'run-a');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestThreadCodexProcess posts active thread payload', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/threads/process');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
        ledgerId: 'specs',
        threadId: 'thread-card-a',
        cardId: 'card-a',
        codexModel: 'gpt-5.5',
        codexEffort: 'high'
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-1000-abcd', outputCardId: 'card-a' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestThreadCodexProcess({ ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a', codexModel: 'gpt-5.5', codexEffort: 'high' });
    assert.equal(result.ok, true);
    assert.equal(result.run?.outputCardId, 'card-a');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('threadCodexCardId only resolves card-backed threads', () => {
  const ledger = { cards: [{ id: 'card-a' }] };
  assert.equal(threadCodexCardId(ledger, 'thread-card-a'), 'card-a');
  assert.equal(threadCodexCardId(ledger, 'thread-zone-a'), '');
  assert.equal(threadCodexCardId(null, 'thread-card-a'), '');
});

test('requestCardSkillRunStatus queries derived run progress through its captured project scope', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, '/p/project-a/api/codex/skills/runs/codex-skill-1000-abcd?ledgerId=specs&cardId=card-a&since=4');
      return new Response(JSON.stringify({
        ok: true,
        active: true,
        runId: 'codex-skill-1000-abcd',
        runKind: 'thread',
        status: 'running',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 1200,
        lineCount: 8,
        nextSince: 8,
        toolCallCount: 2,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 1,
        warningCount: 1,
        errorCount: 2,
        transportStatus: 'degraded',
        persistedEventCount: 2,
        metadata: { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { line: 8, source: 'jsonl', sourceLine: 8, kind: 'tool_call', title: 'rg TODO', output: 'match', severity: 'info' },
        events: [{ line: 8, source: 'jsonl', sourceLine: 8, kind: 'tool_call', title: 'rg TODO', output: 'match', severity: 'info' }],
        diagnostics: [{ line: 2, source: 'stderr', sourceLine: 2, kind: 'transport', title: 'Transport degraded', text: 'connection lost', severity: 'warning' }]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunStatus({ projectId: 'project-a', ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd', since: 4 });
    assert.equal(result.ok, true);
    assert.equal(result.active, true);
    assert.equal(result.status, 'running');
    assert.equal(result.startedAt, '2026-07-08T00:00:00.000Z');
    assert.equal(result.toolCallCount, 2);
    assert.equal(result.nextSince, 8);
    assert.equal(result.runKind, 'thread');
    assert.equal(result.warningCount, 1);
    assert.equal(result.errorCount, 2);
    assert.equal(result.transportStatus, 'degraded');
    assert.equal(result.events[0].runId, 'codex-skill-1000-abcd');
    assert.equal(result.events[0].output, 'match');
    assert.equal(result.diagnostics[0].source, 'stderr');
    assert.deepEqual(result.metadata, { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillRunStatus preserves queued status and position', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      ok: true,
      active: false,
      runId: 'codex-skill-queued',
      runKind: 'thread',
      status: 'pending',
      queuePosition: 4,
      metadata: {},
      events: [],
      diagnostics: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

    const result = await requestCardSkillRunStatus({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-queued' });
    assert.equal(result.status, 'pending');
    assert.equal(result.active, false);
    assert.equal(result.queuePosition, 4);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('thread run reducer coalesces tool lifecycles, deduplicates diagnostics, and preserves group keys', () => {
  const tool = (itemId: string, line: number, status: string, output = '') => runEvent({
    line,
    kind: 'tool_call',
    itemId,
    type: status === 'started' ? 'item.started' : 'item.completed',
    status: status === 'started' ? 'in_progress' : status,
    tool: `rg ${itemId}`,
    output,
  });
  const lifecycle: CardSkillRunEvent[] = [];
  for (let index = 1; index <= 4; index += 1) {
    lifecycle.push(tool(`tool-${index}`, index * 2 - 1, 'started'));
    lifecycle.push(tool(`tool-${index}`, index * 2, 'completed', `output-${index}`));
  }
  lifecycle.push(runEvent({ line: 9, kind: 'thinking', itemId: 'thought-1', title: 'Codex thinking', text: 'Check the result.' }));
  for (let index = 5; index <= 6; index += 1) {
    lifecycle.push(tool(`tool-${index}`, index * 2, 'started'));
    lifecycle.push(tool(`tool-${index}`, index * 2 + 1, 'completed', `output-${index}`));
  }
  const diagnostic = runEvent({ line: 1, source: 'stderr', sourceLine: 1, kind: 'transport', title: 'Transport degraded', text: 'connection lost', severity: 'warning' });
  const first = mergeThreadRunEvents([], [...lifecycle, diagnostic], 'codex-skill-5000-log');
  assert.equal(first.events.filter((event) => event.kind === 'tool_call').length, 6);
  assert.equal(Object.keys(first.tools).length, 6);
  assert.equal(first.events[0].line, 1);
  assert.equal(first.events[0].status, 'completed');
  assert.equal(first.events[0].output, 'output-1');
  const firstGroups = groupSequentialToolCalls(first.events).filter((block) => block.kind === 'tool-group');
  assert.deepEqual(firstGroups.map((group) => group.tools.length), [4, 2]);

  const replay = mergeThreadRunEvents(first.events, [lifecycle[1], diagnostic], 'codex-skill-5000-log');
  assert.equal(replay.changedEventKeys.length, 0);
  assert.deepEqual(replay.events, first.events);
  assert.deepEqual(
    groupSequentialToolCalls(replay.events).filter((block) => block.kind === 'tool-group').map((group) => group.key),
    firstGroups.map((group) => group.key)
  );

  const missingIds = mergeThreadRunEvents([], [
    runEvent({ line: 30, kind: 'tool_call', type: 'item.started', status: 'in_progress', tool: 'one' }),
    runEvent({ line: 31, kind: 'tool_call', type: 'item.completed', status: 'completed', tool: 'two' }),
  ], 'codex-skill-5000-log');
  assert.equal(Object.keys(missingIds.tools).length, 2);
  assert.notEqual(missingIds.events[0].eventKey, missingIds.events[1].eventKey);
});

test('thread run reducer coalesces file-change lifecycles as tool calls', () => {
  const result = mergeThreadRunEvents([], [
    runEvent({ line: 20, kind: 'tool_call', itemId: 'files-1', type: 'item.started', title: 'File changes', status: 'in_progress', tool: '- frontend/src/app.ts: updated' }),
    runEvent({ line: 21, kind: 'tool_call', itemId: 'files-1', type: 'item.completed', title: 'File changes', status: 'completed', tool: '- frontend/src/app.ts: updated', output: '- frontend/src/app.ts: updated' }),
  ], 'codex-skill-5000-log');
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].status, 'completed');
  assert.equal(groupSequentialToolCalls(result.events)[0].kind, 'tool-group');
});

test('thread run reducer replaces native todo-list snapshots without grouping them as tools', () => {
  const result = mergeThreadRunEvents([], [
    runEvent({ line: 40, kind: 'todo_list', itemId: 'todo-1', type: 'item.started', status: 'in_progress', title: 'Todo list', output: '[{"text":"Inspect","completed":false}]' }),
    runEvent({ line: 41, kind: 'todo_list', itemId: 'todo-1', type: 'item.updated', status: 'in_progress', title: 'Todo list', output: '[{"text":"Inspect","completed":true}]' }),
    runEvent({ line: 42, kind: 'todo_list', itemId: 'todo-1', type: 'item.completed', status: 'completed', title: 'Todo list', output: '[{"text":"Inspect","completed":true}]' }),
  ], 'codex-skill-5000-log');
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].line, 40);
  assert.equal(result.events[0].status, 'completed');
  assert.match(result.events[0].output, /"completed":true/);
  assert.deepEqual(result.tools, {});
  assert.equal(groupSequentialToolCalls(result.events)[0].kind, 'event');
});

test('thread log consumer shares one advancing poller across rerenders and stops on every terminal state', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  let timerId = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const requests: string[] = [];
  const received: string[] = [];
  let responseStatuses: CardSkillRunStatus[] = ['running', 'complete'];
  let responseIndex = 0;
  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };
  const runNextTimer = async (delay: number) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `Expected a scheduled ${delay} ms timer.`);
    timers.delete(entry[0]);
    entry[1].callback();
    await flush();
  };
  try {
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      constructor(_name: string, public detail: unknown = undefined) {}
    };
    globalThis.setTimeout = ((callback: () => void, delay = 0) => {
      const id = ++timerId;
      timers.set(id, { callback, delay: Number(delay) });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(Number(id));
    }) as typeof clearTimeout;
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      const status = responseStatuses[Math.min(responseIndex, responseStatuses.length - 1)];
      responseIndex += 1;
      const lineCount = responseIndex * 2;
      return new Response(JSON.stringify({
        ok: true,
        runId: 'codex-skill-6000-shared',
        runKind: 'thread',
        status,
        lineCount,
        nextSince: lineCount,
        events: [runEvent({ runId: 'codex-skill-6000-shared', line: lineCount, kind: 'run_status', status })],
        diagnostics: [],
        metadata: {}
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const input = { ledgerId: 'specs', cardId: 'card-shared', runId: 'codex-skill-6000-shared', consumerId: 'thread-log:thread-card-shared' };
    bindCardSkillRunLogConsumer({ ...input, onSummary: (summary) => received.push(`stale:${summary.status}`) });
    bindCardSkillRunLogConsumer({ ...input, onSummary: (summary) => received.push(`current:${summary.status}`) });
    assert.deepEqual([...timers.values()].map((timer) => timer.delay), [0]);
    await runNextTimer(0);
    assert.deepEqual(received, ['current:running']);
    assert.equal(requests[0], '/api/codex/skills/runs/codex-skill-6000-shared?ledgerId=specs&cardId=card-shared&since=0');
    const lateEventLines: number[][] = [];
    bindCardSkillRunLogConsumer({
      ...input,
      consumerId: 'thread-log:late-thread-card-shared',
      onSummary: (summary) => lateEventLines.push(summary.events.map((event) => event.line)),
    });
    assert.deepEqual(lateEventLines, [[2]]);
    assert.equal(requests.length, 1);
    assert.deepEqual([...timers.values()].map((timer) => timer.delay), [1000]);
    await runNextTimer(1000);
    assert.deepEqual(received, ['current:running', 'current:complete']);
    assert.equal(requests[1], '/api/codex/skills/runs/codex-skill-6000-shared?ledgerId=specs&cardId=card-shared&since=2');
    assert.equal(timers.size, 0);

    for (const status of ['failed', 'cancelled'] as CardSkillRunStatus[]) {
      responseStatuses = [status];
      responseIndex = 0;
      const runId = `codex-skill-6001-${status}`;
      bindCardSkillRunLogConsumer({
        ledgerId: 'specs', cardId: `card-${status}`, runId, consumerId: `thread-log:${status}`,
        onSummary: (summary) => received.push(`${status}:${summary.status}`)
      });
      await runNextTimer(0);
      assert.equal(received.at(-1), `${status}:${status}`);
      assert.equal(timers.size, 0);
    }
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('thread log consumer keeps captured project scope and unregisters before a background poll tick', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  let timerId = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const requests: string[] = [];
  const input = {
    projectId: 'project-a',
    replicaNodeId: 'phone',
    ledgerId: 'specs',
    cardId: 'card-project-scope',
    runId: 'codex-skill-6100-project-scope',
    consumerId: 'thread-log:thread-card-project-scope',
  };
  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };
  const runNextTimer = async (delay: number) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `Expected a scheduled ${delay} ms timer.`);
    timers.delete(entry[0]);
    entry[1].callback();
    await flush();
  };
  try {
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      constructor(_name: string, public detail: unknown = undefined) {}
    };
    globalThis.setTimeout = ((callback: () => void, delay = 0) => {
      const id = ++timerId;
      timers.set(id, { callback, delay: Number(delay) });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(Number(id));
    }) as typeof clearTimeout;
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      return new Response(JSON.stringify({
        ok: true,
        active: true,
        runId: input.runId,
        runKind: 'thread',
        status: 'running',
        lineCount: requests.length,
        nextSince: requests.length,
        events: [],
        diagnostics: [],
        metadata: {},
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    bindCardSkillRunLogConsumer({ ...input, onSummary() {} });
    await runNextTimer(0);
    assert.equal(requests[0], `/p/project-a/api/codex/skills/runs/${input.runId}?ledgerId=specs&cardId=card-project-scope&since=0&replica=phone`);
    assert.deepEqual([...timers.values()].map((timer) => timer.delay), [1000]);

    unbindCardSkillRunLogConsumer(input);
    assert.equal(timers.size, 0);

    bindCardSkillRunLogConsumer({ ...input, onSummary() {} });
    await runNextTimer(0);
    assert.equal(requests[1], `/p/project-a/api/codex/skills/runs/${input.runId}?ledgerId=specs&cardId=card-project-scope&since=0&replica=phone`);
    unbindCardSkillRunLogConsumer(input);
    assert.equal(timers.size, 0);
  } finally {
    unbindCardSkillRunLogConsumer(input);
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('thread log consumer revalidates a terminal session when the card identifies a newer pending execution', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const runId = 'codex-skill-6200-reopened-continuation';
  const input = {
    ledgerId: 'specs',
    cardId: 'card-reopened-continuation',
    runId,
    consumerId: 'thread-log:thread-card-reopened-continuation',
  };
  const requests: string[] = [];
  const received: string[] = [];
  try {
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      const continuing = requests.length > 1;
      return new Response(JSON.stringify({
        ok: true,
        active: false,
        runId,
        runKind: 'thread',
        status: continuing ? 'pending' : 'complete',
        executionId: continuing ? 'execution-new' : 'execution-old',
        queuePosition: continuing ? 2 : null,
        lineCount: 4,
        nextSince: 4,
        events: [],
        diagnostics: [],
        metadata: {},
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    bindCardSkillRunLogConsumer({ ...input, onSummary: (summary) => received.push(`${summary.executionId}:${summary.status}`) });
    await waitFor(() => received.length === 1);
    assert.deepEqual(received, ['execution-old:complete']);
    unbindCardSkillRunLogConsumer(input);

    bindCardSkillRunLogConsumer({
      ...input,
      forceRevalidate: true,
      onSummary: (summary) => received.push(`${summary.executionId}:${summary.status}`),
    });
    assert.deepEqual(received, ['execution-old:complete']);
    await waitFor(() => received.length === 2);
    assert.deepEqual(received, ['execution-old:complete', 'execution-new:pending']);
    assert.equal(requests.length, 2);
  } finally {
    unbindCardSkillRunLogConsumer(input);
    globalThis.fetch = previousFetch;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
  }
});

test('a response from an older poll generation cannot overwrite a newly admitted execution', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const input = { ledgerId: 'specs', cardId: 'card-generation', runId: 'run-generation', consumerId: 'thread-log:generation' };
  const requests: Array<(response: Response) => void> = [];
  const received: string[] = [];
  const response = (executionId: string, status: string) => new Response(JSON.stringify({
    ok: true, active: status === 'running', runId: input.runId, runKind: 'thread', status, executionId,
    lineCount: 0, nextSince: 0, events: [], diagnostics: [], executions: [], metadata: {},
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    globalThis.fetch = (async () => await new Promise<Response>((resolveRequest) => requests.push(resolveRequest))) as typeof fetch;
    bindCardSkillRunLogConsumer({ ...input, onSummary: (summary) => received.push(`${summary.executionId}:${summary.status}`) });
    await waitFor(() => requests.length === 1);
    bindCardSkillRunLogConsumer({
      ...input,
      expectedExecutionId: 'execution-new',
      forceRevalidate: true,
      onSummary: (summary) => received.push(`${summary.executionId}:${summary.status}`),
    });
    requests[0](response('execution-old', 'complete'));
    await waitFor(() => requests.length === 2);
    assert.deepEqual(received, []);
    requests[1](response('execution-new', 'running'));
    await waitFor(() => received.length === 1);
    assert.deepEqual(received, ['execution-new:running']);
  } finally {
    purgeCardSkillRunLog(input);
    globalThis.fetch = previousFetch;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
  }
});

test('thread log consumer delivers unavailable state before stopping its timer', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Run unavailable.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    })) as typeof fetch;
    let summary: CardSkillRunSummary | undefined;
    bindCardSkillRunLogConsumer({
      ledgerId: 'specs', cardId: 'card-unavailable', runId: 'codex-skill-7000-unavailable', consumerId: 'thread-log:unavailable',
      onSummary: (value) => { summary = value; }
    });
    await waitFor(() => Boolean(summary));
    assert.equal(summary?.ok, false);
    assert.equal(summary?.status, 'unknown');
    assert.equal(summary?.error, 'Run unavailable.');
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(summary?.status, 'unknown');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('status polling updates only the run widget and never queues a ledger refresh', async () => {
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  const requests: Array<{ url: string; method: string }> = [];
  const activeLedger = {
    cards: [{ id: 'card-poll', title: 'Unchanged' }],
    annotations: [], relationships: [], notes: {}
  };
  try {
    (globalThis as unknown as { document: unknown }).document = { contains: () => true };
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      detail: unknown;
      constructor(_name: string, init?: { detail?: unknown }) { this.detail = init?.detail; }
    };
    state.activeLedger = activeLedger;
    state.ledgerContentRefresh = { inFlight: false, ledgerReasons: [], changedContentFiles: [], threadReasons: [], threadScope: null };
    state.pendingLedgerContentRefresh = false;
    state.pendingThreadContentRefresh = false;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, method: String(init?.method ?? 'GET') });
      return new Response(JSON.stringify({
        ok: true,
        status: 'complete',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 2500,
        lineCount: 5,
        nextSince: 5,
        toolCallCount: 1,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 0,
        persistedEventCount: 1,
        metadata: { sourceCardTitle: 'Polling proof', sourceThreadId: 'thread-card-poll', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { title: 'Turn completed' },
        events: []
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const widget = fakeCodexRunWidget();
    bindCardSkillRunWidget({ ledgerId: 'specs', cardId: 'card-poll', runId: 'codex-skill-4000-poll-only', element: widget });
    await waitFor(() => widget.nodes['[data-codex-run-status]'].textContent === 'COMPLETE');

    assert.deepEqual(requests, [{
      url: '/api/codex/skills/runs/codex-skill-4000-poll-only?ledgerId=specs&cardId=card-poll&since=0',
      method: 'GET'
    }]);
    assert.equal(state.activeLedger, activeLedger);
    assert.equal(state.pendingLedgerContentRefresh, false);
    assert.equal(state.pendingThreadContentRefresh, false);
    assert.deepEqual(state.ledgerContentRefresh, {
      inFlight: false,
      ledgerReasons: [],
      changedContentFiles: [],
      threadReasons: [],
      threadScope: null
    });
    assert.equal(widget.nodes['[data-codex-run-latest]'].textContent, 'Turn Completed in 00:02');
  } finally {
    (globalThis as unknown as { document?: unknown }).document = previousDocument;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
    globalThis.fetch = previousFetch;
  }
});

test('externally started Codex runs clear terminal widget cache and restart polling', async () => {
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  const requests: string[] = [];
  const continuationBodies: Array<Record<string, unknown>> = [];
  try {
    (globalThis as unknown as { document: unknown }).document = { contains: () => true };
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      detail: unknown;
      constructor(_name: string, init?: { detail?: unknown }) {
        this.detail = init?.detail;
      }
    };
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.endsWith('/continue')) {
        continuationBodies.push(JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>);
        return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-3000-cache', status: 'running' } }), {
          status: 202,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (init?.method === 'POST') return new Response('', { status: 204 });
      requests.push(url);
      const continuedExecution = requests.length >= 3;
      return new Response(JSON.stringify({
        ok: true,
        status: continuedExecution ? 'running' : 'complete',
        executionId: continuedExecution ? 'execution-new' : 'execution-old',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 1000,
        lineCount: requests.length === 1 ? 8 : 12,
        nextSince: requests.length === 1 ? 8 : 12,
        toolCallCount: 0,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 0,
        persistedEventCount: 1,
        metadata: { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { title: continuedExecution ? 'Turn started' : 'Turn completed' },
        events: []
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const firstWidget = fakeCodexRunWidget();
    bindCardSkillRunWidget({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache', element: firstWidget });
    await waitFor(() => requests.length === 1);
    await waitFor(() => firstWidget.nodes['[data-codex-run-status]'].textContent === 'COMPLETE');
    assert.equal(firstWidget.nodes['[data-codex-run-model]'].value, 'gpt-5.5');
    assert.equal(firstWidget.nodes['[data-codex-run-effort]'].value, 'xhigh');
    assert.equal(firstWidget.nodes['[data-codex-run-model]'].disabled, false);
    assert.equal(firstWidget.nodes['[data-codex-run-effort]'].disabled, false);
    assert.equal(firstWidget.nodes['[data-codex-run-continue]'].hidden, false);

    const cachedWidget = fakeCodexRunWidget();
    bindCardSkillRunWidget({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache', element: cachedWidget });
    assert.equal(cachedWidget.nodes['[data-codex-run-status]'].textContent, 'COMPLETE');

    const resumed = resumeExternallyStartedCardSkillRun({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache' });
    assert.equal(resumed, true);
    assert.equal(cachedWidget.nodes['[data-codex-run-status]'].textContent, 'COMPLETE');
    await waitFor(() => requests.length === 2);
    assert.equal(requests[1], '/api/codex/skills/runs/codex-skill-3000-cache?ledgerId=specs&cardId=card-a&since=8');
    await waitFor(() => cachedWidget.nodes['[data-codex-run-status]'].textContent === 'COMPLETE');
    cachedWidget.nodes['[data-codex-run-tools]'].textContent = '7';
    cachedWidget.nodes['[data-codex-run-messages]'].textContent = '2';
    cachedWidget.nodes['[data-codex-run-files]'].textContent = '1';
    cachedWidget.nodes['[data-codex-run-continue]'].onclick?.(new Event('click'));
    assert.equal(cachedWidget.nodes['[data-codex-run-status]'].textContent, 'PENDING');
    assert.equal(cachedWidget.nodes['[data-codex-run-latest]'].textContent, 'Submitting continuation');
    assert.equal(cachedWidget.nodes['[data-codex-run-tools]'].textContent, '0');
    assert.equal(cachedWidget.nodes['[data-codex-run-messages]'].textContent, '0');
    assert.equal(cachedWidget.nodes['[data-codex-run-files]'].textContent, '0');
    await waitFor(() => continuationBodies.length === 1);
    await waitFor(() => cachedWidget.nodes['[data-codex-run-status]'].textContent === 'RUNNING');
    await waitFor(() => cachedWidget.nodes['[data-codex-run-latest]'].textContent === 'Turn started');
    assert.equal(cachedWidget.nodes['[data-codex-run-latest]'].textContent, 'Turn started');
    assert.equal('newSession' in continuationBodies[0], false);
    assert.equal(continuationBodies[0].codexModel, 'gpt-5.6-sol');
    assert.equal(continuationBodies[0].codexEffort, 'medium');
  } finally {
    purgeCardSkillRunLog({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache' });
    (globalThis as unknown as { document?: unknown }).document = previousDocument;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillRunCancel posts active card run cancellation', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd/cancel');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), { ledgerId: 'specs', cardId: 'card-a', executionId: 'execution-a' });
      return new Response(JSON.stringify({ ok: true, status: 'cancelled' }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunCancel({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd', executionId: 'execution-a' });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'cancelled');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestThreadCodexSessionDelete sends exact run ownership with DELETE', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-delete');
      assert.equal(init?.method, 'DELETE');
      assert.deepEqual(JSON.parse(String(init?.body)), { ledgerId: 'specs', cardId: 'card-a' });
      return new Response(JSON.stringify({ ok: true, status: 'deleted' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    assert.deepEqual(
      await requestThreadCodexSessionDelete({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-delete' }),
      { ok: true, status: 'deleted', error: undefined }
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillRunContinue resumes the run with the selected model and effort', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd/continue');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
        ledgerId: 'specs',
        cardId: 'card-a',
        codexModel: 'gpt-5.4',
        codexEffort: 'high'
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-1000-abcd', status: 'running' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunContinue({
      ledgerId: 'specs',
      cardId: 'card-a',
      runId: 'codex-skill-1000-abcd',
      codexModel: 'gpt-5.4',
      codexEffort: 'high'
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'running');
    assert.equal(result.run?.id, 'codex-skill-1000-abcd');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('cardCodexRunId resolves retained provider session history only', () => {
  assert.equal(cardCodexRunId({
    id: 'card-a',
    codexActiveRunId: 'codex-skill-9999-pipeline',
    codexThreadRunId: 'codex-skill-9999-thread'
  }), 'codex-skill-9999-thread');
  assert.equal(cardCodexRunId({
    id: 'card-a',
    codexThreadRunId: 'codex-skill-9999-thread'
  }), 'codex-skill-9999-thread');
  assert.equal(cardCodexRunId({
    id: 'card-codex-skill-1000-abcd',
    comment: { what: '# Finished result without run metadata' }
  }), '');
  assert.equal(cardCodexRunId({
    id: 'card-result',
    comment: { what: 'Codex run: codex-skill-2000-efgh' }
  }), '');
  assert.equal(cardCodexThreadRunId({ codexThreadRunId: 'codex-skill-9999-thread' }), 'codex-skill-9999-thread');
  assert.equal(cardCodexThreadRunId({ codexRunId: 'codex-skill-9999-card' }), '');
});
