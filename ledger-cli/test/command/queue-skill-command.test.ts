import test from 'node:test';
import assert from 'node:assert/strict';
import { queueSkill } from '../../src/business/codex/effect/queue-skill.js';

test('queue-skill sends the current execution and selected runtime options', async () => {
  const previous = {
    executionId: process.env.DECISION_OS_EXECUTION_ID,
    projectId: process.env.DECISION_OS_PROJECT_ID,
    serverUrl: process.env.DECISION_OS_SERVER_URL,
  };
  process.env.DECISION_OS_EXECUTION_ID = 'execution/gate';
  process.env.DECISION_OS_PROJECT_ID = 'project/a';
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50151/';
  const calls: Array<{ url: string; init: RequestInit }> = [];
  try {
    const result = await queueSkill({
      skillName: 'analysis',
      codexModel: 'gpt-5.6-sol',
      codexEffort: 'ultra',
    }, async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 202, text: async () => '{"ok":true}' };
    });
    assert.deepEqual(result, {
      ok: true,
      value: 'Queued analysis; the calling skill will run again after it completes.',
    });
    assert.equal(calls[0].url, 'http://127.0.0.1:50151/p/project%2Fa/api/codex/executions/execution%2Fgate/queue-skill');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      skillName: 'analysis',
      codexModel: 'gpt-5.6-sol',
      codexEffort: 'ultra',
    });
  } finally {
    if (previous.executionId === undefined) delete process.env.DECISION_OS_EXECUTION_ID;
    else process.env.DECISION_OS_EXECUTION_ID = previous.executionId;
    if (previous.projectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previous.projectId;
    if (previous.serverUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previous.serverUrl;
  }
});

test('queue-skill fails before requesting without the execution environment', async () => {
  const previous = process.env.DECISION_OS_EXECUTION_ID;
  delete process.env.DECISION_OS_EXECUTION_ID;
  let calls = 0;
  try {
    const result = await queueSkill({
      skillName: 'analysis',
      codexModel: 'gpt-5.6-sol',
      codexEffort: 'ultra',
    }, async () => {
      calls += 1;
      return { ok: true, status: 202, text: async () => '' };
    });
    assert.deepEqual(result, { ok: false, error: 'queue-skill requires the running Decision OS execution environment.' });
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.DECISION_OS_EXECUTION_ID;
    else process.env.DECISION_OS_EXECUTION_ID = previous;
  }
});
