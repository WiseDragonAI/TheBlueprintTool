import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewportWorldBounds, visibleLedgerCards } from '../../src/runtime/card/helper/visible-ledger-cards.js';
import { visibleCardQualityRefreshBucketForScale } from '../../src/runtime/card/effect/schedule-visible-card-quality-refresh.js';

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

test('visible card quality refresh buckets inspection zoom levels', () => {
  assert.equal(visibleCardQualityRefreshBucketForScale(0.99), 0);
  assert.equal(visibleCardQualityRefreshBucketForScale(1), 1);
  assert.equal(visibleCardQualityRefreshBucketForScale(1.24), 1);
  assert.equal(visibleCardQualityRefreshBucketForScale(1.25), 1.25);
  assert.equal(visibleCardQualityRefreshBucketForScale(1.51), 1.5);
  assert.equal(visibleCardQualityRefreshBucketForScale(1.76), 1.75);
  assert.equal(visibleCardQualityRefreshBucketForScale(2.2), 2);
});

test('wheel zoom schedules visible-card refreshes when crossing quality buckets', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const refresh = source('frontend/src/runtime/card/effect/schedule-visible-card-quality-refresh.ts');
  const css = source('frontend/assets/canvas/objects.css');

  assert.match(wheel, /const oldScale = state\.viewport\.scale/);
  assert.match(wheel, /noteZoomForVisibleCardQualityRefresh\(oldScale, state\.viewport\.scale\)/);
  assert.match(refresh, /visibleCardQualityRefreshScaleThreshold = 1/);
  assert.match(refresh, /visibleCardQualityRefreshScaleThresholds = \[1, 1\.25, 1\.5, 1\.75, 2\]/);
  assert.match(refresh, /previousBucket = visibleCardQualityRefreshBucketForScale\(previousScale\)/);
  assert.match(refresh, /nextBucket = visibleCardQualityRefreshBucketForScale\(nextScale\)/);
  assert.match(refresh, /if \(nextBucket > previousBucket\)/);
  assert.match(refresh, /state\.visibleCardQualityRefreshCompleted = true/);
  assert.match(refresh, /state\.visibleCardQualityRefreshCompletedBucket = visibleCardQualityRefreshBucketForScale\(scale\)/);
  assert.match(refresh, /visibleLedgerCards\(cards, bounds\)\.slice\(0, maxVisibleCardQualityRefreshCount\)/);
  assert.match(refresh, /patchLedgerCard\(card, existing, zoneAttribution\?\.cardById\?\.\[id\]\)/);
  assert.match(refresh, /promoteCardMediaQuality\(existing, scale\)/);
  assert.match(refresh, /clearPromotedMediaQuality\(content\)/);
  assert.match(refresh, /querySelectorAll\('\.ledger-card-media-shell, \.ledger-card-inline-image-frame'\)/);
  assert.match(refresh, /maxVisibleCardMediaQualityScale = 2\.5/);
  assert.match(css, /\.ledger-card-media-shell\[data-quality-promoted="true"\] \.ledger-card-media-image/s);
  assert.match(css, /--media-quality-scale/);
  assert.match(css, /--media-quality-inverse-scale/);
  assert.match(css, /position:\s*absolute;[^}]*top:\s*0;[^}]*left:\s*0;[^}]*transform:\s*scale\(var\(--media-quality-inverse-scale, 1\)\);[^}]*transform-origin:\s*left top;/s);
  assert.doesNotMatch(refresh, /renderCanvasSurface/);
  assert.equal(refresh.includes("querySelectorAll('[data-ledger-card-media]"), false);
  assert.equal(refresh.includes('querySelectorAll("[data-ledger-card-media]'), false);
});
