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

test('read-decision-os-settings inherits repository defaults and preserves workspace overrides', () => {
  const repository = mkdtempSync(join(tmpdir(), 'decision-os-repository-settings-'));
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-workspace-settings-'));
  const runtime_state: Record<string, unknown> = {};
  try {
    mkdirSync(join(repository, '.decision-os'), { recursive: true });
    mkdirSync(join(workspace, '.decision-os'), { recursive: true });
    writeFileSync(join(repository, '.decision-os', '.settings.json'), JSON.stringify({
      openaiApiKey: 'repository-key',
      transcriptionModel: 'repository-model'
    }));
    writeFileSync(join(workspace, '.decision-os', '.settings.json'), JSON.stringify({
      transcriptionModel: 'workspace-model'
    }));
    const result = readDecisionOsSettings({
      action_payload: { cwd: workspace, repositorySettingsFile: join(repository, '.decision-os', '.settings.json') },
      runtime_state
    });
    assert.equal(result.repositorySettingsFile, join(repository, '.decision-os', '.settings.json'));
    assert.equal(runtime_state.openaiApiKey, 'repository-key');
    assert.equal(runtime_state.transcriptionModel, 'workspace-model');
  } finally {
    rmSync(repository, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});
