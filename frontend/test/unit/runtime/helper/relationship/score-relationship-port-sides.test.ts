/**
 * WHAT: Unit test for runtime helper score-relationship-port-sides.
 * WHY: each helper function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRelationshipPortSides } from '@frontend/runtime/helper/relationship/score-relationship-port-sides.js';

const source = { left: 0, top: 0, right: 100, bottom: 80, width: 100, height: 80 };
const target = { left: 260, top: 0, right: 360, bottom: 80, width: 100, height: 80 };

test('score-relationship-port-sides prefers outward opposite horizontal sides for horizontal targets', () => {
  const outward = scoreRelationshipPortSides(source, target, 'right', 'left');
  const backward = scoreRelationshipPortSides(source, target, 'left', 'right');
  const mixedAxis = scoreRelationshipPortSides(source, target, 'top', 'left');
  assert.ok(outward < backward);
  assert.ok(outward < mixedAxis);
});
