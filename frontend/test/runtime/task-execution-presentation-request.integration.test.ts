/**
 * WHAT: Verifies the thread Codex Log requester uses task and exact-execution resources.
 * WHY: Browser requests must contain no session status route, cursor, and physical line boundary.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestTaskExecutionPresentation,
  requestTaskExecutionState,
} from '../../src/runtime/codex/effect/request-task-execution-state.js';

test('requests one task summary and one exact complete execution snapshot', async () => {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requests.push(String(input));
      if (String(input).includes('/execution-state')) {
        return new Response(JSON.stringify({
          taskId: 'task-a',
          activeExecutionIds: ['execution-a'],
          defaultExecutionId: 'execution-a',
          sessions: [],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        execution: {
          executionId: 'execution-a',
          sessionId: 'session-a',
          taskId: 'task-a',
          kind: 'thread',
          phase: 'running',
          requestedAt: '2026-07-25T00:00:00.000Z',
          startedAt: '2026-07-25T00:00:00.000Z',
          finishedAt: null,
          model: null,
          effort: null,
          executorNodeId: 'workstation',
          revision: 1,
          error: null,
          counts: { tools: 0, messages: 0, comments: 0, thinking: 0, files: 0, warnings: 0, errors: 0 },
        },
        events: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof globalThis.fetch;

    assert.equal((await requestTaskExecutionState({ projectId: 'project-a', taskId: 'task-a' })).ok, true);
    assert.equal((await requestTaskExecutionPresentation({ projectId: 'project-a', executionId: 'execution-a' })).ok, true);
    assert.deepEqual(requests, [
      '/p/project-a/api/tasks/task-a/execution-state',
      '/p/project-a/api/task-executions/execution-a',
    ]);
    assert.equal(requests.some((request) => /since|cursor|codex\/skills\/runs/.test(request)), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('caller cancellation aborts an in-flight execution presentation read', async () => {
  const previousFetch = globalThis.fetch;
  const abort = new AbortController();
  try {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })) as typeof globalThis.fetch;
    const pending = requestTaskExecutionPresentation({
      projectId: 'project-a',
      executionId: 'execution-a',
      signal: abort.signal,
    });
    abort.abort();
    assert.deepEqual(await pending, { ok: false, error: 'Task execution request timed out.' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
