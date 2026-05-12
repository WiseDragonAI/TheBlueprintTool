/**
 * WHAT: Unit test for runtime helper relationship-port-normal-for-side.
 * WHY: each helper function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipPortNormalForSide } from '@frontend/runtime/helper/relationship/relationship-port-normal-for-side.js';

test('relationship-port-normal-for-side maps each border side to an outward normal', () => {
  assert.deepEqual(relationshipPortNormalForSide('left'), { x: -1, y: 0 });
  assert.deepEqual(relationshipPortNormalForSide('right'), { x: 1, y: 0 });
  assert.deepEqual(relationshipPortNormalForSide('top'), { x: 0, y: -1 });
  assert.deepEqual(relationshipPortNormalForSide('bottom'), { x: 0, y: 1 });
});
