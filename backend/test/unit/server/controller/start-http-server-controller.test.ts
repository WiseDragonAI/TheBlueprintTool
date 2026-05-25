/**
 * WHAT: Unit test for implemented function start-http-server-controller.
 * WHY: each generated function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { startHttpServerController } from '@backend/business/server/controller/start-http-server-controller.js';

test('start-http-server-controller executes implemented behavior and records telemetry', async () => {
  traces.length = 0;
  const runtime_state: Record<string, unknown> = {};
  const result = await startHttpServerController({
    action_payload: { ok: true, mode: 'dry-run', name: 'Implemented', color: '#5b7cfa', markdown: '# Title #label', url: '/ledgers/default' },
    runtime_state,
    data_model: { cards: [{ id: 'card-1' }], document: {} }
  });
  assert.ok(traces.length > 0);
  assert.ok(result === undefined || typeof result === 'object');
});

test('start-http-server-controller applies .blueprinttool settings from workspace cwd', async () => {
  traces.length = 0;
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-start-settings-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    mkdirSync(join(workspace, '.blueprinttool'), { recursive: true });
    writeFileSync(join(workspace, '.blueprinttool', 'state.json'), JSON.stringify({ tabs: [] }));
    writeFileSync(join(workspace, '.blueprinttool', '.settings.json'), JSON.stringify({
      frontendRoot: '/tmp/corev2-frontend',
      openaiApiKey: 'settings-key',
      transcriptionModel: 'gpt-4o-mini-transcribe'
    }));
    const result = await startHttpServerController({
      action_payload: { mode: 'dry-run', cwd: workspace, port: 0, host: '127.0.0.1' },
      runtime_state,
      data_model: {}
    });
    const settings = result.settings as { blueprinttoolRoot: string };
    assert.equal(result.ok, true);
    assert.equal(settings.blueprinttoolRoot, join(workspace, '.blueprinttool'));
    assert.equal(runtime_state.corev2FrontendRoot, '/tmp/corev2-frontend');
    assert.equal(runtime_state.openaiApiKey, 'settings-key');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
