import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('browser inputs route ledger commands through runtime controllers before server effects', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /createZoneController/);
  assert.match(pointerUp, /createGroupController/);
  assert.match(pointerUp, /commitSelectedLedgerGeometry/);
  assert.doesNotMatch(pointerUp, /createZoneFromRect/);
  assert.doesNotMatch(pointerUp, /createGroupFromRect/);
  assert.doesNotMatch(pointerUp, /commitActiveLedgerMutation/);

  const createZone = source('frontend/src/runtime/zone/effect/create-zone-from-rect.ts');
  assert.match(createZone, /commitActiveLedgerMutation/);
  assert.match(createZone, /createLedgerZoneAnnotation/);

  const createGroup = source('frontend/src/runtime/group/effect/create-group-from-rect.ts');
  assert.match(createGroup, /commitActiveLedgerMutation/);
  assert.match(createGroup, /createLedgerGroupAnnotation/);

  const keyboard = source('frontend/src/runtime/input/controller/handle-keyboard.ts');
  assert.match(keyboard, /confirmZoneDeletionController/);
  assert.match(keyboard, /deleteZoneController/);
  assert.match(keyboard, /pasteSelectionController/);
  assert.doesNotMatch(keyboard, /deleteSelectedZones/);
  assert.doesNotMatch(keyboard, /commitActiveLedgerMutation/);
  assert.doesNotMatch(keyboard, /showModal\?\.\(/);

  const actionClick = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  assert.match(actionClick, /editRegionController/);
  assert.match(actionClick, /deleteZoneController/);
  assert.match(actionClick, /createNoteController/);
  assert.match(actionClick, /deleteNoteController/);
  assert.doesNotMatch(actionClick, /beginZoneLabelEdit/);
  assert.doesNotMatch(actionClick, /deleteSelectedZones/);
  assert.doesNotMatch(actionClick, /commitActiveLedgerMutation/);

  const deleteZone = source('frontend/src/runtime/zone/effect/delete-selected-zones.ts');
  assert.match(deleteZone, /commitActiveLedgerMutation/);

  const labelEdit = source('frontend/src/runtime/zone/effect/begin-zone-label-edit.ts');
  assert.match(labelEdit, /commitActiveLedgerMutation/);

  const colorEdit = source('frontend/src/runtime/zone/effect/apply-zone-color-edit.ts');
  assert.match(colorEdit, /commitActiveLedgerMutation/);

  const noteCreate = source('frontend/src/runtime/thread/controller/create-note-controller.ts');
  assert.match(noteCreate, /commitActiveLedgerMutation/);

  const noteDelete = source('frontend/src/runtime/thread/controller/delete-note-controller.ts');
  assert.match(noteDelete, /commitActiveLedgerMutation/);

  const paste = source('frontend/src/runtime/clipboard/controller/paste-selection-controller.ts');
  assert.match(paste, /commitActiveLedgerMutation/);

  const serverMutation = source('frontend/src/runtime/ledger/effect/commit-active-ledger-mutation.ts');
  assert.match(serverMutation, /fetch\(endpoint/);
  assert.match(serverMutation, /method: 'PATCH'/);
  assert.match(serverMutation, /state\.activeLedger = ledger/);

  const runtimeSources = [
    'frontend/src/runtime/gesture/controller/handle-pointer-move.ts',
    'frontend/src/runtime/selection/effect/move-selected.ts',
    'frontend/src/runtime/zone/effect/resize-selected-zone.ts'
  ].map(source).join('\n');
  assert.doesNotMatch(runtimeSources, /syncActiveLedger/);
  assert.doesNotMatch(runtimeSources, /commit-ledger-edit/);

  const ledgerCard = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  assert.match(ledgerCard, /parseLedgerCardMarkdown/);

  const colorInput = source('frontend/src/runtime/input/controller/handle-region-color-input.ts');
  assert.match(colorInput, /editRegionColorController/);
  assert.doesNotMatch(colorInput, /applyZoneColorEdit/);
});
