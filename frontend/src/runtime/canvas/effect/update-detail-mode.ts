import { canvas } from '../../dom.js';
import { state } from '../../state.js';

let cardSizeCacheValid = false;

export function invalidateDetailModeCardSizeCache(): void {
  cardSizeCacheValid = false;
}

function cacheRenderedCardSizes(): void {
  const hadLowDetail = canvas.classList.contains('low-detail');
  const hadOverviewDetail = canvas.classList.contains('overview-detail');
  const cards = Array.from(document.querySelectorAll('.card[data-card-id]')) as HTMLElement[];
  if (!cards.length) return;

  if (hadLowDetail) {
    canvas.classList.remove('low-detail', 'overview-detail');
  }

  for (const card of cards) {
    const width = Math.ceil(card.offsetWidth);
    const height = Math.ceil(card.offsetHeight);
    if (width <= 0 || height <= 0) continue;
    card.dataset.sizeCacheWidth = String(width);
    card.dataset.sizeCacheHeight = String(height);
    card.style.setProperty('--card-size-cache-width', `${width}px`);
    card.style.setProperty('--card-size-cache-height', `${height}px`);
  }

  if (hadLowDetail) {
    canvas.classList.toggle('low-detail', hadLowDetail);
    canvas.classList.toggle('overview-detail', hadOverviewDetail);
  }
}

export function updateDetailMode(): void {
  const shouldUseLowDetail = state.viewport.scale < 0.35;
  const shouldUseOverviewDetail = state.viewport.scale < 0.18;
  const hasLowDetail = canvas.classList.contains('low-detail');
  const hasOverviewDetail = canvas.classList.contains('overview-detail');
  if (shouldUseLowDetail && !cardSizeCacheValid) {
    cacheRenderedCardSizes();
    cardSizeCacheValid = true;
  }
  if (hasLowDetail !== shouldUseLowDetail) canvas.classList.toggle('low-detail', shouldUseLowDetail);
  if (hasOverviewDetail !== shouldUseOverviewDetail) canvas.classList.toggle('overview-detail', shouldUseOverviewDetail);
}
