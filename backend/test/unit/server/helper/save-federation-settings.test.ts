import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveFederationSettings } from '@backend/business/server/helper/save-federation-settings.js';

test('persists federation connection without replacing unrelated settings or clearing the saved credential', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-federation-settings-'));
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(decisionOsRoot);
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({ maxConcurrentCodexProcesses: 3, federationNodeCredential: 'saved-secret' }));
  const runtime: Record<string, unknown> = {};
  try {
    const result = saveFederationSettings({
      decisionOsRoot,
      runtime,
      value: { enabled: true, relayUrl: 'https://relay.example.workers.dev/', federationId: 'cluster-one', nodeId: 'desktop', nodeLabel: 'Workstation', nodeCredential: '' },
    });
    assert.equal(result.ok, true);
    const saved = JSON.parse(readFileSync(join(decisionOsRoot, '.settings.json'), 'utf8')) as Record<string, unknown>;
    assert.equal(saved.maxConcurrentCodexProcesses, 3);
    assert.equal(saved.federationRelayUrl, 'https://relay.example.workers.dev');
    assert.equal(saved.federationNodeCredential, 'saved-secret');
    assert.equal((runtime.decisionOsSettings as Record<string, unknown>).federationNodeCredential, 'saved-secret');

    const disconnected = saveFederationSettings({ decisionOsRoot, runtime, value: { enabled: false } });
    assert.equal(disconnected.ok, true);
    const remaining = JSON.parse(readFileSync(join(decisionOsRoot, '.settings.json'), 'utf8')) as Record<string, unknown>;
    assert.deepEqual(remaining, { maxConcurrentCodexProcesses: 3 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
