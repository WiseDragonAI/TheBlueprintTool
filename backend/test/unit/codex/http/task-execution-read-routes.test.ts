/**
 * WHAT: Verifies project task execution read routes and their stable scoped responses.
 * WHY: Optimistic task reads and provider status reads share one Codex HTTP boundary.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import { handleTaskExecutionReadRoutes } from '@backend/business/codex/http/task-execution-read-routes.js';

test('missing optimistic task returns an empty execution projection without throwing', async () => {
  const headers = new Map<string, string>();
  let body = '';
  const response = {
    end(value = '') { body += String(value); },
    setHeader(name: string, value: string) { headers.set(name, value); },
    statusCode: 200,
  } as unknown as ServerResponse;
  const state = {
    executions: { byTaskId: () => [] },
    projection: () => ({ ledger: { cards: [], relationships: [] } }),
  } as unknown as ProjectTaskState;

  const result = await handleTaskExecutionReadRoutes({
    presentation: async () => ({ body: '', statusCode: 404 }),
    queuePosition: () => 0,
    request: { method: 'GET' } as IncomingMessage,
    response,
    state,
    url: '/api/tasks/card-new/execution-state',
  });

  assert.equal(result.handled, true);
  assert.equal(headers.get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(body), {
    taskId: 'card-new',
    activeExecutionIds: [],
    defaultExecutionId: null,
    sessions: [],
  });
});

test('returns historical execution state for one ordinary ledger card', async () => {
  let body = '';
  const response = {
    end(value = '') { body += String(value); },
    setHeader() {},
    statusCode: 200,
  } as unknown as ServerResponse;
  const historical = {
    metadata: {
      executionId: 'execution-old',
      requestId: 'request-old',
      sessionId: 'session-old',
      projectId: 'project-a',
      ledgerId: 'rust-serverless',
      taskId: '',
      sourceCardId: 'card-overview',
      ownerCardId: 'card-overview',
      kind: 'thread',
      requestedAt: '2026-08-11T13:20:10.000Z',
      model: 'gpt-5.6-sol',
      effort: 'high',
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    lifecycle: {
      phase: 'succeeded',
      phaseSince: '2026-08-11T13:27:28.000Z',
      startedAt: '2026-08-11T13:20:10.000Z',
      finishedAt: '2026-08-11T13:27:28.000Z',
      executorNodeId: 'workstation',
      providerSessionId: 'provider-old',
      result: { status: 'succeeded', summary: 'exit code 0' },
      error: null,
      revision: 6,
    },
    artifacts: {
      jsonl: { hash: 'a'.repeat(64), bytes: 100, mediaType: 'application/x-ndjson' },
      stderr: null,
      telemetry: null,
      result: null,
      changedAt: '2026-08-11T13:27:28.000Z',
      revision: 2,
    },
  };
  const state = {
    executions: {
      byTaskId: () => [],
      bySourceCardId: (cardId: string) => cardId === 'card-overview' ? [historical] : [],
    },
    projection: () => ({ ledger: { cards: [], relationships: [] } }),
  } as unknown as ProjectTaskState;

  const result = await handleTaskExecutionReadRoutes({
    presentation: async () => ({ body: '', statusCode: 404 }),
    queuePosition: () => 0,
    request: { method: 'GET' } as IncomingMessage,
    response,
    state,
    url: '/api/ledgers/rust-serverless/cards/card-overview/execution-state',
  });

  assert.equal(result.handled, true);
  assert.deepEqual(JSON.parse(body), {
    taskId: 'card-overview',
    activeExecutionIds: [],
    defaultExecutionId: 'execution-old',
    sessions: [{
      sessionId: 'session-old',
      requestedAt: '2026-08-11T13:20:10.000Z',
      executions: [{
        executionId: 'execution-old',
        sessionId: 'session-old',
        sourceCardId: 'card-overview',
        kind: 'thread',
        phase: 'succeeded',
        requestedAt: '2026-08-11T13:20:10.000Z',
        startedAt: '2026-08-11T13:20:10.000Z',
        finishedAt: '2026-08-11T13:27:28.000Z',
        model: 'gpt-5.6-sol',
        effort: 'high',
        predecessorExecutionId: null,
        executorNodeId: 'workstation',
        revision: 6,
        queuePosition: null,
        error: null,
        artifacts: { jsonl: true, stderr: false, telemetry: false, result: false },
      }],
    }],
  });
});

test('returns project-scoped codex status and stable not-found responses', async () => {
  const responseFor = () => {
    let body = '';
    return { read: () => body, value: { end(value = '') { body += String(value); }, setHeader() {}, statusCode: 200 } as unknown as ServerResponse };
  };
  const execution = { metadata: { executionId: 'execution-a', requestedAt: '2026-08-03T00:00:00.000Z' }, lifecycle: { phase: 'succeeded', startedAt: '2026-08-03T00:00:01.000Z', finishedAt: '2026-08-03T00:00:11.000Z', providerSessionId: null } };
  const state = { executions: { find: (id: string) => id === 'execution-a' ? execution : null } } as unknown as ProjectTaskState;
  const found = responseFor();
  await handleTaskExecutionReadRoutes({ presentation: async () => ({ body: '', statusCode: 404 }), queuePosition: () => 0, request: { method: 'GET' } as IncomingMessage, response: found.value, state, url: '/api/task-executions/execution-a/codex-status' });
  assert.equal(JSON.parse(found.read()).status.elapsed.milliseconds, 10_000);
  const missing = responseFor();
  await handleTaskExecutionReadRoutes({ presentation: async () => ({ body: '', statusCode: 404 }), queuePosition: () => 0, request: { method: 'GET' } as IncomingMessage, response: missing.value, state, url: '/api/task-executions/execution-other/codex-status' });
  assert.equal(missing.value.statusCode, 404);
  assert.deepEqual(JSON.parse(missing.read()), { ok: false, error: 'task_execution_not_found', executionId: 'execution-other' });
});
