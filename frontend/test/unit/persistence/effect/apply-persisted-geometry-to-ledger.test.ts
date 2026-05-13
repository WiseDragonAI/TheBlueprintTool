import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPersistedGeometryToLedger } from '../../../../src/runtime/persistence/effect/apply-persisted-geometry-to-ledger.js';

test('apply-persisted-geometry-to-ledger overlays local ledger node geometry before render', () => {
  const ledger = {
    cards: [{ id: 'card-a', x: 0, y: 0, w: 220 }],
    annotations: [
      { id: 'zone-a', x: 0, y: 0, width: 180, height: 140 },
      { id: 'group-a', variant: 'group', x: 0, y: 0, width: 220, height: 160 }
    ]
  };
  applyPersistedGeometryToLedger(ledger, {
    cards: { 'card-a': { x: 10, y: 20, width: 310, height: 100 } },
    zones: { 'zone-a': { x: 30, y: 40, width: 360, height: 190 } },
    groups: { 'group-a': { x: 50, y: 60, width: 420, height: 240 } }
  });
  assert.deepEqual(ledger.cards[0], { id: 'card-a', x: 10, y: 20, w: 310 });
  assert.deepEqual(ledger.annotations[0], { id: 'zone-a', x: 30, y: 40, width: 360, height: 190 });
  assert.deepEqual(ledger.annotations[1], { id: 'group-a', variant: 'group', x: 50, y: 60, width: 420, height: 240 });
});
