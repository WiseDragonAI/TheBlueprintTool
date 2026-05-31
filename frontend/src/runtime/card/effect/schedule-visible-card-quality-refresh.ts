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
const maxVisibleCardMediaQualityScale = 2.5;

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

function clearMediaQualityPromotion(shell: HTMLElement): void {
  delete shell.dataset.qualityPromoted;
  shell.style.removeProperty('--media-quality-scale');
  shell.style.removeProperty('--media-quality-inverse-scale');
}

function naturalMediaQualityScale(shell: HTMLElement, image: HTMLImageElement, scale: number): number {
  const shellWidth = Math.max(1, shell.offsetWidth);
  const shellHeight = Math.max(1, shell.offsetHeight);
  if (!image.naturalWidth || !image.naturalHeight) return Math.min(scale, 2);
  const naturalScale = Math.min(image.naturalWidth / shellWidth, image.naturalHeight / shellHeight);
  return Math.min(scale, maxVisibleCardMediaQualityScale, Math.max(1, naturalScale));
}

function promoteMediaShellQuality(shell: HTMLElement, scale: number): void {
  if (scale <= visibleCardQualityRefreshScaleThreshold) {
    clearMediaQualityPromotion(shell);
    return;
  }

  const image = shell.querySelector('img') as HTMLImageElement | null;
  if (!image) return;
  const qualityScale = naturalMediaQualityScale(shell, image, scale);
  if (qualityScale <= 1.01) {
    clearMediaQualityPromotion(shell);
    return;
  }

  shell.dataset.qualityPromoted = 'true';
  shell.style.setProperty('--media-quality-scale', String(qualityScale));
  shell.style.setProperty('--media-quality-inverse-scale', String(1 / qualityScale));

  if (!image.complete && shell.dataset.qualityLoadBound !== 'true') {
    shell.dataset.qualityLoadBound = 'true';
    image.addEventListener('load', () => {
      delete shell.dataset.qualityLoadBound;
      promoteMediaShellQuality(shell, Number(state.viewport.scale));
    }, { once: true });
  }
}

function promoteCardMediaQuality(card: HTMLElement, scale: number): void {
  for (const shell of card.querySelectorAll('.ledger-card-media-shell, .ledger-card-inline-image-frame')) {
    promoteMediaShellQuality(shell as HTMLElement, scale);
  }
}

function clearPromotedMediaQuality(root: ParentNode = document): void {
  for (const shell of root.querySelectorAll('.ledger-card-media-shell[data-quality-promoted="true"], .ledger-card-inline-image-frame[data-quality-promoted="true"]')) {
    clearMediaQualityPromotion(shell as HTMLElement);
  }
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
  const scale = Number(state.viewport.scale);
  let refreshed = 0;

  clearPromotedMediaQuality(content);

  for (const card of visible) {
    const id = String(card.id ?? '');
    if (!id) continue;
    const existing = cardNode(id);
    if (!existing || hasActiveEditor(existing)) continue;
    patchLedgerCard(card, existing, zoneAttribution?.cardById?.[id]);
    promoteCardMediaQuality(existing, scale);
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
    clearPromotedMediaQuality(content);
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
