import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projectSyncRequestInput, startProjectSyncRequest } from '../../src/app/responsive/project-settings.js';

test('derives one normalized request from the first eligible remote replica', () => {
  const input = projectSyncRequestInput({
    replicas: [
      { projectId: 'project-local', nodeId: 'workstation', local: true, online: true, originFingerprint: 'local-fingerprint' },
      { projectId: 'project-offline', nodeId: 'offline', local: false, online: false, originFingerprint: 'offline-fingerprint' },
      { projectId: ' project-remote ', nodeId: ' node-b ', local: false, online: true, originFingerprint: ' FINGERPRINT-B ' },
      { projectId: 'project-later', nodeId: 'node-c', local: false, online: true, originFingerprint: 'fingerprint-c' },
    ],
  });

  assert.deepEqual(input, {
    sourceProjectId: 'project-remote',
    sourceNodeId: 'node-b',
    idempotencyKey: 'node-b:project-remote:fingerprint-b',
  });
});

test('returns null when no remote replica is online and addressable', () => {
  assert.equal(projectSyncRequestInput({
    replicas: [
      { projectId: 'project-local', nodeId: 'workstation', local: true, online: true, originFingerprint: 'local-fingerprint' },
      { projectId: 'project-offline', nodeId: 'offline', local: false, online: false, originFingerprint: 'offline-fingerprint' },
      { projectId: 'project-blank', nodeId: '', local: false, online: true, originFingerprint: 'blank-fingerprint' },
    ],
  }), null);
});

test('serializes the complete project synchronization request unchanged', async () => {
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
  assert.doesNotMatch(source, /project-settings-sync[\s\S]{0,500}\.dataset\./);
  assert.match(source, /projectSettingsModal\.close\(\)/);
  assert.match(source, /controlRoomPath\('exec', anchor\)/);
  assert.match(source, /cardId: `project-sync-\$\{admission\.run\.syncId\}`/);
  assert.match(source, /projectSettingsModal\.close\(\);[\s\S]*navigate\(controlRoomPath\('exec', anchor\), true\)/);
  assert.match(source, /error\.hidden = false;\s*button\.disabled = false;/);
  assert.match(source, /addEventListener\('project-sync-change', refresh\)/);
});
