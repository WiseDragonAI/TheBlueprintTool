import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readableHorizontalRelationshipFlow,
  relationshipTitlePortBounds
} from '@frontend/runtime/relationship/helper/readable-horizontal-relationship-flow.js';

test('readable-horizontal-relationship-flow detects horizontally staged aligned cards', () => {
  const source = { left: 0, top: 0, right: 180, bottom: 420, width: 180, height: 420 };
  const target = { left: 240, top: 20, right: 940, bottom: 1620, width: 700, height: 1600 };

  assert.deepEqual(readableHorizontalRelationshipFlow(source, target), { sourceSide: 'right', targetSide: 'left' });
});

test('readable-horizontal-relationship-flow rejects vertical stacks and overlapping horizontal cards', () => {
  const source = { left: 0, top: 0, right: 180, bottom: 420, width: 180, height: 420 };
  const lowerTarget = { left: 40, top: 620, right: 740, bottom: 1620, width: 700, height: 1000 };
  const overlappingTarget = { left: 170, top: 20, right: 870, bottom: 1620, width: 700, height: 1600 };

  assert.equal(readableHorizontalRelationshipFlow(source, lowerTarget), null);
  assert.equal(readableHorizontalRelationshipFlow(source, overlappingTarget), null);
});

test('relationship-title-port-bounds stays near the card title band', () => {
  assert.deepEqual(relationshipTitlePortBounds({ left: 0, top: 1000, right: 700, bottom: 2600, width: 700, height: 1600 }), {
    min: 1048,
    max: 1128
  });
});
