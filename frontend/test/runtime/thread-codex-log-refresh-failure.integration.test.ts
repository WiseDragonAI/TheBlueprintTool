/**
 * WHAT: Verifies unexpected task-summary projection failures settle into a visible retryable Codex Log error.
 * WHY: A swallowed projection exception previously left the operator panel in permanent local-loading state.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { state } from '../../src/runtime/state.js';
import {
  bindThreadCodexRunLog,
  unbindThreadCodexRunLog,
} from '../../src/runtime/codex/effect/bind-thread-codex-run-log.js';

async function waitFor(check: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // WHAT: Finish as soon as the asynchronous reader installs its scoped failure.
    // WHY: The regression must synchronize on the actual state transition without a fixed workstation delay.
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for Codex Log projection failure.');
}

test('unexpected summary projection failure becomes visible and retryable', async () => {
  const previousFetch = globalThis.fetch;
  const threadId = 'thread-malformed-summary';
  const identity = {
    projectId: 'project-a',
    replicaNodeId: '',
    ledgerId: 'tasks',
    cardId: 'card-a',
    threadId,
    runId: '',
  };
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskId: 'task-a',
      activeExecutionIds: [],
      defaultExecutionId: null,
      sessions: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof globalThis.fetch;
    state.threadExecutionStateErrorByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    bindThreadCodexRunLog(identity);
    await waitFor(() => Boolean(state.threadExecutionStateErrorByThreadId[threadId]));
    assert.match(String(state.threadExecutionStateErrorByThreadId[threadId]), /flatMap/);
    assert.equal(state.threadTaskExecutionStateByThreadId[threadId], undefined);
  } finally {
    unbindThreadCodexRunLog(identity);
    globalThis.fetch = previousFetch;
  }
});

test('accepted session keeps reading until its delayed execution identity appears', async () => {
  const previousFetch = globalThis.fetch;
  const threadId = 'thread-delayed-execution';
  let summaryReads = 0;
  const identity = {
    projectId: 'project-a',
    replicaNodeId: '',
    ledgerId: 'tasks',
    cardId: 'card-a',
    threadId,
    runId: 'session-delayed',
    expectedStatus: 'running',
  } as const;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      // WHAT: Return an empty first summary before exposing the execution created at turn start.
      // WHY: Production admission can settle before Codex emits the execution-owning turn-start event.
      if (String(input).includes('/execution-state')) {
        summaryReads += 1;
        const executions = summaryReads === 1 ? [] : [{
          executionId: 'execution-delayed',
          sessionId: 'session-delayed',
          sourceCardId: 'card-a',
          taskId: 'card-a',
          kind: 'thread',
          phase: 'running',
          requestedAt: '2026-07-31T16:49:21.000Z',
          startedAt: '2026-07-31T16:49:23.654Z',
          finishedAt: null,
          model: 'gpt-5.6-sol',
          effort: 'medium',
          executorNodeId: 'workstation-dev',
          revision: 1,
          error: null,
          queuePosition: null,
        }];
        return new Response(JSON.stringify({
          taskId: 'card-a',
          activeExecutionIds: executions.map((execution) => execution.executionId),
          defaultExecutionId: executions.at(-1)?.executionId ?? null,
          sessions: executions.length > 0 ? [{ sessionId: 'session-delayed', executions }] : [],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        execution: { executionId: 'execution-delayed', counts: { tools: 0, warnings: 0, errors: 0 } },
        events: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof globalThis.fetch;
    state.threadExecutionStateErrorByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
    state.threadSelectedExecutionIdByThreadId = {};
    bindThreadCodexRunLog(identity);
    await waitFor(() => state.threadSelectedExecutionIdByThreadId[threadId] === 'execution-delayed'
      && state.threadExecutionPresentationByThreadId[threadId]?.execution?.executionId === 'execution-delayed');
    assert.equal(summaryReads, 2);
    assert.equal(state.threadTaskExecutionStateByThreadId[threadId].activeExecutionIds[0], 'execution-delayed');
    assert.equal(state.threadExecutionPresentationByThreadId[threadId].execution.executionId, 'execution-delayed');
  } finally {
    unbindThreadCodexRunLog(identity);
    globalThis.fetch = previousFetch;
  }
});
