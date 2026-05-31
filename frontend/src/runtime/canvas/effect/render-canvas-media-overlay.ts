/**
 * WHAT: Mirrors zoomed-in card media into an untransformed canvas overlay.
 * WHY: Images inside the transformed canvas can keep a soft raster after zooming out and back in.
 */
import { canvas, content, mediaOverlay as initialMediaOverlay } from '../../dom.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { viewportWorldBounds, visibleLedgerCards } from '../../card/helper/visible-ledger-cards.js';

export const canvasMediaOverlayScaleThreshold = 1;
const maxCanvasMediaOverlayCards = 16;

let scheduled = false;

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

function clearActiveShells(activeShells = new Set<HTMLElement>()): void {
  if (!content) return;
  for (const shell of content.querySelectorAll('.ledger-card-media-shell[data-media-overlay-active="true"]')) {
    if (activeShells.has(shell as HTMLElement)) continue;
    delete (shell as HTMLElement).dataset.mediaOverlayActive;
    delete (shell as HTMLElement).dataset.mediaOverlayKey;
  }
}

function clearMediaOverlay(overlay: HTMLElement | null = resolveMediaOverlay()): void {
  overlay?.replaceChildren();
  clearActiveShells();
}

function cardNode(cardId: string): HTMLElement | null {
  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
}

function activeCarouselImage(shell: HTMLElement): { image: HTMLImageElement; index: number } | null {
  const track = shell.querySelector('.ledger-card-media-track') as HTMLElement | null;
  if (!track) return null;
  const slides = Array.from(track.children) as HTMLElement[];
  if (slides.length === 0) return null;
  const index = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
  const image = slides[index]?.querySelector('.ledger-card-media-image') as HTMLImageElement | null;
  return image ? { image, index } : null;
}

function rectIntersectsCanvas(rect: DOMRect, canvasRect: DOMRect): boolean {
  return rect.right > canvasRect.left
    && rect.left < canvasRect.right
    && rect.bottom > canvasRect.top
    && rect.top < canvasRect.bottom
    && rect.width > 0
    && rect.height > 0;
}

function syncOverlayImage(overlay: HTMLElement, key: string, image: HTMLImageElement, rect: DOMRect, canvasRect: DOMRect): HTMLImageElement {
  let mirror = overlay.querySelector(`img[data-media-key="${CSS.escape(key)}"]`) as HTMLImageElement | null;
  if (!mirror) {
    mirror = document.createElement('img');
    mirror.className = 'canvas-media-overlay-image';
    mirror.dataset.mediaKey = key;
    mirror.decoding = 'async';
    mirror.draggable = false;
    overlay.append(mirror);
  }
  const source = image.currentSrc || image.getAttribute('src') || image.src;
  if (mirror.getAttribute('src') !== source) mirror.src = source;
  mirror.alt = image.alt;
  if (image.title) mirror.title = image.title;
  else mirror.removeAttribute('title');
  mirror.style.left = `${Math.round(rect.left - canvasRect.left)}px`;
  mirror.style.top = `${Math.round(rect.top - canvasRect.top)}px`;
  mirror.style.width = `${Math.round(rect.width)}px`;
  mirror.style.height = `${Math.round(rect.height)}px`;
  return mirror;
}

export function renderCanvasMediaOverlay(): void {
  const overlay = resolveMediaOverlay();
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
  const activeShells = new Set<HTMLElement>();
  let mirrored = 0;

  for (const card of visibleLedgerCards(cards, bounds).slice(0, maxCanvasMediaOverlayCards)) {
    const cardId = String(card.id ?? '');
    if (!cardId) continue;
    const cardElement = cardNode(cardId);
    if (!cardElement) continue;
    const shells = Array.from(cardElement.querySelectorAll('.ledger-card-media-shell')) as HTMLElement[];
    for (const [shellIndex, shell] of shells.entries()) {
      const active = activeCarouselImage(shell);
      const track = shell.querySelector('.ledger-card-media-track') as HTMLElement | null;
      if (!active || !track) continue;
      const rect = track.getBoundingClientRect();
      if (!rectIntersectsCanvas(rect, canvasRect)) continue;
      const source = active.image.getAttribute('src') || active.image.currentSrc || active.image.src;
      const key = `${cardId}:${shellIndex}:${active.index}:${source}`;
      const mirror = syncOverlayImage(overlay, key, active.image, rect, canvasRect);
      activeKeys.add(key);
      if (mirror.complete) {
        shell.dataset.mediaOverlayActive = 'true';
        shell.dataset.mediaOverlayKey = key;
        activeShells.add(shell);
      } else {
        mirror.addEventListener('load', scheduleCanvasMediaOverlayRender, { once: true });
      }
      mirrored += 1;
    }
  }

  for (const node of Array.from(overlay.querySelectorAll('.canvas-media-overlay-image')) as HTMLImageElement[]) {
    if (!activeKeys.has(node.dataset.mediaKey ?? '')) node.remove();
  }
  clearActiveShells(activeShells);
  telemetry('render-canvas-media-overlay', { mirrored, threshold: canvasMediaOverlayScaleThreshold });
}

export function scheduleCanvasMediaOverlayRender(): void {
  if (scheduled) return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    renderCanvasMediaOverlay();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else setTimeout(run, 0);
}
