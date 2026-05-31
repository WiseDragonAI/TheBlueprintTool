/**
 * WHAT: Re-patches visible ledger cards once after crossing into inspection zoom.
 * WHY: Cards painted while zoomed out can stay backed by a soft compositor raster when zoomed in.
 */
import { canvas, content } from '../../dom.js';
import { patchLedgerCard } from '../../ledger/component/patch-ledger-card.js';
import { ensureZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { scheduleLedgerCardTabFrameSync } from './schedule-ledger-card-tab-frame-sync.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { viewportWorldBounds, visibleLedgerCards } from '../helper/visible-ledger-cards.js';

export const visibleCardQualityRefreshScaleThreshold = 1;
const visibleCardQualityRefreshDelayMs = 160;
const maxVisibleCardQualityRefreshCount = 16;

let visibleCardQualityRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearVisibleCardQualityRefreshTimer(): void {
  if (!visibleCardQualityRefreshTimer) return;
  clearTimeout(visibleCardQualityRefreshTimer);
  visibleCardQualityRefreshTimer = null;
}

function hasActiveEditor(card: HTMLElement): boolean {
  const active = document.activeElement as HTMLElement | null;
  return Boolean(
    active && card.contains(active)
      || card.querySelector('.ledger-card-description-editor, .ledger-card-title.editing, [contenteditable="true"]')
  );
}

function cardNode(cardId: string): HTMLElement | null {
  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
}

function runVisibleCardQualityRefresh(): void {
  visibleCardQualityRefreshTimer = null;
  if (Number(state.viewport.scale) < visibleCardQualityRefreshScaleThreshold) return;
  if (state.pointer) return;
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  if (cards.length === 0) return;

  const bounds = viewportWorldBounds(state.viewport, {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight
  });
  const visible = visibleLedgerCards(cards, bounds).slice(0, maxVisibleCardQualityRefreshCount);
  const zoneAttribution = ensureZoneAttributionCache('visible-card-quality-refresh');
  let refreshed = 0;

  for (const card of visible) {
    const id = String(card.id ?? '');
    if (!id) continue;
    const existing = cardNode(id);
    if (!existing || hasActiveEditor(existing)) continue;
    patchLedgerCard(card, existing, zoneAttribution?.cardById?.[id]);
    scheduleLedgerCardTabFrameSync(existing);
    refreshed += 1;
  }

  if (refreshed > 0) {
    renderSelectionState();
    renderCanvasControlOverlay();
  }
  state.visibleCardQualityRefreshCompleted = true;
  telemetry('visible-card-quality-refresh', { refreshed, candidates: visible.length, threshold: visibleCardQualityRefreshScaleThreshold });
}

function scheduleVisibleCardQualityRefresh(): void {
  clearVisibleCardQualityRefreshTimer();
  visibleCardQualityRefreshTimer = setTimeout(runVisibleCardQualityRefresh, visibleCardQualityRefreshDelayMs);
  telemetry('visible-card-quality-refresh-scheduled', { delayMs: visibleCardQualityRefreshDelayMs, threshold: visibleCardQualityRefreshScaleThreshold });
}

export function noteZoomForVisibleCardQualityRefresh(previousScale: number, nextScale: number): void {
  if (nextScale < visibleCardQualityRefreshScaleThreshold) {
    clearVisibleCardQualityRefreshTimer();
    state.visibleCardQualityRefreshAboveThreshold = false;
    state.visibleCardQualityRefreshCompleted = false;
    return;
  }

  if (previousScale < visibleCardQualityRefreshScaleThreshold && nextScale >= visibleCardQualityRefreshScaleThreshold) {
    state.visibleCardQualityRefreshAboveThreshold = true;
    state.visibleCardQualityRefreshCompleted = false;
  }

  if (state.visibleCardQualityRefreshAboveThreshold && !state.visibleCardQualityRefreshCompleted) {
    scheduleVisibleCardQualityRefresh();
  }
}
