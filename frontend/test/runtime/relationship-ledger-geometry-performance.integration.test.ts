/**
 * WHAT: Runtime tests for ledger-backed relationship geometry performance.
 * WHY: Relationship routing must use ledger xywh instead of forcing DOM layout reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('ledger relationship routing uses active ledger geometry instead of card DOM measurement', () => {
  const renderer = source('frontend/src/runtime/relationship/effect/render-relationship-overlay.ts');
  const ports = source('frontend/src/runtime/relationship/helper/calculate-relationship-ports.ts');
  const slots = source('frontend/src/runtime/relationship/helper/resolve-relationship-port-slots.ts');

  assert.match(renderer, /activeLedgerCardRectMap/);
  assert.match(renderer, /activeLedgerCardMap/);
  assert.match(renderer, /ensureZoneAttributionCache/);
  assert.doesNotMatch(renderer, /getComputedStyle/);
  assert.doesNotMatch(ports, /HTMLElement/);
  assert.doesNotMatch(ports, /elementCanvasRect/);
  assert.doesNotMatch(ports, /offset(?:Left|Top|Width|Height)/);
  assert.doesNotMatch(slots, /document\.querySelector/);
  assert.doesNotMatch(slots, /elementCanvasRect/);
  assert.doesNotMatch(slots, /for \(const candidate of entries\)/);
});

test('selected ledger geometry commits from active ledger state instead of DOM snapshots', () => {
  const commit = source('frontend/src/runtime/ledger/effect/commit-selected-ledger-geometry.ts');
  const moveSelected = source('frontend/src/runtime/selection/effect/move-selected.ts');

  assert.match(commit, /selectedLedgerGeometryPayload/);
  assert.doesNotMatch(commit, /document\.querySelector/);
  assert.doesNotMatch(commit, /offset(?:Left|Top|Width|Height)/);
  assert.match(moveSelected, /patchLedgerCardGeometry/);
  assert.match(moveSelected, /patchLedgerAnnotationGeometry/);
});
