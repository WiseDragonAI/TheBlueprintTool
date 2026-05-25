/**
 * WHAT: Unit test for loading .blueprinttool/.settings.json into backend runtime state.
 * WHY: Workspace settings must provide frontend and transcription config without shell env.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { readBlueprinttoolSettings } from '@backend/business/server/helper/read-blueprinttool-settings.js';

test('read-blueprinttool-settings reads workspace settings and normalizes aliases', () => {
  traces.length = 0;
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-settings-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    mkdirSync(join(workspace, '.blueprinttool'), { recursive: true });
    writeFileSync(join(workspace, '.blueprinttool', '.settings.json'), JSON.stringify({
      COREV2_FRONTEND_ROOT: 'CoreV2/frontend',
      OPENAI_API_KEY: 'settings-key',
      OPENAI_TRANSCRIPTION_MODEL: 'gpt-4o-mini-transcribe',
      transcriptionEnabled: true
    }));
    const result = readBlueprinttoolSettings({ action_payload: { cwd: workspace }, runtime_state });
    const settings = result.settings as Record<string, unknown>;
    assert.equal(result.blueprinttoolRoot, join(workspace, '.blueprinttool'));
    assert.equal(settings.corev2FrontendRoot, join(workspace, 'CoreV2', 'frontend'));
    assert.equal(runtime_state.openaiApiKey, 'settings-key');
    assert.equal(runtime_state.transcriptionModel, 'gpt-4o-mini-transcribe');
    assert.ok(traces.some((trace) => trace.name === 'read-blueprinttool-settings'));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
