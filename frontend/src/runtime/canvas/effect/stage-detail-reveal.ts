import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { canvasBoundsIntersect, viewportWorldBounds, type CanvasBounds } from '../../card/helper/visible-ledger-cards.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

type RevealCard = {
  element: HTMLElement;
  visible: boolean;
  distance: number;
};

const DETAIL_REVEAL_SETTLE_MS = 120;
const DETAIL_REVEAL_TARGET_MS = 4;
const DETAIL_REVEAL_MAX_CHUNK = 24;
const DETAIL_REVEAL_BACKGROUND_CHUNK = 4;

let settleTimer = 0;
let frameHandle = 0;
let idleHandle = 0;
let urgentQueue: RevealCard[] = [];
let backgroundQueue: RevealCard[] = [];
let averageCardCostMs = 1;
let nextChunkSize = 1;
let sequence = 0;

function parsePixels(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cardBounds(element: HTMLElement): CanvasBounds {
  return {
    x: parsePixels(element.style.left, 0),
    y: parsePixels(element.style.top, 0),
    width: parsePixels(element.style.width, Number(element.dataset.sizeCacheWidth ?? 280)),
    height: parsePixels(element.style.height, Number(element.dataset.sizeCacheHeight ?? 132))
  };
}

function expandedBounds(bounds: CanvasBounds): CanvasBounds {
  return {
    x: bounds.x - bounds.width,
    y: bounds.y - bounds.height,
    width: bounds.width * 3,
    height: bounds.height * 3
  };
}

function distanceToCenter(bounds: CanvasBounds, centerX: number, centerY: number): number {
  const cardCenterX = bounds.x + bounds.width / 2;
  const cardCenterY = bounds.y + bounds.height / 2;
  return Math.hypot(cardCenterX - centerX, cardCenterY - centerY);
}

function orderedRevealCards(): { urgent: RevealCard[]; background: RevealCard[]; visibleCount: number } {
  const viewportBounds = viewportWorldBounds(state.viewport, {
    width: window.innerWidth || canvas.clientWidth,
    height: window.innerHeight || canvas.clientHeight
  });
  const nearBounds = expandedBounds(viewportBounds);
  const centerX = viewportBounds.x + viewportBounds.width / 2;
  const centerY = viewportBounds.y + viewportBounds.height / 2;
  const urgent: RevealCard[] = [];
  const background: RevealCard[] = [];
  let visibleCount = 0;

  for (const element of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    const bounds = cardBounds(element);
    const visible = canvasBoundsIntersect(bounds, viewportBounds);
    const near = visible || canvasBoundsIntersect(bounds, nearBounds);
    const entry = { element, visible, distance: distanceToCenter(bounds, centerX, centerY) };
    if (visible) visibleCount += 1;
    if (near) urgent.push(entry);
    else background.push(entry);
  }

  const byPriority = (a: RevealCard, b: RevealCard): number => {
    if (a.visible !== b.visible) return a.visible ? -1 : 1;
    return a.distance - b.distance;
  };
  urgent.sort(byPriority);
  background.sort((a, b) => a.distance - b.distance);
  return { urgent, background, visibleCount };
}

function clearScheduledWork(): void {
  if (settleTimer) {
    window.clearTimeout(settleTimer);
    settleTimer = 0;
  }
  if (frameHandle) {
    window.cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }
  if (idleHandle) {
    const cancelIdle = (window as any).cancelIdleCallback as ((handle: number) => void) | undefined;
    if (cancelIdle) cancelIdle(idleHandle);
    else window.clearTimeout(idleHandle);
    idleHandle = 0;
  }
}

function revealFrom(queue: RevealCard[], limit: number): number {
  let revealed = 0;
  while (revealed < limit && queue.length > 0) {
    const entry = queue.shift();
    if (!entry) break;
    entry.element.dataset.detailReveal = 'visible';
    revealed += 1;
  }
  return revealed;
}

function adaptChunkSize(revealed: number, durationMs: number): void {
  if (revealed <= 0) return;
  const measuredCost = Math.max(0.05, durationMs / revealed);
  averageCardCostMs = averageCardCostMs * 0.7 + measuredCost * 0.3;
  nextChunkSize = Math.max(1, Math.min(DETAIL_REVEAL_MAX_CHUNK, Math.floor(DETAIL_REVEAL_TARGET_MS / averageCardCostMs)));
}

function revealUrgentFrame(currentSequence: number): void {
  frameHandle = 0;
  if (currentSequence !== sequence || !canvas.classList.contains('detail-reveal-staged')) return;

  const startedAt = performance.now();
  const requested = nextChunkSize;
  const revealed = revealFrom(urgentQueue, requested);
  const durationMs = performance.now() - startedAt;
  adaptChunkSize(revealed, durationMs);
  telemetry('detail-reveal-frame', {
    phase: 'urgent',
    revealed,
    requested,
    durationMs: Number(durationMs.toFixed(3)),
    averageCardCostMs: Number(averageCardCostMs.toFixed(3)),
    nextChunkSize,
    remainingUrgent: urgentQueue.length,
    remainingBackground: backgroundQueue.length
  });

  if (urgentQueue.length > 0) {
    frameHandle = window.requestAnimationFrame(() => revealUrgentFrame(currentSequence));
    return;
  }
  scheduleBackgroundReveal(currentSequence);
}

function scheduleBackgroundReveal(currentSequence: number): void {
  if (backgroundQueue.length === 0) {
    telemetry('detail-reveal-complete', { averageCardCostMs: Number(averageCardCostMs.toFixed(3)), nextChunkSize });
    canvas.classList.remove('detail-reveal-staged');
    return;
  }

  const revealBackground = (): void => {
    idleHandle = 0;
    if (currentSequence !== sequence || !canvas.classList.contains('detail-reveal-staged')) return;
    const startedAt = performance.now();
    const revealed = revealFrom(backgroundQueue, DETAIL_REVEAL_BACKGROUND_CHUNK);
    const durationMs = performance.now() - startedAt;
    telemetry('detail-reveal-frame', {
      phase: 'background',
      revealed,
      requested: DETAIL_REVEAL_BACKGROUND_CHUNK,
      durationMs: Number(durationMs.toFixed(3)),
      averageCardCostMs: Number(averageCardCostMs.toFixed(3)),
      nextChunkSize,
      remainingUrgent: urgentQueue.length,
      remainingBackground: backgroundQueue.length
    });
    scheduleBackgroundReveal(currentSequence);
  };

  const requestIdle = (window as any).requestIdleCallback as ((callback: () => void, options?: { timeout: number }) => number) | undefined;
  idleHandle = requestIdle ? requestIdle(revealBackground, { timeout: 240 }) : window.setTimeout(revealBackground, 48);
}

export function beginStagedDetailReveal(): void {
  sequence += 1;
  clearScheduledWork();
  urgentQueue = [];
  backgroundQueue = [];
  for (const element of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    element.dataset.detailReveal = 'hidden';
  }
  canvas.classList.add('detail-reveal-staged');
  telemetry('detail-reveal-staged', {
    sequence,
    cards: content.querySelectorAll('.card[data-card-id]').length,
    scale: Number(state.viewport.scale.toFixed(3))
  });
}

export function cancelStagedDetailReveal(): void {
  sequence += 1;
  clearScheduledWork();
  urgentQueue = [];
  backgroundQueue = [];
  canvas.classList.remove('detail-reveal-staged');
}

export function scheduleStagedDetailReveal(): void {
  if (!canvas.classList.contains('detail-reveal-staged')) return;
  const currentSequence = sequence;
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    settleTimer = 0;
    if (currentSequence !== sequence || !canvas.classList.contains('detail-reveal-staged')) return;
    const ordered = orderedRevealCards();
    urgentQueue = ordered.urgent;
    backgroundQueue = ordered.background;
    nextChunkSize = Math.max(1, Math.min(DETAIL_REVEAL_MAX_CHUNK, Math.floor(DETAIL_REVEAL_TARGET_MS / averageCardCostMs)));
    telemetry('detail-reveal-queue', {
      sequence,
      visibleCards: ordered.visibleCount,
      urgentCards: urgentQueue.length,
      backgroundCards: backgroundQueue.length,
      averageCardCostMs: Number(averageCardCostMs.toFixed(3)),
      nextChunkSize
    });
    frameHandle = window.requestAnimationFrame(() => revealUrgentFrame(currentSequence));
  }, DETAIL_REVEAL_SETTLE_MS);
}
