import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCodexProcessSettings, saveCodexProcessSettings, stepCodexProcessLimit, validateCodexProcessLimit } from '../src/mobile-codex-settings.js';

test('steps, validates, and saves the server-wide Codex process limit', async () => {
  assert.equal(validateCodexProcessLimit('4'), 4);
  assert.equal(stepCodexProcessLimit('4', 1), 5);
  assert.equal(stepCodexProcessLimit('4', -1), 3);
  assert.equal(stepCodexProcessLimit('1', -1), 1);
  assert.equal(stepCodexProcessLimit('32', 1), 32);
  assert.throws(() => validateCodexProcessLimit('0'), /integer from 1 to 32/);
  assert.throws(() => validateCodexProcessLimit('2.5'), /integer from 1 to 32/);
  let request;
  const result = await saveCodexProcessSettings(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ ok: true, maxConcurrentCodexProcesses: 4 }) };
  }, '4');
  assert.equal(request.url, '/api/settings/codex-processes');
  assert.equal(request.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(request.options.body), { maxConcurrentCodexProcesses: 4 });
  assert.equal(result.maxConcurrentCodexProcesses, 4);
});

test('loads the persisted server-wide Codex process limit', async () => {
  const result = await loadCodexProcessSettings(async () => ({
    ok: true,
    json: async () => ({ ok: true, maxConcurrentCodexProcesses: 3, minimum: 1, maximum: 32 }),
  }));
  assert.equal(result.maxConcurrentCodexProcesses, 3);
});

test('exposes the settings screen from burger navigation', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/mobile.js'), 'utf8');
  const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
  assert.match(source, /destination\('Settings', '\/settings'/);
  assert.match(source, /location\.pathname === '\/settings'/);
  assert.match(html, /id="settings-view"/);
  assert.match(html, /Maximum concurrent Codex processes/);
  assert.doesNotMatch(html, /id="codex-settings-project"/);
  assert.doesNotMatch(html, /id="codex-settings-limit"[^>]*type="number"/);
  assert.match(html, /class="codex-icon codex-settings-increase"/);
  assert.match(html, /class="codex-icon codex-settings-decrease"/);
  assert.match(html, /class="codex-icon codex-settings-decrease"[^>]*disabled/);
  assert.match(source, /stepCodexProcessLimit/);
});
