import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [html, script, styles, mobile] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/mobile-codex.js', root), 'utf8'),
  readFile(new URL('assets/mobile.css', root), 'utf8'),
  readFile(new URL('src/mobile.js', root), 'utf8'),
]);

test('mobile card detail exposes processing and both process libraries', () => {
  assert.match(html, /class="process-card-button"/);
  assert.match(html, /data-process-tab="skills"/);
  assert.match(html, /data-process-tab="pipelines"/);
  assert.match(mobile, /setMobileCodexContext\(\{ ledgerId: state\.activeLedgerId, cardId: state\.activeCardId \}\)/);
  assert.match(script, /ledgerId: state\.ledgerId, cardId: state\.cardId, skillName: skill\.name/);
  assert.match(script, /ledgerId: state\.ledgerId, sourceCardId: state\.cardId, pipelineId: pipeline\.id/);
});

test('mobile processing guards duplicate submissions and polls terminal states', () => {
  assert.match(script, /submit\.disabled = true/);
  assert.match(script, /new Set\(\['complete', 'failed', 'cancelled'\]\)/);
  assert.match(script, /\/api\/codex\/skills\/runs\/\$\{encodeURIComponent\(run\.id\)\}/);
  assert.match(script, /\/api\/codex\/pipelines\/runs\/\$\{encodeURIComponent\(runId\)\}/);
});

test('mobile pipeline editor supports ordered steps, ordered skills, inheritance, and persistence', () => {
  assert.match(html, /class="codex-modal pipeline-editor-modal"/);
  assert.match(html, /class="codex-modal skill-picker-modal"/);
  assert.match(script, /move\(state\.editor\.steps, index, -1\)/);
  assert.match(script, /move\(step\.skills, index, -1\)/);
  assert.match(script, /codexModel: null, codexEffort: null/);
  assert.match(script, /method: editor\.existingId \? 'PUT' : 'POST'/);
  assert.match(script, /save\.disabled = true/);
});

test('nested mobile layers have explicit back actions and narrow layouts cannot overflow', () => {
  assert.match(html, /class="codex-back pipeline-editor-back"/);
  assert.match(html, /class="codex-back skill-picker-back"/);
  assert.match(styles, /\.codex-modal \{ width: min\(100%, 720px\)/);
  assert.match(styles, /min-width: 0/);
  assert.match(styles, /:focus-visible/);
});

test('catalog, save, run, invalid-reference, and warning messages stay actionable', () => {
  assert.match(script, /throw Object\.assign\(new Error/);
  assert.match(script, /Invalid references:/);
  assert.match(script, /result\.issues\?\.map/);
  assert.match(script, /message\('\.pipeline-editor-message', formatError\(error\), true\)/);
});
