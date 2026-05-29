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
  assert.match(wheel, /applyViewportTransform/);
  assert.match(wheel, /renderRelationshipOverlay/);
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
  assert.match(actionClick, /editRegionController/);
  assert.match(actionClick, /confirmGroupDeletionController/);
  assert.match(actionClick, /deleteGroupController/);
  assert.match(actionClick, /deleteZoneController/);
  assert.match(actionClick, /confirmCardDeletionController/);
  assert.match(actionClick, /deleteCardController/);
  assert.match(actionClick, /createNoteController/);
  assert.match(actionClick, /deleteNoteController/);
  assert.match(actionClick, /confirmNoteDeletionController/);
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

  const noteDelete = source('frontend/src/runtime/thread/controller/delete-note-controller.ts');
  assert.match(noteDelete, /commitActiveLedgerMutation/);

  const paste = source('frontend/src/runtime/clipboard/controller/paste-selection-controller.ts');
  assert.match(paste, /commitActiveLedgerMutation/);

  const serverMutation = source('frontend/src/runtime/ledger/effect/commit-active-ledger-mutation.ts');
  assert.match(serverMutation, /fetch\(endpoint/);
  assert.match(serverMutation, /method: 'PATCH'/);
  assert.match(serverMutation, /state\.activeLedger = mergeLocalThreadNotes\(ledger\)/);

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
  assert.match(shellCss, /grid-template-columns:\s*132px minmax\(0, 1fr\)/);
  assert.match(shellCss, /\.panel\s*{[\s\S]*position:\s*fixed/);
  assert.match(shellCss, /transform:\s*translateX\(100%\)/);
  assert.doesNotMatch(shellCss, /clamp\(420px,\s*33vw,\s*620px\);[\s\S]*grid-template-columns/);

  const openThreadPanel = source('frontend/src/runtime/thread/effect/open-thread-panel.ts');
  assert.doesNotMatch(openThreadPanel, /focusThreadDraft/);

  const objectsCss = source('frontend/assets/canvas/objects.css');
  assert.match(objectsCss, /\.card \.ledger-card-delete\.terminal-button\s*{[^}]*position:\s*absolute;[^}]*right:\s*6px;/s);
  assert.match(objectsCss, /\.group-zone \.ledger-group-delete\.terminal-button\s*{[^}]*position:\s*absolute;[^}]*right:\s*6px;/s);

  const canvasLayerCss = source('frontend/assets/canvas/canvas-layer.css');
  assert.match(canvasLayerCss, /\.canvas\.low-detail \.ledger-card-title\s*{[^}]*padding:\s*calc\(4px \* var\(--viewport-scale, 1\)\) calc\(6px \* var\(--viewport-scale, 1\)\) 0;/s);
  assert.match(canvasLayerCss, /\.canvas\.low-detail \.ledger-card-labels,[\s\S]{0,220}display:\s*none;/);
  assert.match(canvasLayerCss, /\.canvas\.low-detail \.card\[data-card-work-status="todo"\] \.card-status-indicator\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.match(canvasLayerCss, /\.canvas\.low-detail \.hash,[\s\S]{0,260}display:\s*none;/);
});
