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

test('zoomed card images render through an untransformed visible-card media overlay', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const carouselWheel = source('frontend/src/runtime/gesture/helper/advance-carousel-from-wheel.ts');
  const transform = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const panTransform = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const renderLedgerSurface = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const media = source('frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts');
  const mediaComponent = source('frontend/src/runtime/ledger/component/render-ledger-card-media.ts');
  const canvasCss = source('frontend/assets/canvas/canvas-layer.css');
  const objectCss = source('frontend/assets/canvas/objects.css');

  assert.match(transform, /scheduleCanvasMediaOverlayRender\(\)/);
  assert.match(panTransform, /applyCanvasMediaOverlayPanTransform\(\)/);
  assert.match(renderLedgerSurface, /scheduleCanvasMediaOverlayRender\(\)/);
  assert.match(wheel, /scheduleViewportTransform\(\)/);
  assert.match(carouselWheel, /scheduleCanvasMediaOverlayRender\(\)/);
  assert.doesNotMatch(wheel, /noteZoomForVisibleCardQualityRefresh/);
  assert.match(mediaComponent, /track\.addEventListener\('scroll', scheduleCanvasMediaOverlayRender/);
  assert.match(media, /canvasMediaOverlayScaleThreshold = 1/);
  assert.match(media, /visibleLedgerCards\(cards, bounds\)\.slice\(0, maxCanvasMediaOverlayCards\)/);
  assert.match(media, /querySelectorAll\('\.ledger-card-media-shell'\)/);
  assert.match(media, /getBoundingClientRect\(\)/);
  assert.match(media, /lastRenderedViewport/);
  assert.match(media, /mirror\.style\.transform = transform/);
  assert.match(media, /setTimeout\(\(\) => \{[\s\S]*scheduleCanvasMediaOverlayRender\(\);[\s\S]*\}, 80\)/);
  assert.match(media, /className = 'canvas-media-overlay-image'/);
  assert.match(canvasCss, /\.canvas-media-overlay\s*{[^}]*position:\s*absolute;[^}]*z-index:\s*80;[^}]*pointer-events:\s*none;/s);
  assert.match(canvasCss, /\.canvas-media-overlay-image\s*{[^}]*position:\s*absolute;[^}]*object-fit:\s*contain;/s);
  assert.match(objectCss, /\.ledger-card-media-shell\[data-media-overlay-active="true"\] \.ledger-card-media-image\s*{[^}]*visibility:\s*hidden;/s);
  assert.doesNotMatch(objectCss, /data-quality-promoted/);
  assert.doesNotMatch(objectCss, /--media-quality-scale/);
});
