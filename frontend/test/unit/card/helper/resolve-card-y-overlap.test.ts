import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCardYOverlap } from '../../../../src/runtime/card/helper/resolve-card-y-overlap.js';

test('resolve-card-y-overlap compacts selected cards inside each visual column', () => {
  const arranged = resolveCardYOverlap([
    { id: 'a', left: 100, top: 100, width: 220, height: 180 },
    { id: 'b', left: 140, top: 700, width: 220, height: 150 },
    { id: 'c', left: 110, top: 560, width: 220, height: 130 },
    { id: 'd', left: 420, top: 120, width: 220, height: 160 },
    { id: 'e', left: 430, top: 190, width: 220, height: 140 }
  ]);

  assert.deepEqual(arranged.map(({ id, left, top }) => ({ id, left, top })).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'a', left: 100, top: 100 },
    { id: 'b', left: 140, top: 506 },
    { id: 'c', left: 110, top: 328 },
    { id: 'd', left: 420, top: 120 },
    { id: 'e', left: 430, top: 328 }
  ]);
});

test('resolve-card-y-overlap keeps adjacent non-overlapping columns aligned', () => {
  const arranged = resolveCardYOverlap([
    { id: 'a1', left: 32, top: 52, width: 132, height: 90 },
    { id: 'a2', left: 32, top: 152, width: 132, height: 180 },
    { id: 'b1', left: 178, top: 52, width: 132, height: 260 },
    { id: 'c1', left: 324, top: 52, width: 132, height: 380 }
  ]);

  assert.deepEqual(arranged.map(({ id, top }) => ({ id, top })).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'a1', top: 52 },
    { id: 'a2', top: 190 },
    { id: 'b1', top: 52 },
    { id: 'c1', top: 52 }
  ]);
});
