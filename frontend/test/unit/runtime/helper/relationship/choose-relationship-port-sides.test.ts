/**
 * WHAT: Unit test for runtime helper choose-relationship-port-sides.
 * WHY: each helper function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRelationshipPortSides } from '@frontend/runtime/helper/relationship/choose-relationship-port-sides.js';

test('choose-relationship-port-sides selects the shortest outward-facing side pair', () => {
  const source = { left: 0, top: 0, right: 100, bottom: 80, width: 100, height: 80 };
  const rightTarget = { left: 260, top: 20, right: 360, bottom: 100, width: 100, height: 80 };
  const lowerTarget = { left: 10, top: 240, right: 110, bottom: 320, width: 100, height: 80 };
  assert.deepEqual(chooseRelationshipPortSides(source, rightTarget), { sourceSide: 'right', targetSide: 'left' });
  assert.deepEqual(chooseRelationshipPortSides(source, lowerTarget), { sourceSide: 'bottom', targetSide: 'top' });
});
