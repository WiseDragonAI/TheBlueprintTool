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
        run: { syncId: 'sync-1', phase: 'requested', sourceProjectId: 'project-b' },
        masterCardId: '',
        ledgerId: '',
        pipelineRunId: '',
        projectId: 'project-b',
        duplicate: false,
      }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
    sourceProjectId: 'project-b',
    sourceNodeId: 'node-b',
    idempotencyKey: 'node-b:project-b:fingerprint',
  });
  assert.equal(admission.run.syncId, 'sync-1');
  assert.equal(admission.masterCardId, '');
  assert.equal(admission.ledgerId, '');
  assert.equal(admission.pipelineRunId, '');
  assert.equal(admission.projectId, 'project-b');
  assert.equal(calls[0].url, '/api/project-sync');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal((calls[0].options.headers as Record<string, string>)['idempotency-key'], 'node-b:project-b:fingerprint');
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), { sourceProjectId: 'project-b', sourceNodeId: 'node-b', idempotencyKey: 'node-b:project-b:fingerprint' });
});

test('routes immediate admission to the provisional Control Room task and retains settings errors', () => {
  const source = readFileSync(fileURLToPath(new URL('../../src/app/responsive/application.js', import.meta.url)), 'utf8');
  assert.match(source, /projectSettingsModal\.close\(\)/);
  assert.match(source, /controlRoomPath\('exec', anchor\)/);
  assert.match(source, /cardId: `project-sync-\$\{admission\.run\.syncId\}`/);
  assert.match(source, /projectSettingsModal\.close\(\);[\s\S]*navigate\(controlRoomPath\('exec', anchor\), true\)/);
  assert.match(source, /error\.hidden = false;\s*button\.disabled = false;/);
  assert.match(source, /addEventListener\('project-sync-change', refresh\)/);
});
