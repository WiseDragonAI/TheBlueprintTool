import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('zone and group browser inputs route commands through runtime controllers before effects', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /createZoneController/);
  assert.match(pointerUp, /createGroupController/);
  assert.doesNotMatch(pointerUp, /createZoneFromRect/);
  assert.doesNotMatch(pointerUp, /createGroupFromRect/);

  const createZone = source('frontend/src/runtime/zone/effect/create-zone-from-rect.ts');
  assert.match(createZone, /addActiveLedgerZone/);
  assert.match(createZone, /createLedgerZoneAnnotation/);

  const keyboard = source('frontend/src/runtime/input/controller/handle-keyboard.ts');
  assert.match(keyboard, /confirmZoneDeletionController/);
  assert.match(keyboard, /deleteZoneController/);
  assert.doesNotMatch(keyboard, /deleteSelectedZones/);
  assert.doesNotMatch(keyboard, /showModal\?\.\(/);

  const actionClick = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  assert.match(actionClick, /editRegionController/);
  assert.match(actionClick, /deleteZoneController/);
  assert.doesNotMatch(actionClick, /beginZoneLabelEdit/);
  assert.doesNotMatch(actionClick, /deleteSelectedZones/);

  const deleteZone = source('frontend/src/runtime/zone/effect/delete-selected-zones.ts');
  assert.match(deleteZone, /removeActiveLedgerZones/);

  const colorInput = source('frontend/src/runtime/input/controller/handle-region-color-input.ts');
  assert.match(colorInput, /editRegionColorController/);
  assert.doesNotMatch(colorInput, /applyZoneColorEdit/);
});
