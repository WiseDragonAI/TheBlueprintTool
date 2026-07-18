import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startProjectSyncRequest } from '../../src/app/responsive/project-settings.js';

test('starts a node-agnostic project synchronization with an idempotency key', async () => {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const admission = await startProjectSyncRequest({
    fetchImpl: async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        run: { syncId: 'sync-1', phase: 'requested' },
        masterCardId: 'card-sync-1',
        ledgerId: 'specs',
        pipelineRunId: 'pipeline-1',
        projectId: 'project-a',
        duplicate: false,
      }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
    sourceProjectId: 'project-b',
    sourceNodeId: 'node-b',
    idempotencyKey: 'node-b:project-b:fingerprint',
  });
  assert.equal(admission.run.syncId, 'sync-1');
  assert.equal(admission.masterCardId, 'card-sync-1');
  assert.equal(admission.ledgerId, 'specs');
  assert.equal(admission.pipelineRunId, 'pipeline-1');
  assert.equal(admission.projectId, 'project-a');
  assert.equal(calls[0].url, '/api/project-sync');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal((calls[0].options.headers as Record<string, string>)['idempotency-key'], 'node-b:project-b:fingerprint');
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), { sourceProjectId: 'project-b', sourceNodeId: 'node-b', idempotencyKey: 'node-b:project-b:fingerprint' });
});

test('routes successful admission to the canonical Control Room task and retains settings errors', () => {
  const source = readFileSync(fileURLToPath(new URL('../../src/app/responsive/application.js', import.meta.url)), 'utf8');
  assert.match(source, /projectSettingsModal\.close\(\)/);
  assert.match(source, /loadControlRoom\(\{ force: true \}\)/);
  assert.match(source, /controlRoomPath\('exec', anchor\)/);
  assert.match(source, /projectId: admission\.projectId, ledgerId: admission\.ledgerId, cardId: admission\.masterCardId/);
  assert.match(source, /error\.hidden = false;\s*button\.disabled = false;/);
  assert.doesNotMatch(source, /subscribeProjectSyncEvents|projectSyncRuns|project-sync\/events/);
});
