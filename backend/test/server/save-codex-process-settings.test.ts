import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { saveCodexProcessSettings } from '../../src/business/server/helper/save-codex-process-settings.js';

test('saves the process limit while preserving unrelated project settings', () => {
  const decisionOsRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-settings-'));
  try {
    writeFileSync(resolve(decisionOsRoot, '.settings.json'), JSON.stringify({ openaiApiKey: 'preserved', transcriptionEnabled: true }));
    const runtime: Record<string, unknown> = { decisionOsRoot };
    const saved = saveCodexProcessSettings({ decisionOsRoot, runtime, maxConcurrentCodexProcesses: 4 });
    assert.equal(saved.ok, true);
    assert.equal((runtime.decisionOsSettings as Record<string, unknown>).maxConcurrentCodexProcesses, 4);
    assert.deepEqual(JSON.parse(readFileSync(resolve(decisionOsRoot, '.settings.json'), 'utf8')), {
      openaiApiKey: 'preserved', transcriptionEnabled: true, maxConcurrentCodexProcesses: 4,
    });
    assert.equal(saveCodexProcessSettings({ decisionOsRoot, runtime, maxConcurrentCodexProcesses: 0 }).statusCode, 400);
    assert.equal(saveCodexProcessSettings({ decisionOsRoot, runtime, maxConcurrentCodexProcesses: 33 }).statusCode, 400);
  } finally {
    rmSync(decisionOsRoot, { recursive: true, force: true });
  }
});
