import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRelationshipPorts } from '@frontend/runtime/relationship/helper/calculate-relationship-ports.js';

test('calculate-relationship-ports uses side title-band ports for aligned staged cards', () => {
  (globalThis as any).window = { location: { pathname: '/tasks-system' }, dispatchEvent() {}, __coreTelemetry: [] };
  const sourceRect = { left: 0, top: 0, right: 180, bottom: 420, width: 180, height: 420 };
  const targetRect = { left: 240, top: 20, right: 940, bottom: 1620, width: 700, height: 1600 };
  const ports = calculateRelationshipPorts(sourceRect, targetRect);

  assert.equal(ports.sourceSide, 'right');
  assert.equal(ports.targetSide, 'left');
  assert.deepEqual(ports.sourceNormal, { x: 1, y: 0 });
  assert.deepEqual(ports.targetNormal, { x: -1, y: 0 });
  assert.deepEqual(ports.sourcePort, { x: 180, y: 88 });
  assert.deepEqual(ports.targetPort, { x: 240, y: 108 });
});

test('calculate-relationship-ports avoids bottom-clamped target ports for vertically offset tall cards', () => {
  (globalThis as any).window = { location: { pathname: '/tasks-system' }, dispatchEvent() {}, __coreTelemetry: [] };
  const sourceRect = { left: 0, top: 0, right: 700, bottom: 1100, width: 700, height: 1100 };
  const targetRect = { left: 820, top: 300, right: 1520, bottom: 1300, width: 700, height: 1000 };
  const ports = calculateRelationshipPorts(sourceRect, targetRect);

  assert.equal(ports.sourceSide, 'right');
  assert.equal(ports.targetSide, 'left');
  assert.deepEqual(ports.sourcePort, { x: 700, y: 88 });
  assert.deepEqual(ports.targetPort, { x: 820, y: 388 });
});
