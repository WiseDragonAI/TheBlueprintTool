import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRelationshipRouteCandidate } from '@frontend/runtime/relationship/helper/choose-relationship-route-candidate.js';
import { relationshipTitlePortBounds } from '@frontend/runtime/relationship/helper/relationship-port-bounds.js';

test('choose-relationship-route-candidate scores aligned stage cards to side title-band ports', () => {
  const source = { left: 0, top: 0, right: 180, bottom: 420, width: 180, height: 420 };
  const target = { left: 240, top: 20, right: 940, bottom: 1620, width: 700, height: 1600 };
  const candidate = chooseRelationshipRouteCandidate(source, target);

  assert.equal(candidate.sourceSide, 'right');
  assert.equal(candidate.targetSide, 'left');
  assert.equal(candidate.sourceOffsetPolicy, 'title-band');
  assert.equal(candidate.targetOffsetPolicy, 'title-band');
  assert.deepEqual(candidate.sourcePort, { x: 180, y: 88 });
  assert.deepEqual(candidate.targetPort, { x: 240, y: 108 });
});

test('choose-relationship-route-candidate scores vertically offset tall cards to side projected ports', () => {
  const source = { left: 0, top: 0, right: 700, bottom: 1100, width: 700, height: 1100 };
  const target = { left: 820, top: 300, right: 1520, bottom: 1300, width: 700, height: 1000 };
  const candidate = chooseRelationshipRouteCandidate(source, target);

  assert.equal(candidate.sourceSide, 'right');
  assert.equal(candidate.targetSide, 'left');
  assert.equal(candidate.sourceOffsetPolicy, 'projected');
  assert.equal(candidate.targetOffsetPolicy, 'projected');
  assert.deepEqual(candidate.sourcePort, { x: 700, y: 656.7073170731708 });
  assert.deepEqual(candidate.targetPort, { x: 820, y: 693.2926829268292 });
});

test('relationship-title-port-bounds stays near the card title band', () => {
  assert.deepEqual(relationshipTitlePortBounds({ left: 0, top: 1000, right: 700, bottom: 2600, width: 700, height: 1600 }), {
    min: 1048,
    max: 1128
  });
});
