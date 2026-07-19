/**
 * WHAT: Integration contract checks for the Codex Log session-deletion flow.
 * WHY: The destructive control must remain the final log action and reconcile only after backend success.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const source = (path: string): string => readFileSync(new URL(path, root), 'utf8');

test('Codex Log renders the owned thread-session footer only after terminal settlement', () => {
  const renderer = source('frontend/src/runtime/thread/effect/render-thread-codex-log.ts');
  assert.match(renderer, /function renderDeleteSession/);
  assert.match(renderer, /button\.dataset\.action = 'confirm-delete-thread-codex-session'/);
  assert.match(renderer, /root\.append\(stream\);/);
  assert.match(renderer, /if \(selectedSummary\?\.runKind === 'thread' && selectedSummary\.status !== 'pending' && selectedSummary\.status !== 'running'\)/);
  assert.match(renderer, /if \(!runId\)[\s\S]*return;/);
  assert.doesNotMatch(renderer, /renderDeleteSession[\s\S]{0,500}button\.disabled/);
  const css = source('frontend/assets/shared/thread.css');
  assert.match(css, /\.codex-log-session-footer\s*{[^}]*border-top:/s);
  assert.match(css, /\.codex-log-delete-session\s*{[^}]*min-width:/s);
});

test('shared modal confirmation routes exact identity and success clears cached session state', () => {
  const confirmation = source('frontend/src/runtime/codex/controller/confirm-thread-codex-session-deletion-controller.ts');
  assert.match(confirmation, /modal\.dataset\.confirmKind = 'codex-session'/);
  assert.match(confirmation, /An active run will be stopped and its context and log will be permanently removed/);
  assert.match(confirmation, /confirm\.dataset\.action = 'delete-thread-codex-session'/);
  assert.match(confirmation, /confirm\?\.focus\(\)/);

  const routing = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  assert.match(routing, /action === 'confirm-delete-thread-codex-session'[\s\S]*confirmThreadCodexSessionDeletionController/);
  assert.match(routing, /action === 'delete-thread-codex-session'[\s\S]*deleteThreadCodexSessionController/);

  const deletion = source('frontend/src/runtime/codex/controller/delete-thread-codex-session-controller.ts');
  assert.match(deletion, /deletionStateByRunId\.set\(input\.runId, \{ pending: true, error: '' \}\)[\s\S]*await requestThreadCodexSessionDelete/);
  assert.match(deletion, /const refresh = effects\.refresh \?\? refreshRuntimeState/);
  assert.match(deletion, /const render = effects\.render \?\? renderThreadPanel/);
  assert.match(deletion, /if \(!result\.ok\)[\s\S]*error: result\.error[\s\S]*render\(\)[\s\S]*return false/);
  assert.match(deletion, /clearThreadRunCache\(input\.threadId\)[\s\S]*await refresh\(\)[\s\S]*render\(\)/);
  for (const key of ['threadRunIdByThreadId', 'threadRunSummaryByThreadId', 'threadRunEventsByThreadId', 'threadToolGroupDisclosureByThreadId', 'threadToolRowDisclosureByThreadId']) {
    assert.match(deletion, new RegExp(key));
  }
});
