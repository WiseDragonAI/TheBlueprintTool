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
