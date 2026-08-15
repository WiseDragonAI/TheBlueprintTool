import test from 'node:test';
import assert from 'node:assert/strict';
import { queuePipeline } from '../../src/business/codex/effect/queue-pipeline.js';

test('queue-pipeline sends the selected pipeline from the current execution', async () => {
  const previous = {
    executionId: process.env.DECISION_OS_EXECUTION_ID,
    projectId: process.env.DECISION_OS_PROJECT_ID,
    serverUrl: process.env.DECISION_OS_SERVER_URL,
  };
  process.env.DECISION_OS_EXECUTION_ID = 'execution/thread';
  process.env.DECISION_OS_PROJECT_ID = 'project/a';
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50151/';
  const calls: Array<{ url: string; init: RequestInit }> = [];
  try {
    const result = await queuePipeline({ pipelineId: 'implementation/pipeline' }, async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 202, text: async () => '{"ok":true}' };
    });
    assert.deepEqual(result, {
      ok: true,
      value: 'Queued pipeline implementation/pipeline after the current execution.',
    });
    assert.equal(calls[0].url, 'http://127.0.0.1:50151/p/project%2Fa/api/codex/executions/execution%2Fthread/queue-pipeline');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { pipelineId: 'implementation/pipeline' });
  } finally {
    // WHAT: Remove a fixture execution identity that was absent before the test.
    // WHY: Process environment changes must not leak into later CLI tests.
    if (previous.executionId === undefined) delete process.env.DECISION_OS_EXECUTION_ID;
    else process.env.DECISION_OS_EXECUTION_ID = previous.executionId;
    // WHAT: Remove a fixture project identity that was absent before the test.
    // WHY: Later commands must inherit only their own project scope.
    if (previous.projectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previous.projectId;
    // WHAT: Remove a fixture server URL that was absent before the test.
    // WHY: Later request tests must not target this fixture origin.
    if (previous.serverUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previous.serverUrl;
  }
});

test('queue-pipeline rejects missing identity before requesting', async () => {
  const previousExecutionId = process.env.DECISION_OS_EXECUTION_ID;
  delete process.env.DECISION_OS_EXECUTION_ID;
  let calls = 0;
  try {
    const result = await queuePipeline({ pipelineId: 'implementation-pipeline' }, async () => {
      calls += 1;
      return { ok: true, status: 202, text: async () => '' };
    });
    assert.deepEqual(result, { ok: false, error: 'queue-pipeline requires the running Decision OS execution environment.' });
    assert.equal(calls, 0);
  } finally {
    // WHAT: Restore the prior execution identity after the missing-environment case.
    // WHY: The rejection test must remain isolated from subsequent commands.
    if (previousExecutionId === undefined) delete process.env.DECISION_OS_EXECUTION_ID;
    else process.env.DECISION_OS_EXECUTION_ID = previousExecutionId;
  }
});
