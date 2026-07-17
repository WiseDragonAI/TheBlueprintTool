import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProjectSyncRuns, startProjectSyncRequest } from '../../src/app/responsive/project-settings.js';

test('starts a node-agnostic project synchronization with an idempotency key', async () => {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const run = await startProjectSyncRequest({
    fetchImpl: async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ run: { syncId: 'sync-1', phase: 'requested' } }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
    sourceProjectId: 'node-b:project-b',
    idempotencyKey: 'project-b:fingerprint',
  });
  assert.equal(run.syncId, 'sync-1');
  assert.equal(calls[0].url, '/api/project-sync');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal((calls[0].options.headers as Record<string, string>)['idempotency-key'], 'project-b:fingerprint');
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), { sourceProjectId: 'node-b:project-b', idempotencyKey: 'project-b:fingerprint' });
});

test('restores durable project synchronization runs after reload', async () => {
  const runs = await loadProjectSyncRuns(async () => new Response(JSON.stringify({ runs: [{ syncId: 'sync-1', phase: 'source_publish' }] }), { status: 200 }));
  assert.deepEqual(runs, [{ syncId: 'sync-1', phase: 'source_publish' }]);
});
