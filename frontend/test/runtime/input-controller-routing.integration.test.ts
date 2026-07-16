/**
 * WHAT: Static integration checks for browser command routing and canvas-control CSS.
 * WHY: Input and rendering affordances must keep using runtime controllers instead of ad hoc effects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('browser inputs route ledger commands through runtime controllers before server effects', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  assert.match(pointerUp, /createZoneController/);
  assert.match(pointerUp, /createGroupController/);
  assert.match(pointerUp, /commitSelectedLedgerGeometry/);
  assert.match(pointerDown, /selectThread\(''\)/);
  assert.match(pointerDown, /closeThreadPanel\(\)/);
  assert.doesNotMatch(pointerUp, /createZoneFromRect/);
  assert.doesNotMatch(pointerUp, /createGroupFromRect/);
  assert.doesNotMatch(pointerUp, /commitActiveLedgerMutation/);

  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  assert.match(wheel, /scheduleViewportTransform/);
  assert.doesNotMatch(wheel, /renderRelationshipOverlay/);
  assert.doesNotMatch(wheel, /viewport\.x\s*-=/);
  assert.doesNotMatch(wheel, /deltaX\s*\|\|\s*event\.deltaY/);

  const createZone = source('frontend/src/runtime/zone/effect/create-zone-from-rect.ts');
  assert.match(createZone, /commitActiveLedgerMutation/);
  assert.match(createZone, /createLedgerZoneAnnotation/);
  assert.doesNotMatch(createZone, /Math\.max\(0,\s*rect\.(x|y)\)/);

  const zoneAnnotation = source('frontend/src/runtime/ledger/helper/create-ledger-zone-annotation.ts');
  assert.doesNotMatch(zoneAnnotation, /Math\.max\(0,\s*input\.rect\.(x|y)\)/);

  const bindInputs = source('frontend/src/runtime/input/effect/bind-inputs.ts');
  assert.doesNotMatch(bindInputs, /state\.zoneColor\s*=\s*['"]#55b8ff['"]/);
  assert.doesNotMatch(bindInputs, /dblclick/);

  const renderToolbox = source('frontend/src/runtime/toolbox/effect/render-toolbox.ts');
  assert.match(renderToolbox, /input\.value\s*=\s*state\.zoneColor/);

  const createGroup = source('frontend/src/runtime/group/effect/create-group-from-rect.ts');
  assert.match(createGroup, /commitActiveLedgerMutation/);
  assert.match(createGroup, /createLedgerGroupAnnotation/);

  const keyboard = source('frontend/src/runtime/input/controller/handle-keyboard.ts');
  assert.match(keyboard, /confirmGroupDeletionController/);
  assert.match(keyboard, /confirmZoneDeletionController/);
  assert.match(keyboard, /confirmCardDeletionController/);
  assert.match(keyboard, /deleteGroupController/);
  assert.match(keyboard, /deleteZoneController/);
  assert.match(keyboard, /deleteCardController/);
  assert.match(keyboard, /deleteNoteController/);
  assert.match(keyboard, /isCardEditingKeyboardTarget/);
  assert.match(keyboard, /if \(editableTarget && key !== 'escape'\) return;/);
  assert.match(keyboard, /pasteSelectionController/);
  assert.match(keyboard, /openThreadPanel/);
  assert.match(keyboard, /closeThreadPanel/);
  assert.match(keyboard, /focusThreadDraft/);
  assert.match(keyboard, /cancelVoiceRecording/);
  assert.match(keyboard, /key === 'a'/);
  assert.match(keyboard, /key === 'x'/);
  assert.doesNotMatch(keyboard, /deleteSelectedZones/);
  assert.doesNotMatch(keyboard, /commitActiveLedgerMutation/);
  assert.doesNotMatch(keyboard, /showModal\?\.\(/);

  const actionClick = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  assert.match(actionClick, /action === 'toggle-rail'[\s\S]*toggleRail\(actionTarget\)/);
  assert.match(actionClick, /if \(event\.ctrlKey \|\| event\.metaKey\) \{[\s\S]*openLedgersCanvasInNewTab\(\);[\s\S]*return;/);
  assert.match(actionClick, /window\.open\('\/ledgers', '_blank', 'noopener'\)/);
  assert.match(actionClick, /applyRailCollapsedState\(collapsed, button\)/);
  assert.match(actionClick, /persistState\(\)/);
  assert.match(actionClick, /editRegionController/);
  assert.match(actionClick, /confirmGroupDeletionController/);
  assert.match(actionClick, /deleteGroupController/);
  assert.match(actionClick, /deleteZoneController/);
  assert.match(actionClick, /confirmCardDeletionController/);
  assert.match(actionClick, /deleteCardController/);
  assert.match(actionClick, /createNoteController/);
  assert.match(actionClick, /deleteNoteController/);
  assert.match(actionClick, /confirmNoteDeletionController/);
  assert.doesNotMatch(pointerDown, /beginLedgerCardDescriptionEdit/);
  assert.doesNotMatch(pointerDown, /event\.detail >= 2/);
  assert.match(actionClick, /action === 'thread-file-picker'/);
  assert.match(actionClick, /querySelector\('\.thread-file-input'\)/);
  assert.match(actionClick, /action === 'jump-thread-bottom'/);
  assert.match(actionClick, /pinThreadFeedToLastMessage\(\)/);
  assert.match(actionClick, /action === 'process-thread-codex'[\s\S]*codexModel: actionTarget\.dataset\.codexModel[\s\S]*codexEffort: actionTarget\.dataset\.codexEffort/);
  assert.doesNotMatch(actionClick, /pinThreadFeedToLastMessage\(\{ behavior: 'smooth' \}\)/);
  assert.doesNotMatch(actionClick, /beginZoneLabelEdit/);
  assert.doesNotMatch(actionClick, /deleteSelectedZones/);
  assert.doesNotMatch(actionClick, /commitActiveLedgerMutation/);

  const deleteZone = source('frontend/src/runtime/zone/effect/delete-selected-zones.ts');
  assert.match(deleteZone, /commitActiveLedgerMutation/);

  const deleteGroup = source('frontend/src/runtime/group/effect/delete-selected-groups.ts');
  assert.match(deleteGroup, /commitActiveLedgerMutation/);

  const labelEdit = source('frontend/src/runtime/zone/effect/begin-zone-label-edit.ts');
  assert.match(labelEdit, /commitActiveLedgerMutation/);

  const colorEdit = source('frontend/src/runtime/zone/effect/apply-zone-color-edit.ts');
  assert.match(colorEdit, /commitActiveLedgerMutation/);

  const noteCreate = source('frontend/src/runtime/thread/controller/create-note-controller.ts');
  assert.match(noteCreate, /sendActiveLedgerMutation/);

  const fileUpload = source('frontend/src/runtime/thread/controller/upload-thread-file-controller.ts');
  assert.match(fileUpload, /fetch\('\/api\/thread-file-upload'/);
  assert.match(fileUpload, /sendActiveLedgerMutation\(\{[\s\S]*action: 'append-note'/);
  assert.match(fileUpload, /appendOptimisticThreadNote/);
  assert.match(fileUpload, /patchOptimisticThreadNote/);

  const terminalComposer = source('frontend/src/runtime/voice/component/terminal-composer.ts');
  assert.match(terminalComposer, /class="thread-file-input" type="file" multiple hidden/);
  assert.match(terminalComposer, /data-action="thread-file-picker"/);

  const noteDelete = source('frontend/src/runtime/thread/controller/delete-note-controller.ts');
  assert.match(noteDelete, /commitActiveLedgerMutation/);

  const paste = source('frontend/src/runtime/clipboard/controller/paste-selection-controller.ts');
  assert.match(paste, /commitActiveLedgerMutation/);

  const serverMutation = source('frontend/src/runtime/ledger/effect/commit-active-ledger-mutation.ts');
  const serverLoad = source('frontend/src/runtime/ledger/effect/load-active-ledger-state.ts');
  const activeLedgerReconciliation = source('frontend/src/runtime/ledger/effect/reconcile-active-ledger-state.ts');
  assert.match(serverMutation, /fetch\(endpoint/);
  assert.match(serverMutation, /method: 'PATCH'/);
  assert.match(serverMutation, /reconcileActiveLedgerState\(\{/);
  assert.match(serverLoad, /reconcileActiveLedgerState\(\{/);
  assert.doesNotMatch(`${serverMutation}\n${serverLoad}`, /mergeLocalCanvasStateIntoLedger|mergeLocalThreadNotes|state\.activeLedger\s*=/);
  assert.match(activeLedgerReconciliation, /const withLocalNotes = sameLedger \? mergeLocalThreadNotes\(input\.ledger\) : input\.ledger/);
  assert.match(activeLedgerReconciliation, /mergeLocalCanvasStateIntoLedger\(withLocalNotes, localLedger, \{/);
  assert.match(activeLedgerReconciliation, /function replaceActiveLedger\(ledger: AnyRecord, ledgerStateId: string\): void \{[\s\S]*state\.activeLedger = ledger;[\s\S]*state\.activeLedgerId = ledgerStateId;[\s\S]*\}/);
  assert.match(activeLedgerReconciliation, /replaceActiveLedger\(reconciledLedger, input\.request\.ledgerStateId\)/);

  const runtimeSources = [
    'frontend/src/runtime/gesture/controller/handle-pointer-move.ts',
    'frontend/src/runtime/selection/effect/move-selected.ts',
    'frontend/src/runtime/card/effect/resize-selected-card.ts',
    'frontend/src/runtime/zone/effect/resize-selected-zone.ts'
  ].map(source).join('\n');
  assert.doesNotMatch(runtimeSources, /syncActiveLedger/);
  assert.doesNotMatch(runtimeSources, /commit-ledger-edit/);

  const ledgerCardMarkdown = source('frontend/src/runtime/ledger/component/render-ledger-card-markdown.ts');
  assert.match(ledgerCardMarkdown, /parseLedgerCardMarkdown/);

  const colorInput = source('frontend/src/runtime/input/controller/handle-region-color-input.ts');
  assert.match(colorInput, /editRegionColorController/);
  assert.doesNotMatch(colorInput, /applyZoneColorEdit/);

  const shellCss = source('frontend/assets/canvas/shell.css');
  assert.match(shellCss, /\.shell\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(shellCss, /\.shell\.has-inspector\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(shellCss, /\.rail\s*{[\s\S]*position:\s*fixed;[\s\S]*width:\s*132px/);
  assert.match(shellCss, /\.rail\s*{[^}]*background:\s*var\(--bg\)/);
  assert.match(shellCss, /\.rail\s*{[\s\S]*width 220ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  assert.match(shellCss, /\.shell\.rail-collapsed \.rail[\s\S]*width:\s*54px/);
  assert.match(shellCss, /\.shell\.rail-collapsed \.tool[\s\S]*width:\s*40px/);
  assert.match(shellCss, /\.tool span:last-child[\s\S]*max-width 180ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  assert.match(shellCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(shellCss, /grid-template-columns:\s*132px minmax\(0, 1fr\)/);
  assert.doesNotMatch(shellCss, /grid-template-columns:\s*54px minmax\(0, 1fr\)/);
  assert.doesNotMatch(shellCss, /transition:\s*grid-template-columns/);
  assert.doesNotMatch(shellCss, /\.rail\s*{[^}]*background:\s*rgba/);
  assert.doesNotMatch(shellCss, /\.rail:hover,\s*\.rail:focus-within\s*{[^}]*background:\s*rgba/);
  assert.match(shellCss, /\.panel\s*{[\s\S]*position:\s*fixed/);
  assert.match(shellCss, /transform:\s*translateX\(100%\)/);
  assert.doesNotMatch(shellCss, /clamp\(420px,\s*33vw,\s*620px\);[\s\S]*grid-template-columns/);

  const dialogsCss = source('frontend/assets/canvas/dialogs.css');
  assert.doesNotMatch(dialogsCss, /@media \(max-width: 900px\)[\s\S]*grid-template-columns:\s*56px minmax\(0, 1fr\)/);
  assert.match(dialogsCss, /@media \(max-width: 900px\)[\s\S]*\.rail\s*{[\s\S]*width:\s*56px/);
  assert.match(dialogsCss, /\.skill-modal::backdrop,[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.72\)/);
  assert.match(dialogsCss, /\.skill-results\s*{[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*overflow:\s*auto/);
  assert.match(dialogsCss, /\.skill-result\s*{[\s\S]*flex:\s*0 0 auto/);
  assert.match(dialogsCss, /\.process-skill-row\s*{[^}]*display:\s*grid;[^}]*flex:\s*0 0 auto;/s);
  assert.match(dialogsCss, /\.skill-modal\s*{[^}]*width:\s*min\(880px,[^}]*height:\s*80vh;/s);
  assert.match(dialogsCss, /\.pipeline-skill-picker-modal\[open\]\s*{[^}]*grid-template-rows:\s*auto auto auto minmax\(0, 1fr\) auto;/s);

  const stateSource = source('frontend/src/runtime/state.ts');
  const bootSurface = source('frontend/src/runtime/boot/controller/boot-surface.ts');
  const refreshRuntime = source('frontend/src/runtime/refresh/controller/refresh-runtime-state.ts');
  const persistState = source('frontend/src/runtime/persistence/effect/persist-state.ts');
  const scheduledPersistence = source('frontend/src/runtime/persistence/effect/schedule-viewport-persistence.ts');
  const railState = source('frontend/src/runtime/toolbox/effect/apply-rail-collapsed-state.ts');
  const specsLedger = source('.decision-os/specs.json');
  assert.match(stateSource, /railCollapsed:\s*false/);
  assert.match(bootSurface, /applyRailCollapsedState\(persisted\.railCollapsed === true\)/);
  assert.match(refreshRuntime, /applyRailCollapsedState\(persisted\.railCollapsed === true\)/);
  assert.match(persistState, /railCollapsed:\s*state\.railCollapsed/);
  assert.match(scheduledPersistence, /railCollapsed:\s*state\.railCollapsed/);
  assert.match(railState, /state\.railCollapsed = collapsed/);
  assert.match(railState, /classList\.toggle\('rail-collapsed', collapsed\)/);
  assert.match(specsLedger, /"title": "Sidebar collapse state persists locally"/);
  assert.doesNotMatch(specsLedger, /"id": "b4e9c2d7"[\s\S]{0,260}"comment"/);

  const openThreadPanel = source('frontend/src/runtime/thread/effect/open-thread-panel.ts');
  assert.doesNotMatch(openThreadPanel, /focusThreadDraft/);

  const renderThreadPanel = source('frontend/src/runtime/thread/effect/render-thread-panel.ts');
  const processThreadCodex = source('frontend/src/runtime/codex/controller/process-thread-codex-controller.ts');
  const threadCss = source('frontend/assets/canvas/thread.css');
  assert.match(renderThreadPanel, /renderThreadCodexSelect/);
  assert.match(renderThreadPanel, /button\.dataset\.codexModel = threadCodexModel/);
  assert.match(renderThreadPanel, /button\.dataset\.codexEffort = threadCodexEffort/);
  assert.match(processThreadCodex, /requestThreadCodexProcess\(\{ ledgerId, threadId, cardId, codexModel: input\.codexModel, codexEffort: input\.codexEffort \}\)/);
  assert.match(threadCss, /\.thread-codex-select\s*{[^}]*height:\s*28px;[^}]*font-family:\s*var\(--mono\);/s);

  const canvasLayerCss = source('frontend/assets/canvas/canvas-layer.css');
  const objectsCss = source('frontend/assets/canvas/objects.css');
  const cardDetailRenderer = source('frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts');
  const controlOverlay = source('frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts');
  assert.match(cardDetailRenderer, /row\.className = 'ledger-card-title-row'/);
  assert.match(cardDetailRenderer, /edit\.className = 'ledger-card-title-edit-button icon-button terminal-button terminal-button--compact'/);
  assert.match(cardDetailRenderer, /edit\.dataset\.action = 'edit-card-title'/);
  assert.match(cardDetailRenderer, /edit\.setAttribute\('aria-label', edit\.title\)/);
  assert.match(cardDetailRenderer, /createLedgerCardTitleRow\(card, id\)/);
  assert.match(controlOverlay, /className = 'canvas-control canvas-control--card'/);
  assert.match(controlOverlay, /edit\.dataset\.action = 'edit-card-title'/);
  assert.match(controlOverlay, /edit\.title = card\.dataset\.targetLedgerId \? 'Edit ledger name' : 'Edit card title'/);
  assert.match(controlOverlay, /editBody\.dataset\.action = 'edit-card-description'/);
  assert.match(controlOverlay, /editBody\.textContent = 'edit'/);
  assert.match(controlOverlay, /skill\.dataset\.action = 'open-card-process-modal'/);
  assert.match(controlOverlay, /skill\.title = 'Process card'/);
  assert.match(controlOverlay, /skill\.textContent = 'fx'/);
  assert.match(controlOverlay, /\? \[edit, renderLedgerCardDeleteButton\(cardId\)\]/);
  assert.match(controlOverlay, /\[skill, renderLedgerCardStatusButton\(cardId, persistedStatus, visibleStatus\), editBody, renderLedgerCardDeleteButton\(cardId\)\]/);
  assert.match(controlOverlay, /renderLedgerCardDeleteButton\(cardId\)/);
  assert.match(actionClick, /if \(action === 'edit-card-title'\)/);
  assert.match(actionClick, /beginLedgerCardTitleEdit\(card\)/);
  assert.match(actionClick, /if \(action === 'edit-card-description'\)/);
  assert.match(actionClick, /beginLedgerCardDescriptionEdit\(card\)/);
  assert.match(actionClick, /if \(action === 'open-card-process-modal'\)[\s\S]*await openCardProcessModal\(actionTarget\.dataset\.cardId \?\? ''\)/);
  assert.match(actionClick, /if \(action === 'open-pipelines-modal'\)[\s\S]*await openPipelinesModal\(\)/);

  const skillModal = source('frontend/src/runtime/codex/effect/render-skill-modal.ts');
  const processModal = source('frontend/src/runtime/codex/effect/render-card-process-modal.ts');
  const pipelineEditor = source('frontend/src/runtime/codex/effect/render-pipeline-editor-modal.ts');
  const skillLibraryEditor = source('frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts');
  const indexHtml = source('frontend/index.html');
  const codexRunOptions = source('frontend/src/runtime/codex/helper/codex-run-options.ts');
  const cardDetailSkillRunWidget = source('frontend/src/runtime/codex/component/render-card-skill-run-widget.ts');
  const cardDetailSkillRunPoller = source('frontend/src/runtime/codex/effect/poll-card-skill-run.ts');
  const ledgerContentEvents = source('frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts');
  const threadNotes = source('frontend/src/runtime/thread/effect/render-thread-notes.ts');
  const threadCodexLog = source('frontend/src/runtime/thread/effect/render-thread-codex-log.ts');
  assert.match(skillModal, /openCardProcessModal\(cardId, 'skills'\)/);
  assert.match(skillModal, /processModalState as skillModalState/);
  assert.match(processModal, /processModalState\.codexModel = skill\.effectiveCodexModel/);
  assert.match(processModal, /processModalState\.codexEffort = skill\.effectiveCodexEffort/);
  assert.match(processModal, /processCardSkillController\(\{[\s\S]*codexModel: codexModelExplicit \? codexModel : undefined,[\s\S]*codexEffort: codexEffortExplicit \? codexEffort : undefined/);
  assert.match(processModal, /tabs\.setAttribute\('role', 'tablist'\)/);
  assert.match(processModal, /tab\.setAttribute\('aria-controls', `process-panel-\$\{mode\}`\)/);
  assert.match(processModal, /generation !== processLoadGeneration \|\| cardId !== processModalState\.cardId/);
  assert.match(processModal, /requestCodexPipelineRun\(\{[\s\S]*sourceCardId: cardId/);
  assert.match(pipelineEditor, /inherited\.textContent = 'Use skill default'/);
  assert.match(pipelineEditor, /codexModel:\s*null/);
  assert.match(pipelineEditor, /codexEffort:\s*null/);
  assert.match(pipelineEditor, /openPipelineSkillPicker\(\{/);
  assert.doesNotMatch(pipelineEditor, /function renderSkillPicker\(/);
  assert.match(pipelineEditor, /export function removePipelineStep/);
  assert.match(skillLibraryEditor, /detail\.readOnlyReason \|\| 'This skill is read-only\.'/);
  assert.match(indexHtml, /class="skill-modal process-modal"/);
  assert.match(indexHtml, /class="pipelines-modal codex-admin-modal"/);
  assert.match(indexHtml, /class="pipeline-editor-modal codex-editor-modal"/);
  assert.match(indexHtml, /class="pipeline-skill-picker-modal skill-modal"/);
  assert.match(indexHtml, /class="skill-library-editor-modal codex-editor-modal"/);
  assert.match(indexHtml, /\.decision-os\/codex-pipelines\.json/);
  assert.match(indexHtml, /One pipeline can be active per workspace/);
  assert.match(indexHtml, /Restart clears every generated step card body and its <code>thread-card-\*<\/code> notes/);
  assert.match(codexRunOptions, /from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/schemas\/codex-pipeline-types\.js'/);
  assert.match(codexRunOptions, /export \{ codexEffortOptions, codexModelOptions \}/);
  assert.match(processModal, /className = 'skill-run-controls process-run-controls'/);
  assert.match(cardDetailRenderer, /renderCardSkillRunWidget\(card\)/);
  assert.match(cardDetailSkillRunWidget, /cardCodexRunId\(card\)/);
  assert.match(cardDetailSkillRunWidget, /body\.className = 'codex-run-body'/);
  assert.match(cardDetailSkillRunWidget, /cancel\.className = 'codex-run-cancel terminal-button terminal-button--stop terminal-button--compact'/);
  assert.match(cardDetailSkillRunWidget, /cancel\.dataset\.codexRunCancel = ''/);
  assert.match(cardDetailSkillRunWidget, /newSession\.dataset\.codexRunNewSession = ''/);
  assert.match(cardDetailSkillRunWidget, /newSession\.textContent = 'New session'/);
  assert.match(cardDetailSkillRunWidget, /const preference = cardCodexRunPreference\(card\)/);
  assert.match(cardDetailSkillRunWidget, /selectionMetric\('Model', 'codexRunModel', codexModelOptions, preference\.model\)/);
  assert.match(cardDetailSkillRunWidget, /selectionMetric\('Effort', 'codexRunEffort', codexEffortOptions, preference\.effort\)/);
  assert.match(cardDetailSkillRunWidget, /modelSelect\?\.addEventListener\('change', persistSelection\)/);
  assert.match(cardDetailSkillRunWidget, /effortSelect\?\.addEventListener\('change', persistSelection\)/);
  assert.match(cardDetailSkillRunWidget, /widget\.replaceChildren\(body, timer\)/);
  assert.match(cardDetailSkillRunPoller, /requestCardSkillRunStatus/);
  assert.match(cardDetailSkillRunPoller, /requestCardSkillRunCancel/);
  assert.match(cardDetailSkillRunPoller, /requestCardSkillRunContinue\(\{ ledgerId: poller\.ledgerId, cardId: poller\.cardId, runId: poller\.runId, traceId, codexModel, codexEffort, newSession \}\)/);
  assert.match(cardDetailSkillRunPoller, /function bindNewSessionButton\(poller: Poller\): void \{[\s\S]*void continueRun\(poller, true\);[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /function bindCancelButton\(poller: Poller\): void \{[\s\S]*void cancelRun\(poller\);[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /requestCardSkillRunCancel\(\{ ledgerId: poller\.ledgerId, cardId: poller\.cardId, runId: poller\.runId \}\)/);
  assert.match(cardDetailSkillRunPoller, /setCancelButtonVisible\(element: HTMLElement, visible: boolean\)/);
  assert.match(cardDetailSkillRunPoller, /requestAnimationFrame/);
  assert.match(cardDetailSkillRunPoller, /now - poller\.lastClockPaintMs >= 33/);
  assert.match(cardDetailSkillRunPoller, /terminalSummaries\.set\(key, summary\)/);
  assert.match(cardDetailSkillRunPoller, /export function resumeExternallyStartedCardSkillRun/);
  assert.match(cardDetailSkillRunPoller, /terminalSummaries\.delete\(key\)/);
  assert.match(cardDetailSkillRunPoller, /String\(minutes\)\.padStart\(2, '0'\)/);
  assert.match(cardDetailSkillRunPoller, /Turn Completed in \$\{durationLabel\(summary\.elapsedMs\)\}/);
  assert.match(cardDetailSkillRunPoller, /startedAtMs: number/);
  assert.match(cardDetailSkillRunPoller, /function removeTimer\(element: HTMLElement\): void \{[\s\S]*timer\.hidden = true;[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /if \(!summary\.ok\) \{[\s\S]*removeTimer\(poller\.element\);[\s\S]*\}/);
  assert.match(cardDetailSkillRunPoller, /if \(summary\.status === 'running'\) \{[\s\S]*showTimer\(element\);[\s\S]*setCancelButtonVisible\(element, true\);[\s\S]*setContinueButtonVisible\(element, false\);[\s\S]*\}/);
  assert.doesNotMatch(cardDetailSkillRunPoller, /setInterval/);
  assert.match(cardDetailSkillRunPoller, /schedulePoll\(poller, 0\)/);
  assert.match(cardDetailSkillRunPoller, /summary\.status === 'running'/);
  assert.match(cardDetailSkillRunPoller, /async function continueRun\(poller: Poller, newSession: boolean\): Promise<void> \{[\s\S]*paintExternallyStartedRun\(poller,[\s\S]*requestCardSkillRunContinue/);
  assert.match(cardDetailSkillRunPoller, /function paintExternallyStartedRun\(poller: Poller, latestLabel = 'Continuing session'\): void \{[\s\S]*poller\.startedAtMs = Date\.now\(\);[\s\S]*poller\.element\.dataset\.runStatus = 'running';/);
  assert.match(ledgerContentEvents, /resumeExternallyStartedCardSkillRun/);
  assert.match(ledgerContentEvents, /reason\.startsWith\('codex-'\)/);
  assert.match(ledgerContentEvents, /reason\.endsWith\('-started'\)/);
  assert.doesNotMatch(threadNotes, /codexNoteClass\(note\)|is-codex-run-event/);
  assert.match(threadCodexLog, /groupSequentialToolCalls\(events\)/);
  assert.match(threadCodexLog, /className = 'codex-tool-call'/);
  assert.doesNotMatch(controlOverlay, /selection\.cardIds/);
  assert.match(controlOverlay, /export function hideCanvasControlOverlay\(\): void \{[\s\S]*existingControlOverlay\(\)\?\.replaceChildren\(\);[\s\S]*\}/);
  assert.match(controlOverlay, /function controlsDisabled\(\): boolean \{[\s\S]*classList\?\.contains\('low-detail'\)/);
  assert.match(controlOverlay, /export function renderCanvasControlOverlay\(selection: Partial<SelectionState> = state\.selection\): void \{\s*if \(controlsDisabled\(\)\) \{[\s\S]*clearCanvasControlOverlay\(\);[\s\S]*return;/);
  assert.match(controlOverlay, /canvas\.addEventListener\('mouseover', \(event\) => \{\s*if \(controlsDisabled\(\)\) \{[\s\S]*clearCanvasControlOverlay\(\);[\s\S]*return;/);
  assert.match(controlOverlay, /if \(hoveredTarget\) byKey\.set\(targetKey\(hoveredTarget\), hoveredTarget\)/);
  assert.match(controlOverlay, /deleteButton\.dataset\.action = 'confirm-delete-group'/);
  assert.match(controlOverlay, /edit\.dataset\.zoneId = id/);
  assert.match(controlOverlay, /color\.dataset\.zoneId = id/);
  assert.match(canvasLayerCss, /\.canvas-control-overlay\s*{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/s);
  assert.match(canvasLayerCss, /\.canvas-control\s*{[^}]*position:\s*absolute;[^}]*opacity:\s*0;[^}]*transition:\s*opacity 140ms ease;/s);
  assert.match(canvasLayerCss, /\.canvas-control\.is-visible\s*{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/s);
  assert.match(canvasLayerCss, /\.canvas-control \.terminal-button,[\s\S]*transition:\s*none;/);
  assert.match(canvasLayerCss, /\.canvas-control \.ledger-card-edit-toggle\s*{[^}]*min-width:\s*38px;[^}]*text-transform:\s*uppercase;/s);
  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-title\s*{[^}]*padding:\s*4px 6px 0;/s);
  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-detail-layer\s*{[^}]*content-visibility:\s*hidden;/s);
  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.doesNotMatch(canvasLayerCss, /\.canvas\.low-detail \.ledger-card-status-toggle/);
  assert.match(objectsCss, /\.codex-run-widget\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(108px, max-content\);[^}]*height:\s*112px;[^}]*overflow:\s*hidden;/s);
  assert.match(objectsCss, /\.codex-run-metadata\s*{[^}]*flex-wrap:\s*nowrap;[^}]*overflow:\s*hidden;/s);
  assert.match(objectsCss, /\.codex-run-cancel,\s*\.codex-run-continue,\s*\.codex-run-new-session\s*{[^}]*min-height:\s*22px;[^}]*font-size:\s*9px;/s);
  assert.match(objectsCss, /\.codex-run-actions \.terminal-button\[hidden\]\s*{[^}]*display:\s*none;/s);
  assert.match(objectsCss, /\.codex-run-timer\s*{[^}]*align-self:\s*stretch;[^}]*font-size:\s*30px;[^}]*font-variant-numeric:\s*tabular-nums;/s);
  assert.match(objectsCss, /\.codex-run-widget\[data-run-status="running"\]\s*{[^}]*border-color:\s*color-mix\(in srgb, #55b8ff, transparent 28%\);/s);
  for (const status of ['complete', 'failed', 'cancelled', 'unknown']) {
    assert.doesNotMatch(objectsCss, new RegExp(`\\\\.codex-run-widget\\\\[data-run-status="${status}"\\\\]\\\\s*{[^}]*grid-template-columns:`));
    assert.doesNotMatch(objectsCss, new RegExp(`\\\\.codex-run-widget\\\\[data-run-status="${status}"\\\\]\\\\s*{[^}]*min-height:\\\\s*auto;`));
  }
  assert.match(objectsCss, /\.codex-run-widget:not\(\[data-run-status="running"\]\) \.codex-run-timer\s*{[^}]*display:\s*none;/s);
  assert.match(objectsCss, /\.ledger-card-title-row\s*{[^}]*display:\s*flex;[^}]*gap:\s*6px;[^}]*margin-bottom:\s*8px;/s);
  assert.match(objectsCss, /\.card \.ledger-card-title-edit-button\s*{[^}]*flex:\s*0 0 24px;[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s);
  assert.match(objectsCss, /\.card:hover \.ledger-card-title-edit-button,[\s\S]*pointer-events:\s*auto;/);
});
