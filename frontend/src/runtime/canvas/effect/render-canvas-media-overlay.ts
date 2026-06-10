/**
 * WHAT: Promotes zoomed-in card media into an untransformed canvas overlay.
 * WHY: The actual carousel must stay the owner of images and controls while avoiding a soft transformed raster.
 */
import { canvas, content, mediaOverlay as initialMediaOverlay } from '../../dom.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { viewportWorldBounds, visibleLedgerCards } from '../../card/helper/visible-ledger-cards.js';
import {
  captureLedgerCardMediaHandoffState,
  isLedgerCardMediaResizePersistenceSuppressed,
  restoreLedgerCardMediaHandoffState,
  suppressLedgerCardMediaResizePersistence,
  type LedgerCardMediaHandoffState
} from '../../ledger/helper/sync-ledger-card-media-layout.js';

export const canvasMediaOverlayScaleThreshold = 1;
const maxCanvasMediaOverlayCards = 16;
const promotedStyleProperties = ['position', 'left', 'top', 'width', 'height', 'maxWidth', 'margin', 'zIndex', 'transform', 'boxSizing'] as const;

type PromotedStyleProperty = typeof promotedStyleProperties[number];

type MediaPromotion = {
  key: string;
  shell: HTMLElement;
  placeholder: HTMLElement;
  originalLocalWidth: number;
  originalCardZoneColor: string;
  originalStyle: Record<PromotedStyleProperty, string>;
  pendingHandoffState?: LedgerCardMediaHandoffState;
  resizeObserver?: ResizeObserver;
};

type MediaOverlayDemotionOptions = {
  reconcilePromotedGeometry?: boolean;
};

let scheduled = false;
let mediaOverlaySuspended = false;
let panReconcileTimer: ReturnType<typeof setTimeout> | undefined;
let lastRenderedViewport: { x: number; y: number; scale: number } | null = null;
const promotedMediaShells = new Map<string, MediaPromotion>();
const promotedShellKeys = new WeakMap<HTMLElement, string>();

function resolveMediaOverlay(): HTMLElement | null {
  if (initialMediaOverlay?.isConnected) return initialMediaOverlay;
  if (!canvas || typeof canvas.querySelector !== 'function') return null;
  const existing = canvas.querySelector(':scope > .canvas-media-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.className = 'canvas-media-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const controlOverlay = canvas.querySelector(':scope > .canvas-control-overlay');
  canvas.insertBefore(overlay, controlOverlay ?? null);
  return overlay;
}

function readPromotedStyle(element: HTMLElement): Record<PromotedStyleProperty, string> {
  return promotedStyleProperties.reduce((styles, property) => {
    styles[property] = element.style[property];
    return styles;
  }, {} as Record<PromotedStyleProperty, string>);
}

function restorePromotedStyle(element: HTMLElement, styles: Record<PromotedStyleProperty, string>): void {
  for (const property of promotedStyleProperties) {
    element.style[property] = styles[property];
  }
}

function mediaSlotNodes(cardElement: HTMLElement): HTMLElement[] {
  return Array.from(cardElement.querySelectorAll(
    '.ledger-card-media-shell, .ledger-card-media-placeholder[data-media-promotion-key]'
  )) as HTMLElement[];
}

function shellForSlot(node: HTMLElement): HTMLElement | null {
  if (!node.classList.contains('ledger-card-media-placeholder')) return node;
  const promotion = promotedMediaShells.get(node.dataset.mediaPromotionKey ?? '');
  return promotion?.shell?.isConnected ? promotion.shell : null;
}

function aspectRatioForShell(shell: HTMLElement): string {
  const configured = shell.style.getPropertyValue('--ledger-card-media-aspect-ratio').trim();
  if (configured) return configured;
  const width = Math.max(1, shell.offsetWidth);
  const height = Math.max(1, shell.offsetHeight);
  return `${width} / ${height}`;
}

function setPlaceholderMetrics(placeholder: HTMLElement, width: number, aspectRatio: string): boolean {
  const nextWidth = String(Math.max(1, Math.round(width)));
  const nextAspectRatio = aspectRatio || '4 / 3';
  const changed = placeholder.dataset.mediaPlaceholderWidth !== nextWidth
    || placeholder.dataset.mediaPlaceholderAspectRatio !== nextAspectRatio;
  if (!changed) return false;
  placeholder.dataset.mediaPlaceholderWidth = nextWidth;
  placeholder.dataset.mediaPlaceholderAspectRatio = nextAspectRatio;
  placeholder.style.width = `${nextWidth}px`;
  placeholder.style.setProperty('--ledger-card-media-aspect-ratio', nextAspectRatio);
  return true;
}

function placeholderLocalWidth(placeholder: HTMLElement): number {
  const configured = Number(placeholder.dataset.mediaPlaceholderWidth);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return Math.max(1, Math.round(placeholder.offsetWidth || 1));
}

function localMediaMaxWidth(promotion: MediaPromotion): number {
  const parentWidth = promotion.placeholder.parentElement?.clientWidth ?? 0;
  return Math.max(1, parentWidth || promotion.placeholder.offsetWidth || promotion.shell.offsetWidth || 1);
}

function promotionScale(promotion: MediaPromotion): number {
  const scale = Number(promotion.shell.dataset.mediaPromotionScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function clampPromotedShellWidth(promotion: MediaPromotion): number {
  const scale = promotionScale(promotion);
  const maxLocalWidth = localMediaMaxWidth(promotion);
  const maxPromotedWidth = Math.max(1, Math.round(maxLocalWidth * scale));
  if (promotion.shell.offsetWidth > maxPromotedWidth) {
    const handoffState = captureLedgerCardMediaHandoffState(promotion.shell);
    promotion.shell.style.width = `${maxPromotedWidth}px`;
    restoreLedgerCardMediaHandoffState(promotion.shell, handoffState);
  }
  promotion.shell.style.maxWidth = `${maxPromotedWidth}px`;
  return maxLocalWidth;
}

function syncPlaceholderFromPromotedShell(promotion: MediaPromotion): boolean {
  const dimensionScale = promotionScale(promotion);
  const maxWidth = clampPromotedShellWidth(promotion);
  const width = Math.min(maxWidth, promotion.shell.offsetWidth / dimensionScale);
  return setPlaceholderMetrics(promotion.placeholder, width, aspectRatioForShell(promotion.shell));
}

function withHiddenMediaHandoff(shell: HTMLElement, callback: () => void): void {
  const visibility = shell.style.visibility;
  suppressLedgerCardMediaResizePersistence(shell);
  shell.style.visibility = 'hidden';
  try {
    callback();
  } finally {
    shell.style.visibility = visibility;
    suppressLedgerCardMediaResizePersistence(shell);
  }
}

function demoteMediaShell(key: string, options: MediaOverlayDemotionOptions = {}): void {
  const promotion = promotedMediaShells.get(key);
  if (!promotion) return;
  const reconcilePromotedGeometry = options.reconcilePromotedGeometry ?? true;
  if (reconcilePromotedGeometry && !isLedgerCardMediaResizePersistenceSuppressed(promotion.shell)) {
    syncPlaceholderFromPromotedShell(promotion);
  }
  const handoffState = captureLedgerCardMediaHandoffState(promotion.shell);
  const transferredLocalWidth = Math.round(placeholderLocalWidth(promotion.placeholder));
  const shouldTransferLocalWidth = Math.abs(transferredLocalWidth - promotion.originalLocalWidth) >= 1;
  promotion.resizeObserver?.disconnect();
  withHiddenMediaHandoff(promotion.shell, () => {
    delete promotion.shell.dataset.mediaPromoted;
    delete promotion.shell.dataset.mediaPromotionKey;
    delete promotion.shell.dataset.mediaPromotionScale;
    delete promotion.shell.dataset.mediaLocalMaxWidth;
    promotedShellKeys.delete(promotion.shell);
    restorePromotedStyle(promotion.shell, promotion.originalStyle);
    if (promotion.originalCardZoneColor) promotion.shell.style.setProperty('--card-zone-color', promotion.originalCardZoneColor);
    else promotion.shell.style.removeProperty('--card-zone-color');
    if (promotion.placeholder.isConnected) {
      promotion.placeholder.replaceWith(promotion.shell);
      if (shouldTransferLocalWidth) promotion.shell.style.width = `${transferredLocalWidth}px`;
      restoreLedgerCardMediaHandoffState(promotion.shell, handoffState);
    } else {
      promotion.shell.remove();
    }
  });
  promotedMediaShells.delete(key);
}

function clearMediaOverlay(overlay: HTMLElement | null = resolveMediaOverlay(), options: MediaOverlayDemotionOptions = {}): void {
  for (const key of Array.from(promotedMediaShells.keys())) demoteMediaShell(key, options);
  overlay?.replaceChildren();
  if (overlay) overlay.style.transform = '';
  lastRenderedViewport = null;
}

export function clearCanvasMediaOverlay(options: MediaOverlayDemotionOptions = {}): void {
  clearMediaOverlay(undefined, options);
}

export function suspendCanvasMediaOverlay(): void {
  mediaOverlaySuspended = true;
  clearMediaOverlay(undefined, { reconcilePromotedGeometry: false });
}

export function resumeCanvasMediaOverlay(): void {
  mediaOverlaySuspended = false;
  scheduleCanvasMediaOverlayRender();
}

function cardNode(cardId: string): HTMLElement | null {
  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
}

function rectIntersectsCanvas(rect: DOMRect, canvasRect: DOMRect): boolean {
  return rect.right > canvasRect.left
    && rect.left < canvasRect.right
    && rect.bottom > canvasRect.top
    && rect.top < canvasRect.bottom
    && rect.width > 0
    && rect.height > 0;
}

function cardZoneColor(cardElement: HTMLElement): string {
  return cardElement.dataset.cardZoneColor
    || cardElement.style.getPropertyValue('--card-zone-color').trim()
    || getComputedStyle(cardElement).getPropertyValue('--card-zone-color').trim();
}

function createPlaceholder(shell: HTMLElement, key: string): HTMLElement {
  const placeholder = document.createElement('div');
  placeholder.className = 'ledger-card-media-placeholder';
  placeholder.dataset.mediaPromotionKey = key;
  setPlaceholderMetrics(placeholder, shell.offsetWidth, aspectRatioForShell(shell));
  return placeholder;
}

function promoteMediaShell(overlay: HTMLElement, key: string, shell: HTMLElement, cardElement: HTMLElement): MediaPromotion | null {
  const existingKey = promotedShellKeys.get(shell);
  if (existingKey && existingKey !== key) demoteMediaShell(existingKey);
  const existing = promotedMediaShells.get(key);
  if (existing?.shell === shell) return existing;
  if (existing) demoteMediaShell(key);
  const parent = shell.parentElement;
  if (!parent) return null;

  const handoffState = captureLedgerCardMediaHandoffState(shell);
  const placeholder = createPlaceholder(shell, key);
  const promotion: MediaPromotion = {
    key,
    shell,
    placeholder,
    originalLocalWidth: Math.max(1, Math.round(shell.offsetWidth || 1)),
    originalCardZoneColor: shell.style.getPropertyValue('--card-zone-color'),
    originalStyle: readPromotedStyle(shell),
    pendingHandoffState: handoffState
  };

  withHiddenMediaHandoff(shell, () => {
    parent.insertBefore(placeholder, shell);
    overlay.append(shell);
    shell.dataset.mediaPromoted = 'true';
    shell.dataset.mediaPromotionKey = key;
    const zoneColor = cardZoneColor(cardElement);
    if (zoneColor) shell.style.setProperty('--card-zone-color', zoneColor);
  });
  promotedMediaShells.set(key, promotion);
  promotedShellKeys.set(shell, key);

  if (typeof ResizeObserver !== 'undefined') {
    promotion.resizeObserver = new ResizeObserver(() => {
      if (isLedgerCardMediaResizePersistenceSuppressed(promotion.shell)) return;
      if (syncPlaceholderFromPromotedShell(promotion)) scheduleCanvasMediaOverlayRender();
    });
    promotion.resizeObserver.observe(shell);
  }

  return promotion;
}

function syncPromotedMediaShell(promotion: MediaPromotion, sourceRect: DOMRect, canvasRect: DOMRect): void {
  const handoffState = promotion.pendingHandoffState;
  delete promotion.pendingHandoffState;
  const scale = Number(state.viewport.scale);
  const promotionScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const maxWidth = Math.max(1, Math.round(localMediaMaxWidth(promotion) * promotionScale));
  const sync = () => {
    promotion.shell.dataset.mediaPromotionScale = String(promotionScale);
    promotion.shell.dataset.mediaLocalMaxWidth = String(localMediaMaxWidth(promotion));
    promotion.shell.style.position = 'absolute';
    promotion.shell.style.left = `${Math.round(sourceRect.left - canvasRect.left)}px`;
    promotion.shell.style.top = `${Math.round(sourceRect.top - canvasRect.top)}px`;
    promotion.shell.style.width = `${Math.max(1, Math.round(sourceRect.width))}px`;
    promotion.shell.style.height = '';
    promotion.shell.style.maxWidth = `${maxWidth}px`;
    promotion.shell.style.margin = '0';
    promotion.shell.style.zIndex = '1';
    promotion.shell.style.transform = '';
    promotion.shell.style.boxSizing = 'border-box';
    if (handoffState) restoreLedgerCardMediaHandoffState(promotion.shell, handoffState);
  };
  if (handoffState) withHiddenMediaHandoff(promotion.shell, sync);
  else sync();
}

function demoteInactiveMediaShells(activeKeys: Set<string>): void {
  for (const key of Array.from(promotedMediaShells.keys())) {
    if (!activeKeys.has(key)) demoteMediaShell(key);
  }
}

export function renderCanvasMediaOverlay(): void {
  const overlay = resolveMediaOverlay();
  if (mediaOverlaySuspended) {
    clearMediaOverlay(overlay, { reconcilePromotedGeometry: false });
    return;
  }
  if (!overlay || !canvas || !content || Number(state.viewport.scale) < canvasMediaOverlayScaleThreshold) {
    clearMediaOverlay(overlay);
    return;
  }

  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  if (cards.length === 0) {
    clearMediaOverlay(overlay);
    return;
  }

  const bounds = viewportWorldBounds(state.viewport, {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight
  });
  const canvasRect = canvas.getBoundingClientRect();
  const activeKeys = new Set<string>();
  let promoted = 0;

  for (const card of visibleLedgerCards(cards, bounds).slice(0, maxCanvasMediaOverlayCards)) {
    const cardId = String(card.id ?? '');
    if (!cardId) continue;
    const cardElement = cardNode(cardId);
    if (!cardElement) continue;
    for (const [shellIndex, slotNode] of mediaSlotNodes(cardElement).entries()) {
      const shell = shellForSlot(slotNode);
      if (!shell) continue;
      const isPlaceholderSlot = slotNode.classList.contains('ledger-card-media-placeholder');
      if (isPlaceholderSlot) {
        const promotion = promotedMediaShells.get(slotNode.dataset.mediaPromotionKey ?? '');
        if (promotion?.shell === shell && !isLedgerCardMediaResizePersistenceSuppressed(shell)) {
          syncPlaceholderFromPromotedShell(promotion);
        }
      }
      const sourceElement = isPlaceholderSlot ? slotNode : shell;
      const sourceRect = sourceElement.getBoundingClientRect();
      if (!rectIntersectsCanvas(sourceRect, canvasRect)) continue;
      const key = `${cardId}:${shellIndex}`;
      const promotion = promoteMediaShell(overlay, key, shell, cardElement);
      if (!promotion) continue;
      syncPromotedMediaShell(promotion, sourceRect, canvasRect);
      activeKeys.add(key);
      promoted += 1;
    }
  }

  demoteInactiveMediaShells(activeKeys);
  lastRenderedViewport = { x: Number(state.viewport.x), y: Number(state.viewport.y), scale: Number(state.viewport.scale) };
  telemetry('render-canvas-media-overlay', { promoted, threshold: canvasMediaOverlayScaleThreshold });
}

export function scheduleCanvasMediaOverlayRender(): void {
  if (mediaOverlaySuspended) return;
  if (scheduled) return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    renderCanvasMediaOverlay();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export function applyCanvasMediaOverlayPanTransform(): void {
  if (Number(state.viewport.scale) < canvasMediaOverlayScaleThreshold) {
    clearCanvasMediaOverlay();
    return;
  }
  if (!lastRenderedViewport || lastRenderedViewport.scale !== Number(state.viewport.scale)) {
    scheduleCanvasMediaOverlayRender();
    return;
  }
  const shells = Array.from(promotedMediaShells.values()).map((promotion) => promotion.shell).filter((shell) => shell.isConnected);
  if (shells.length === 0) {
    scheduleCanvasMediaOverlayRender();
    return;
  }
  const devicePixelRatio = window.devicePixelRatio || 1;
  const dx = Math.round((Number(state.viewport.x) - lastRenderedViewport.x) * devicePixelRatio) / devicePixelRatio;
  const dy = Math.round((Number(state.viewport.y) - lastRenderedViewport.y) * devicePixelRatio) / devicePixelRatio;
  const transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
  for (const shell of shells) shell.style.transform = transform;
  if (panReconcileTimer) clearTimeout(panReconcileTimer);
  panReconcileTimer = setTimeout(() => {
    panReconcileTimer = undefined;
    scheduleCanvasMediaOverlayRender();
  }, 80);
}
