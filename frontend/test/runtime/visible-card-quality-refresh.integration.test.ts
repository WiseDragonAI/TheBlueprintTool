import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewportWorldBounds, visibleLedgerCards } from '../../src/runtime/card/helper/visible-ledger-cards.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('visible card quality refresh computes viewport card candidates from ledger geometry', () => {
  const bounds = viewportWorldBounds({ x: -200, y: -100, scale: 2 }, { width: 800, height: 600 });
  assert.deepEqual(bounds, { x: 100, y: 50, width: 400, height: 300 });
  const visible = visibleLedgerCards([
    { id: 'left', x: 0, y: 0, w: 80, h: 80 },
    { id: 'inside', x: 120, y: 80, w: 100, h: 100 },
    { id: 'edge', x: 490, y: 330, w: 40, h: 40 },
    { id: 'right', x: 540, y: 80, w: 100, h: 100 }
  ], bounds);
  assert.deepEqual(visible.map((card) => card.id), ['inside', 'edge']);
});

test('wheel zoom schedules one visible-card refresh only when crossing into scale one', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const refresh = source('frontend/src/runtime/card/effect/schedule-visible-card-quality-refresh.ts');

  assert.match(wheel, /const oldScale = state\.viewport\.scale/);
  assert.match(wheel, /noteZoomForVisibleCardQualityRefresh\(oldScale, state\.viewport\.scale\)/);
  assert.match(refresh, /visibleCardQualityRefreshScaleThreshold = 1/);
  assert.match(refresh, /previousScale < visibleCardQualityRefreshScaleThreshold && nextScale >= visibleCardQualityRefreshScaleThreshold/);
  assert.match(refresh, /state\.visibleCardQualityRefreshCompleted = true/);
  assert.match(refresh, /visibleLedgerCards\(cards, bounds\)\.slice\(0, maxVisibleCardQualityRefreshCount\)/);
  assert.match(refresh, /patchLedgerCard\(card, existing, zoneAttribution\?\.cardById\?\.\[id\]\)/);
  assert.doesNotMatch(refresh, /renderCanvasSurface/);
  assert.equal(refresh.includes("querySelectorAll('[data-ledger-card-media]"), false);
  assert.equal(refresh.includes('querySelectorAll("[data-ledger-card-media]'), false);
});
