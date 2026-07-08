import test from 'node:test';
import assert from 'node:assert/strict';

test('route-relationship-path uses Core-style cubic port-normal curves and endpoint labels', async () => {
  (globalThis as any).window = { location: { pathname: '/specs' }, dispatchEvent() {}, __coreTelemetry: [] };
  const { routeRelationshipPath } = await import('@frontend/runtime/relationship/helper/route-relationship-path.js');
  const sourceRect = { left: 0, top: 0, right: 100, bottom: 80, width: 100, height: 80 };
  const targetRect = { left: 260, top: 0, right: 360, bottom: 80, width: 100, height: 80 };
  const route = routeRelationshipPath({
    sourceRect,
    targetRect,
    sourcePort: { x: 100, y: 40 },
    targetPort: { x: 260, y: 40 },
    horizontal: true
  });

  assert.match(route.path, /^M 100 40 C /);
  assert.doesNotMatch(route.path, / L /);
  assert.deepEqual(route.startLabel, { x: 172, y: 32, anchor: 'start' });
  assert.deepEqual(route.endLabel, { x: 188, y: 32, anchor: 'end' });
});

test('route-relationship-path respects explicit sides and keeps tight direct handles inside the corridor', async () => {
  (globalThis as any).window = { location: { pathname: '/specs' }, dispatchEvent() {}, __coreTelemetry: [] };
  const { routeRelationshipPath } = await import('@frontend/runtime/relationship/helper/route-relationship-path.js');
  const route = routeRelationshipPath({
    sourceRect: { left: 0, top: 0, right: 180, bottom: 420, width: 180, height: 420 },
    targetRect: { left: 240, top: 20, right: 940, bottom: 1620, width: 700, height: 1600 },
    sourcePort: { x: 180, y: 88 },
    targetPort: { x: 240, y: 108 },
    horizontal: true,
    sourceSide: 'right',
    targetSide: 'left'
  });

  assert.match(route.path, /^M 180 88 C 207 88, 213 108, 240 108$/);
  assert.deepEqual(route.startLabel, { x: 252, y: 80, anchor: 'start' });
  assert.deepEqual(route.endLabel, { x: 168, y: 100, anchor: 'end' });
});
