/**
 * WHAT: Unit test for runtime helper choose-relationship-port-sides.
 * WHY: each helper function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRelationshipPortSides } from '@frontend/runtime/relationship/helper/choose-relationship-port-sides.js';

test('choose-relationship-port-sides selects the shortest outward-facing side pair', () => {
  const source = { left: 0, top: 0, right: 100, bottom: 80, width: 100, height: 80 };
  const rightTarget = { left: 260, top: 20, right: 360, bottom: 100, width: 100, height: 80 };
  const lowerTarget = { left: 10, top: 240, right: 110, bottom: 320, width: 100, height: 80 };
  assert.deepEqual(chooseRelationshipPortSides(source, rightTarget), { sourceSide: 'right', targetSide: 'left' });
  assert.deepEqual(chooseRelationshipPortSides(source, lowerTarget), { sourceSide: 'bottom', targetSide: 'top' });
});

test('choose-relationship-port-sides evaluates every target border instead of only the center vector', () => {
  const source = { left: 1120, top: -60, right: 1320, bottom: 140, width: 200, height: 200 };
  const target = { left: 1000, top: 0, right: 1400, bottom: 700, width: 400, height: 700 };

  assert.deepEqual(chooseRelationshipPortSides(source, target), { sourceSide: 'right', targetSide: 'right' });
});
