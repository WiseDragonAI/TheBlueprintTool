/**
 * WHAT: Unit test for loading .decision-os/.settings.json into backend runtime state.
 * WHY: Workspace settings must provide frontend and transcription config without shell env.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { readDecisionOsSettings } from '@backend/business/server/helper/read-decision-os-settings.js';

test('read-decision-os-settings reads workspace settings and normalizes aliases', () => {
  traces.length = 0;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-settings-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    mkdirSync(join(workspace, '.decision-os'), { recursive: true });
    writeFileSync(join(workspace, '.decision-os', '.settings.json'), JSON.stringify({
      DECISION_OS_FRONTEND_ROOT: 'decision-os/frontend',
      OPENAI_API_KEY: 'settings-key',
      OPENAI_TRANSCRIPTION_MODEL: 'gpt-4o-mini-transcribe',
      transcriptionEnabled: true
    }));
    const result = readDecisionOsSettings({ action_payload: { cwd: workspace }, runtime_state });
    const settings = result.settings as Record<string, unknown>;
    assert.equal(result.decisionOsRoot, join(workspace, '.decision-os'));
    assert.equal(settings.decisionOsFrontendRoot, join(workspace, 'decision-os', 'frontend'));
    assert.equal(runtime_state.openaiApiKey, 'settings-key');
    assert.equal(runtime_state.transcriptionModel, 'gpt-4o-mini-transcribe');
    assert.ok(traces.some((trace) => trace.name === 'read-decision-os-settings'));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
