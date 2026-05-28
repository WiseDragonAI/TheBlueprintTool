import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCardYOverlap } from '../../../../src/runtime/card/helper/resolve-card-y-overlap.js';

test('resolve-card-y-overlap compacts all selected cards into one x-then-y sequence', () => {
  const arranged = resolveCardYOverlap([
    { id: 'a', left: 100, top: 100, width: 220, height: 180 },
    { id: 'b', left: 140, top: 700, width: 220, height: 150 },
    { id: 'c', left: 110, top: 560, width: 220, height: 130 }
  ]);

  assert.deepEqual(arranged.map(({ id, left, top }) => ({ id, left, top })).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'a', left: 100, top: 100 },
    { id: 'b', left: 140, top: 506 },
    { id: 'c', left: 110, top: 328 }
  ]);
});
