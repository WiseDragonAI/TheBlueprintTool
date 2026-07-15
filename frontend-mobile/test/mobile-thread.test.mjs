import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/mobile-thread.js', import.meta.url), 'utf8');
const sharedThreadRenderer = await readFile(new URL('../../frontend/src/runtime/thread/effect/render-thread-notes.ts', import.meta.url), 'utf8');
const sharedCodexStatus = await readFile(new URL('../../frontend/src/runtime/thread/component/render-thread-codex-log-status.ts', import.meta.url), 'utf8');
const sharedCodexLog = await readFile(new URL('../../frontend/src/runtime/thread/effect/render-thread-codex-log.ts', import.meta.url), 'utf8');
const sharedThreadCss = await readFile(new URL('../../frontend/assets/canvas/thread.css', import.meta.url), 'utf8');
const { collapseMobileThreadComposer, expandMobileThreadComposer } = await import('../src/mobile-thread-composer.js');

test('mobile Text action replaces jump with close, then collapses without clearing the draft', () => {
  const classNames = new Set(['terminal-composer', 'is-mobile-text-collapsed']);
  let focused = false;
  let blurred = false;
  let textButtonFocused = false;
  const draft = { value: 'preserved draft', focus() { focused = true; }, blur() { blurred = true; } };
  const textAttributes = new Map();
  const textButton = {
    focus() { textButtonFocused = true; },
    setAttribute(name, value) { textAttributes.set(name, value); }
  };
  const composer = {
    classList: {
      add(value) { classNames.add(value); },
      remove(value) { classNames.delete(value); }
    },
    querySelector(selector) {
      if (selector === '.thread-draft') return draft;
      if (selector === '[data-action="toggle-thread-text"]') return textButton;
      return null;
    }
  };
  const attributes = new Map();
  const button = {
    closest(selector) { return selector === '.terminal-composer' ? composer : null; },
    setAttribute(name, value) { attributes.set(name, value); }
  };
  const jumpClasses = new Set();
  const jumpAttributes = new Map();
  const jump = {
    dataset: { action: 'jump-thread-bottom' },
    title: 'Jump to bottom',
    hidden: true,
    classList: {
      add(value) { jumpClasses.add(value); },
      remove(value) { jumpClasses.delete(value); }
    },
    setAttribute(name, value) { jumpAttributes.set(name, value); }
  };
  const root = {
    querySelector(selector) {
      if (selector === '.thread-jump-bottom') return jump;
      if (selector === '.terminal-composer') return composer;
      return null;
    }
  };

  assert.equal(expandMobileThreadComposer(button, root), true);
  assert.equal(classNames.has('is-mobile-text-collapsed'), false);
  assert.equal(attributes.get('aria-expanded'), 'true');
  assert.equal(focused, true);
  assert.equal(jump.dataset.action, 'close-thread-text');
  assert.equal(jump.title, 'Close text input');
  assert.equal(jump.hidden, false);
  assert.equal(jumpClasses.has('is-thread-text-close'), true);

  assert.equal(collapseMobileThreadComposer(jump, root), true);
  assert.equal(classNames.has('is-mobile-text-collapsed'), true);
  assert.equal(textAttributes.get('aria-expanded'), 'false');
  assert.equal(jump.dataset.action, 'jump-thread-bottom');
  assert.equal(jumpClasses.has('is-thread-text-close'), false);
  assert.equal(draft.value, 'preserved draft');
  assert.equal(blurred, true);
  assert.equal(textButtonFocused, true);
  assert.match(source, /action === 'toggle-thread-text'\) expandMobileThreadComposer\(button\)/);
  assert.match(source, /action === 'close-thread-text'/);
  assert.match(source, /collapseMobileThreadComposer\(button\)/);
  assert.match(source, /action === 'submit-thread-draft'\) await appendTextNote\(\)/);
});

test('opening a mobile thread does not focus the draft and raise the software keyboard', () => {
  const openMobileThread = source.match(/export function openMobileThread\([\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(openMobileThread, /renderThreadPanel\(\);/);
  assert.doesNotMatch(openMobileThread, /\.focus\(\)/);
});

test('mobile thread uses the shared renderer that owns the local voice progress clock', () => {
  assert.match(source, /import \{ renderThreadPanel \} from '\/canvas-src\/runtime\/thread\/effect\/render-thread-panel\.js';/);
  assert.match(sharedThreadRenderer, /import \{ syncVoiceProgressClock \} from '\.\.\/\.\.\/voice\/effect\/run-voice-progress-clock\.js';/);
  assert.match(sharedThreadRenderer, /spinner\.dataset\.voicePhaseStartedAt = phaseStartedAt/);
  assert.match(sharedThreadRenderer, /syncVoiceProgressClock\(\);/);
});

test('mobile thread routes jump-to-bottom into persistent bottom following', () => {
  assert.match(source, /import \{ pinThreadFeedToLastMessage \} from '\/canvas-src\/runtime\/thread\/effect\/pin-thread-feed-to-last-message\.js';/);
  assert.match(source, /action === 'jump-thread-bottom'\) pinThreadFeedToLastMessage\(\{ follow: true \}\)/);
});

test('mobile thread launch always dispatches an authoritative fresh run', () => {
  assert.doesNotMatch(source, /requestCardSkillRunStatus|requestCardSkillRunContinue|resumeExternallyStartedCardSkillRun/);
  assert.match(source, /const result = await requestThreadCodexProcess\(\{/);
  assert.match(source, /threadId: canvasState\.threadId/);
  assert.match(source, /cardId: String\(currentCard\.id\)/);
  assert.match(source, /function hydrateThreadRun\(runId, startedAt, status, queuePosition\)/);
  assert.match(source, /canvasState\.threadRunSummaryByThreadId\[threadId\] = \{/);
  assert.match(source, /active: status === 'running'/);
  assert.match(source, /queuePosition: Number\.isInteger\(queuePosition\) \? queuePosition : null/);
  assert.match(source, /bindThreadCodexRunLog\([^;]+runId \}\);\n  const status = String\(result\.run\?\.status \|\| 'running'\);\n  hydrateThreadRun\(runId, startedAt, status, result\.queuePosition\);[\s\S]*await refreshThreadLedger\(\)/);
});

test('closing a mobile thread unregisters its project-scoped Codex run consumer', () => {
  const closeMobileThread = source.match(/export function closeMobileThread\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(source, /import \{ bindThreadCodexRunLog, unbindThreadCodexRunLog \}/);
  assert.match(closeMobileThread, /cardCodexThreadRunId\(currentCard\)/);
  assert.match(closeMobileThread, /unbindThreadCodexRunLog\(\{[\s\S]*projectId: currentProjectId/);
  assert.match(source, /bindThreadCodexRunLog\(\{ projectId: currentProjectId/);
});

test('mobile Codex Log uses one action-and-metrics row for queued, running, resumable, and idle runs', () => {
  assert.match(sharedCodexStatus, /strip\.append\(renderRunAction\(/);
  assert.match(sharedCodexStatus, /summary\?\.ok === true && summary\.active === true && status === 'running'/);
  assert.match(sharedCodexStatus, /threadCodexStopState\(input\.runId\)\.pending/);
  assert.match(sharedCodexLog, /const stopError = threadCodexStopState\(runId\)\.error/);
  assert.doesNotMatch(sharedCodexStatus, /\['Status', status\]/);
  assert.match(sharedCodexStatus, /input\.running \? 'STOP' : input\.queued \? 'CANCEL' : input\.runId \? 'RESUME' : 'START'/);
  assert.match(sharedCodexStatus, /button\.dataset\.action = occupied \? 'stop-thread-codex' : 'process-thread-codex'/);
  assert.match(sharedCodexStatus, /icon\.textContent = occupied \? '■' : input\.runId \? '↻' : '▶'/);
  assert.match(sharedCodexStatus, /`Queued · position \$\{summary\.queuePosition\}`/);
  assert.match(sharedCodexLog, /Codex will start when capacity is available/);
  assert.match(sharedCodexStatus, /terminal-button--stop' : 'terminal-button--send'/);
  assert.match(sharedThreadCss, /\.codex-log-status\s*{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(sharedThreadCss, /\.codex-log-action-button\s*{[^}]*max-width:\s*64px;[^}]*height:\s*56px;/s);
  assert.doesNotMatch(sharedThreadCss, /\.codex-log-run-action\s*{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(sharedCodexLog, /if \(!runId\) \{[\s\S]*renderThreadCodexLogStatus\(\{ summary: null, card, runId: '', threadId \}\)/);
  assert.match(source, /import \{ stopThreadCodexRunController \} from '\/canvas-src\/runtime\/codex\/controller\/stop-thread-codex-run-controller\.js';/);
  assert.match(source, /action === 'stop-thread-codex'[\s\S]*stopThreadCodexRunController\(\{/);
  assert.match(source, /ledgerId: currentLedgerId/);
  assert.match(source, /runId: button\.dataset\.codexRunId \|\| ''/);
});

test('mobile thread routes the shared session-delete actions before its note modal actions', () => {
  assert.match(source, /createMobileThreadSessionDeletionHandler/);
  assert.match(source, /if \(await handleMobileThreadSessionDeletion\(\{ action, button \}\)\) return;/);
  assert.match(source, /confirmThreadCodexSessionDeletionController/);
  assert.match(source, /deleteThreadCodexSessionController\(input, \{/);
  assert.match(source, /refresh: refreshThreadLedger/);
  assert.match(source, /resetMobileThreadConfirmationModal\(modal\)/);
});
