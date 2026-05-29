import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('relationship labels inherit endpoint colors without class overrides', () => {
  const specs = source('documentation/specs.json');
  const css = source('frontend/assets/canvas/objects.css');
  const runtime = source('frontend/src/runtime/relationship/effect/render-relationship-overlay.ts');
  const colorRuntime = source('frontend/src/runtime/card/effect/render-card-zone-colors.ts');

  assert.match(specs, /0f6a3e91/);
  assert.match(specs, /2f9a6c8d/);
  assert.match(colorRuntime, /--zone-readable-color/);
  assert.match(css, /--zone-label-color:\s*var\(--zone-readable-color,/);
  assert.match(runtime, /relationshipLabelColor\(source\)/);
  assert.match(runtime, /relationshipLabelColor\(target\)/);
  assert.match(runtime, /--relationship-label-color/);
  assert.match(runtime, /--card-readable-color/);
  assert.match(css, /\.relationships text\s*{[^}]*fill:\s*var\(--relationship-label-color,/s);
  assert.doesNotMatch(css, /\.relationships text\.is-source\s*{[^}]*fill:\s*var\(--accent\)/s);
});

test('relationship endpoint labels are routed outside expanded card boxes', async () => {
  (globalThis as any).window = { location: { pathname: '/specs' }, dispatchEvent() {}, __coreTelemetry: [] };
  const specs = source('documentation/specs.json');
  const runtime = source('frontend/src/runtime/relationship/helper/route-relationship-path.ts');
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

  assert.match(specs, /6c2d8e0a/);
  assert.match(runtime, /RELATIONSHIP_LABEL_SAFETY_MARGIN = 72/);
  assert.equal(route.startLabel.x, sourceRect.right + 72);
  assert.equal(route.endLabel.x, targetRect.left - 72);
});
