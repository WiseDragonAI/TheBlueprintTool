/**
 * WHAT: Verifies remote execution reads return local envelopes while hydration stays background and single-flight owned.
 * WHY: Browser refreshes must never synchronously fan out through the Cloudflare relay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRemoteExecutionRoutes } from '@backend/business/federation/http/remote-execution-routes.js';

test('returns ordinary-card execution state from one selected remote replica', async () => {
  let body = '';
  const execution = {
    metadata: {
      executionId: 'execution-old',
      sessionId: 'session-old',
      sourceCardId: 'card-overview',
      ledgerId: 'rust-serverless',
      taskId: '',
      kind: 'thread',
      requestedAt: '2026-08-11T13:20:10.000Z',
      model: 'gpt-5.6-sol',
      effort: 'high',
      predecessorExecutionId: null,
    },
    lifecycle: {
      phase: 'succeeded',
      startedAt: '2026-08-11T13:20:10.000Z',
      finishedAt: '2026-08-11T13:27:28.000Z',
      executorNodeId: 'remote-node',
      revision: 6,
      error: null,
    },
    artifacts: { jsonl: {}, stderr: null, telemetry: null, result: null },
  };
  const response = {
    setHeader() {},
    statusCode: 200,
    end(value: string) { body = value; },
  };

  const result = await handleRemoteExecutionRoutes({
    localNodeId: 'local-node',
    ownerNodeId: 'remote-node',
    pipelinePresentation: () => null,
    presentationRegistry: {} as never,
    presentationRuntime: () => null,
    recordBackgroundFailure: () => undefined,
    projectId: 'project-a',
    projection: { ledger: { cards: [], relationships: [] } },
    queuePosition: () => null,
    request: { method: 'GET' } as never,
    response: response as never,
    scopedPath: '/api/ledgers/rust-serverless/cards/card-overview/execution-state',
    state: {
      executions: {
        byTaskId: () => [],
        bySourceCardId: () => [execution],
      },
    } as never,
    url: new URL('http://decision-os.local/api/ledgers/rust-serverless/cards/card-overview/execution-state'),
  });

  assert.equal(result.handled, true);
  assert.equal(JSON.parse(body).defaultExecutionId, 'execution-old');
  assert.deepEqual(JSON.parse(body).sessions.map((session: { sessionId: string }) => session.sessionId), ['session-old']);
});

test('returns a hydrating execution envelope without awaiting a relay presentation', async () => {
  const execution = {
    metadata: { executionId: 'execution-a', projectId: 'project-a' },
    lifecycle: { executorNodeId: 'remote-node' },
  };
  let backgroundHydrations = 0;
  let blockingReads = 0;
  let body = '';
  let statusCode = 200;
  const response = {
    setHeader() {},
    get statusCode() { return statusCode; },
    set statusCode(value: number) { statusCode = value; },
    end(value: string) { body = value; },
  };
  const result = await handleRemoteExecutionRoutes({
    localNodeId: 'local-node',
    ownerNodeId: 'owner-node',
    pipelinePresentation: () => null,
    presentationRegistry: {
      presentation: () => null,
      locallyHydrated: () => null,
      hydrateRemotePresentation: () => { backgroundHydrations += 1; },
      remotePresentation: async () => { blockingReads += 1; return { ok: false, statusCode: 500, body: '' }; },
      replicated: (_execution: unknown, _projection: unknown, hydrationStatus: string) => ({
        execution: { executionId: 'execution-a' }, events: [], hydrationStatus,
      }),
    } as never,
    presentationRuntime: () => null,
    recordBackgroundFailure: () => undefined,
    projectId: 'project-a',
    projection: {},
    queuePosition: () => null,
    request: { method: 'GET' } as never,
    response: response as never,
    scopedPath: '/api/task-executions/execution-a',
    state: { executions: { find: () => execution } } as never,
    url: new URL('http://decision-os.local/api/task-executions/execution-a'),
  });

  assert.equal(result.handled, true);
  assert.equal(statusCode, 200);
  assert.equal(backgroundHydrations, 1);
  assert.equal(blockingReads, 0);
  assert.equal(JSON.parse(body).hydrationStatus, 'hydrating');
});
