/** WHAT: Preserves the complete responsive thread interaction contract. WHY: Notes, voice, logs, composer state, and run controls must survive frontend unification. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/app/responsive/thread.js', import.meta.url), 'utf8');
const sharedThreadRenderer = await readFile(new URL('../../frontend/src/runtime/thread/effect/render-thread-notes.ts', import.meta.url), 'utf8');
const sharedCodexStatus = await readFile(new URL('../../frontend/src/runtime/thread/component/render-thread-codex-log-status.ts', import.meta.url), 'utf8');
const sharedCodexLog = await readFile(new URL('../../frontend/src/runtime/thread/effect/render-thread-codex-log.ts', import.meta.url), 'utf8');
const sharedThreadCss = await readFile(new URL('../../frontend/assets/shared/thread.css', import.meta.url), 'utf8');
const sharedTerminalButtonCss = await readFile(new URL('../../frontend/assets/shared/terminal-button.css', import.meta.url), 'utf8');
const applicationSource = await readFile(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8');
const applicationCss = await readFile(new URL('../assets/application.css', import.meta.url), 'utf8');
const { collapseMobileThreadComposer, expandMobileThreadComposer } = await import('../src/app/responsive/thread-composer.js');
const { voiceRetryInput } = await import('../src/app/responsive/thread-voice-retry.js');

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

test('responsive card threads own desktop split geometry and documented entry shortcuts', () => {
  const shortcut = source.match(/export async function handleResponsiveThreadShortcut\(event\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const keydown = applicationSource.match(/window\.addEventListener\('keydown', async \(event\) => \{[\s\S]*?\n\}\);/)?.[0] ?? '';

  assert.match(applicationCss, /body\.card-thread-open \.app-shell \{ margin-right: clamp\(420px, 33vw, 620px\); \}/);
  assert.match(applicationCss, /\.mobile-thread-inspector \{[\s\S]*width: clamp\(420px, 33vw, 620px\);/);
  assert.match(applicationCss, /@media \(max-width: 759px\) \{[\s\S]*body:has\(\.mobile-thread-inspector \.thread-panel:not\(\[hidden\]\)\) \{ overflow: hidden; \}/);
  assert.match(source, /document\.body\.classList\.add\('card-thread-open'\)/);
  assert.match(source, /document\.body\.classList\.remove\('card-thread-open'\)/);
  assert.match(source, /export async function handleResponsiveThreadShortcut\(event\)/);
  assert.match(source, /key === 'a'[\s\S]*canvasState\.threadPanelOpen\) focusThreadDraft\(\)/);
  assert.match(source, /key === 'x'[\s\S]*startVoiceRecording\(\)/);
  assert.match(shortcut, /key === 'escape' && canvasState\.voice\.recording[\s\S]*cancelQuickVoiceComment\(\)/);
  assert.match(shortcut, /key === 'escape' && desktop && event\.target instanceof HTMLElement && event\.target\.closest\('\.thread-draft'\)[\s\S]*event\.target\.blur\(\)/);
  assert.match(shortcut, /key === 'escape' && desktop && currentCard\?\.labels\?\.includes\('master-task'\)[\s\S]*querySelector\('\.back-to-zone-button'\)\?\.click\(\)/);
  assert.match(shortcut, /key === 'escape' && canvasState\.threadPanelOpen[\s\S]*closeMobileThread\(\)/);
  assert.match(keydown, /desktopThreadDraftEscape = event\.key === 'Escape'[\s\S]*target\?\.closest\('\.thread-draft'\)/);
  assert.match(keydown, /isCardEditingKeyboardTarget\(target\) && !desktopThreadDraftEscape/);
  assert.match(applicationSource, /await handleResponsiveThreadShortcut\(event\)/);
});

test('desktop Shift+X queues Codex after server acceptance and returns to Control Room execution', () => {
  const shortcut = source.match(/export async function handleResponsiveThreadShortcut\(event\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(shortcut, /const launchMode = event\.ctrlKey \? 'pipeline' : event\.shiftKey \? 'run' : 'send';/);
  assert.match(shortcut, /const submitted = await stopVoiceRecording\(\{ launchMode \}\);/);
  assert.match(shortcut, /if \(launchMode !== 'send'\) await finishQueuedVoiceSubmission\(submitted\);/);
  assert.doesNotMatch(shortcut, /onPersisted/);
  assert.match(applicationSource, /await navigate\(controlRoomPath\('exec'\), true\)/);
});

test('mobile thread uses the shared renderer that owns the local voice progress clock', () => {
  assert.match(source, /import \{ renderThreadPanel \} from '\/src\/runtime\/thread\/effect\/render-thread-panel\.js';/);
  assert.match(sharedThreadRenderer, /import \{ syncVoiceProgressClock \} from '\.\.\/\.\.\/voice\/effect\/run-voice-progress-clock\.js';/);
  assert.match(sharedThreadRenderer, /spinner\.dataset\.voicePhaseStartedAt = phaseStartedAt/);
  assert.match(sharedThreadRenderer, /syncVoiceProgressClock\(\);/);
});

test('responsive voice retry forwards the locally preserved upload identity', () => {
  const input = voiceRetryInput({
    dataset: {
      threadId: 'thread-card-a',
      noteId: 'note-local',
      voiceFileRef: '',
      localVoiceUploadId: 'note-local',
    },
  });

  assert.deepEqual(input, {
    threadId: 'thread-card-a',
    noteId: 'note-local',
    voiceFileRef: '',
    localVoiceUploadId: 'note-local',
  });
  assert.match(source, /action === 'voice-retry'\) await retryVoiceTranscription\(voiceRetryInput\(button\)\)/);
});

test('mobile thread routes jump-to-bottom into persistent bottom following', () => {
  assert.match(source, /import \{ pinThreadSurfaceToBottom \} from '\/src\/runtime\/thread\/effect\/pin-thread-feed-to-last-message\.js';/);
  assert.match(source, /action === 'jump-thread-bottom'[\s\S]*pinThreadSurfaceToBottom\(surface, \{ follow: true \}\)/);
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
  assert.match(source, /bindThreadCodexRunLog\([^;]+runId \}\);\n  const status = String\(result\.run\?\.status \|\| 'running'\);\n  hydrateThreadRun\(runId, startedAt, status, result\.queuePosition\);[\s\S]*await refreshThreadLedger\(runId\)/);
});

test('mobile thread reconciles the refreshed ledger before rerendering an accepted run', () => {
  assert.match(source, /const reconciled = reconcileResponsiveThreadLedger\(\{/);
  assert.match(source, /canvasState\.activeLedger = reconciled\.ledger;\n  currentCard = reconciled\.card;\n  renderThreadPanel\(\);/);
  assert.match(source, /await refreshThreadLedger\(runId\);/);
});

test('closing a mobile thread unregisters its project-scoped Codex run consumer', () => {
  const closeMobileThread = source.match(/export function closeMobileThread\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(source, /import \{ bindThreadCodexRunLog, unbindThreadCodexRunLog \}/);
  assert.match(closeMobileThread, /cardCodexThreadRunId\(currentCard\)/);
  assert.match(closeMobileThread, /unbindThreadCodexRunLog\(\{[\s\S]*projectId: currentProjectId/);
  assert.match(source, /bindThreadCodexRunLog\(\{ projectId: currentProjectId/);
});

test('every card route exit closes through the shared navigation lifecycle', () => {
  const backHandler = applicationSource.match(/document\.querySelector\('\.back-to-zone-button'\)\.addEventListener\('click',[\s\S]*?\n\}\);/)?.[0] ?? '';
  const closeMobileThread = source.match(/export function closeMobileThread\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const navigate = applicationSource.match(/function navigate\(path, replace = false\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const navigateTaskBack = applicationSource.match(/async function navigateTaskBack\(destination\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(applicationSource, /import \{ closeMobileThread,/);
  assert.match(applicationSource, /function closeCardDetail\(\)/);
  assert.match(applicationSource, /name !== 'card-view' && name !== 'loading-view' && !closeCardDetail\(\)/);
  assert.match(navigate, /currentLocation !== nextLocation && !closeCardDetail\(\)/);
  assert.match(backHandler, /controlRoomDestination[\s\S]*navigateTaskBack\(destination\)/);
  assert.match(backHandler, /navigate\(destination\)/);
  assert.match(navigateTaskBack, /startViewTransition\(\(\) => \{ navigate\(destination\); \}\)/);
  assert.doesNotMatch(navigateTaskBack, /startViewTransition\(async/);
  assert.match(applicationSource, /patch-card'[\s\S]*navigate\(controlRoomPath\(nextStatus === 'backlog'/);
  assert.match(applicationSource, /complete-master-task'[\s\S]*navigate\(completionReturnPath\(\), true\)/);
  assert.match(applicationSource, /delete-card'[\s\S]*navigate\(controlRoomPath\(state\.controlTab\), true\)/);
  assert.match(applicationSource, /popstate'[\s\S]*closeCardDetail\(\)[\s\S]*loadRoute\(\)/);
  assert.match(closeMobileThread, /if \(canvasState\.voice\.recording\) return false;/);
  assert.match(closeMobileThread, /canvasState\.threadPanelOpen = false;/);
  assert.match(closeMobileThread, /classList\.remove\('card-thread-open'\)/);
  assert.match(closeMobileThread, /return true;/);
});

test('master-task Back uses a short accessible opacity-only handoff', () => {
  const renderCard = applicationSource.match(/function renderCard\(card\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(renderCard, /backIcon\.className = 'back-button__icon'[\s\S]*backIcon\.textContent = '←'[\s\S]*backLabel\.textContent = 'Back'[\s\S]*backButton\.replaceChildren\(backIcon, backLabel\)/);
  assert.match(renderCard, /parsedTask\.masterTask[\s\S]*shortcutKey\('Esc'\)[\s\S]*aria-hidden[\s\S]*aria-keyshortcuts', 'Escape'/);
  assert.match(renderCard, /else \{[\s\S]*removeAttribute\('aria-keyshortcuts'\)[\s\S]*removeAttribute\('title'\)/);
  assert.match(applicationCss, /\.back-button \{[^}]*display: inline-flex;[^}]*gap: 8px/);
  assert.match(applicationCss, /\.back-button__icon \{[^}]*display: inline-grid;[^}]*width: 14px;[^}]*height: 14px;[^}]*place-items: center;[^}]*line-height: 1/);
  assert.doesNotMatch(applicationCss, /\.back-button \.terminal-button__key/);
  assert.match(sharedTerminalButtonCss, /\.terminal-button__key \{[\s\S]*color: #9ea8b5;[\s\S]*border: 1px solid #394047;[\s\S]*background: #0f1318;/);
  assert.match(applicationSource, /dataset\.taskBackHandoff = 'true'/);
  assert.match(applicationSource, /prefers-reduced-motion: reduce/);
  assert.match(applicationCss, /data-task-back-handoff="true"\]::view-transition-old\(root\)[^{]*\{ animation: task-back-fade-out 140ms/);
  assert.match(applicationCss, /data-task-back-handoff="true"\]::view-transition-new\(root\)[^{]*\{ animation: task-back-fade-in 180ms/);
  assert.match(applicationCss, /@keyframes task-back-fade-out \{ to \{ opacity: 0; \} \}/);
  assert.match(applicationCss, /@keyframes task-back-fade-in \{ from \{ opacity: 0; \} \}/);
  assert.match(applicationCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*data-task-back-handoff="true"\]::view-transition-old\(root\)[\s\S]*animation: none/);
});

test('every desktop card opens through one thread lifecycle while mobile cards stay closed', () => {
  const renderCard = applicationSource.match(/function renderCard\(card\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const openCardDetail = applicationSource.match(/function openCardDetail\(card\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(renderCard, /openCardDetail\(card\)/);
  assert.match(openCardDetail, /setView\('card-view'\)/);
  assert.match(openCardDetail, /window\.matchMedia\?\.\('\(min-width: 761px\)'\)\.matches === true[\s\S]*openMobileThread\(card/);
  assert.match(openCardDetail, /else \{[\s\S]*closeMobileThread\(\)/);
  assert.doesNotMatch(openCardDetail, /parsedTask\.masterTask/);
  assert.doesNotMatch(applicationSource, /await navigate\(cardPath\(ledgerRef\.id, zone\.id, cardId\)\);\n  openMobileThread/);
});

test('mobile Codex Log makes queued work read-only while preserving actions for other run states', () => {
  assert.match(sharedCodexStatus, /if \(!queued\) strip\.append\(renderRunAction\(/);
  assert.match(sharedCodexStatus, /summary\?\.ok === true && summary\.active === true && status === 'running'/);
  assert.match(sharedCodexStatus, /threadCodexStopState\(input\.runId\)\.pending/);
  assert.match(sharedCodexLog, /const stopError = threadCodexStopState\(runId\)\.error/);
  assert.doesNotMatch(sharedCodexStatus, /\['Status', status\]/);
  assert.match(sharedCodexStatus, /input\.running \? 'STOP' : input\.runId \? 'RESUME' : 'START'/);
  assert.match(sharedCodexStatus, /button\.dataset\.action = occupied \? 'stop-thread-codex' : 'process-thread-codex'/);
  assert.match(sharedCodexStatus, /icon\.textContent = occupied \? '■' : input\.runId \? '↻' : '▶'/);
  assert.match(sharedCodexStatus, /`Queued · position \$\{summary\.queuePosition\}`/);
  assert.match(sharedCodexLog, /Waiting for Codex capacity/);
  assert.match(sharedCodexStatus, /terminal-button--stop' : 'terminal-button--send'/);
  assert.match(sharedThreadCss, /\.codex-log-status\s*{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(sharedThreadCss, /\.codex-log-status\[data-run-status="pending"\]\s*{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(sharedThreadCss, /\.thread-tab\[data-run-status="pending"\]::before\s*{[^}]*animation:\s*thread-codex-log-queued/s);
  assert.match(sharedThreadCss, /\.codex-log-queue-indicator i\s*{[^}]*animation:\s*codex-log-queue-dot/s);
  assert.match(sharedThreadCss, /\.codex-log-action-button\s*{[^}]*max-width:\s*64px;[^}]*height:\s*56px;/s);
  assert.doesNotMatch(sharedThreadCss, /\.codex-log-run-action\s*{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(sharedCodexLog, /if \(!runId\) \{[\s\S]*renderThreadCodexLogStatus\(\{ summary: null, card, runId: '', threadId \}\)/);
  assert.match(source, /import \{ stopThreadCodexRunController \} from '\/src\/runtime\/codex\/controller\/stop-thread-codex-run-controller\.js';/);
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
