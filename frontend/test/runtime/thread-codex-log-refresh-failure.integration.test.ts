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
