import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildZoneAttributionCache } from '../../src/runtime/ledger/helper/zone-attribution-cache.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('ledger card zone color is resolved from ledger geometry before DOM measurement', () => {
  const specs = source('documentation/specs.json');
  const renderSurface = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const patchCard = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const colorRuntime = source('frontend/src/runtime/card/effect/render-card-zone-colors.ts');
  const cacheRuntime = source('frontend/src/runtime/ledger/helper/zone-attribution-cache.ts');
  const card = { id: 'card', x: 120, y: 80, w: 120, h: 80 };
  const annotations = [
    { id: 'small-overlap', x: 0, y: 0, width: 140, height: 90, color: '#38d9e8' },
    { id: 'owner', x: 100, y: 60, width: 260, height: 180, color: '#eab308' },
    { id: 'group', variant: 'group', x: 100, y: 60, width: 260, height: 180, color: '#ff0000' }
  ];

  assert.match(specs, /5f3a9d2e/);
  assert.equal(buildZoneAttributionCache({ cards: [card], annotations }, 'specs').cardById.card?.zoneColor, '#eab308');
  assert.match(renderSurface, /ensureZoneAttributionCache/);
  assert.match(renderSurface, /zoneAttribution\?\.cardById\?\.\[id\]/);
  assert.doesNotMatch(renderSurface, /resolveLedgerCardZone\(card, annotations\)/);
  assert.match(patchCard, /applyZoneAttributionToCardElement/);
  assert.match(cacheRuntime, /dataset\.cardZoneColor/);
  assert.match(cacheRuntime, /dataset\.cardZoneId/);
  assert.match(colorRuntime, /renderCardZoneColors/);
});
