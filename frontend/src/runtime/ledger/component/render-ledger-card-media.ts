import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { commitActiveLedgerMutation } from '../effect/commit-active-ledger-mutation.js';
import {
  captureLedgerCardMediaHandoffState,
  isLedgerCardMediaResizePersistenceSuppressed,
  restoreLedgerCardMediaHandoffState,
  scheduleLedgerCardMediaLayout,
  syncCarouselSlider
} from '../helper/sync-ledger-card-media-layout.js';
import {
  ledgerCardMediaCarouselStateId,
  readLedgerCardMediaCarouselSlide,
  saveLedgerCardMediaCarouselSlide
} from '../helper/persist-ledger-card-media-carousel.js';
import { scheduleCanvasMediaOverlayRender } from '../../canvas/effect/render-canvas-media-overlay.js';
import { state } from '../../state.js';

type LedgerCardImage = Extract<LedgerMarkdownBlock, { kind: 'images' }>['images'][number];
export type LedgerCardImageSizes = Record<string, { width?: number; height?: number }>;

type LedgerCardMediaOptions = {
  cardId?: string;
  imageSizes?: LedgerCardImageSizes;
};

const pendingResizeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function watchContainedImageSizing(shell: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => scheduleLedgerCardMediaLayout(shell));
  observer.observe(shell);
}

function watchCarouselSlider(shell: HTMLElement, track: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => syncCarouselSlider(shell, track));
  observer.observe(shell);
  observer.observe(track);
}

function dimensionsFor(source: string, imageSizes: LedgerCardImageSizes = {}): { width?: number; height?: number } {
  const dimensions = imageSizes[source] ?? {};
  return {
    width: Number.isFinite(Number(dimensions.width)) ? Number(dimensions.width) : undefined,
    height: Number.isFinite(Number(dimensions.height)) ? Number(dimensions.height) : undefined
  };
}

function applyPersistedDimensions(element: HTMLElement, dimensions: { width?: number; height?: number }): void {
  if (dimensions.width) element.style.width = `${Math.max(96, dimensions.width)}px`;
  if (dimensions.width && dimensions.height) {
    element.style.setProperty('--ledger-card-media-aspect-ratio', `${Math.max(1, dimensions.width)} / ${Math.max(1, dimensions.height)}`);
  }
}

function currentCardImageSizes(cardId: string): LedgerCardImageSizes {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  const card = cards.find((entry) => String(entry.id ?? '') === cardId);
  return card?.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
    ? { ...(card.imageSizes as LedgerCardImageSizes) }
    : {};
}

function mediaLocalMaxWidth(element: HTMLElement): number {
  const promotedMaxWidth = Number(element.dataset.mediaLocalMaxWidth);
  if (Number.isFinite(promotedMaxWidth) && promotedMaxWidth > 0) return promotedMaxWidth;
  return Math.max(1, element.parentElement?.clientWidth || element.offsetWidth || 1);
}

function watchImageResize(element: HTMLElement, options: LedgerCardMediaOptions, source: string): void {
  if (!options.cardId || typeof ResizeObserver === 'undefined') return;
  let initialized = false;
  const observer = new ResizeObserver(() => {
    if (!initialized) {
      initialized = true;
      return;
    }
    if (isLedgerCardMediaResizePersistenceSuppressed(element)) {
      return;
    }
    const promotionScale = Number(element.dataset.mediaPromotionScale);
    const dimensionScale = Number.isFinite(promotionScale) && promotionScale > 0 ? promotionScale : 1;
    const width = Math.min(mediaLocalMaxWidth(element), Math.round(element.offsetWidth / dimensionScale));
    const height = Math.round(element.offsetHeight / dimensionScale);
    if (!width || !height) return;
    const previous = pendingResizeTimers.get(element);
    if (previous) clearTimeout(previous);
    pendingResizeTimers.set(element, setTimeout(() => {
      const imageSizes = currentCardImageSizes(options.cardId ?? '');
      const existing = imageSizes[source] ?? {};
      if (existing.width === width && existing.height === height) return;
      imageSizes[source] = { width, height };
      void commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: options.cardId ?? '', imageSizes } });
    }, 350));
  });
  observer.observe(element);
}

function applyImageAspectRatio(shell: HTMLElement, image: HTMLImageElement): void {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return;
  shell.style.setProperty('--ledger-card-media-aspect-ratio', `${width} / ${height}`);
}

function renderMediaSlide(image: LedgerCardImage, index: number, shell: HTMLElement): HTMLElement {
  const slide = document.createElement('figure');
  slide.className = 'ledger-card-media-slide';
  slide.setAttribute('aria-label', image.alt || `Image ${index + 1}`);
  const titleText = (image.title || image.alt).trim();

  const element = document.createElement('img');
  element.className = 'ledger-card-media-image';
  element.src = image.src;
  element.alt = image.alt;
  element.loading = 'lazy';
  element.decoding = 'async';
  element.draggable = false;
  if (image.title) element.title = image.title;
  element.addEventListener('load', () => {
    if (index === 0) {
      applyImageAspectRatio(shell, element);
    }
    scheduleLedgerCardMediaLayout(shell);
    scheduleCanvasMediaOverlayRender();
  }, { once: true });
  if (index === 0 && element.complete) applyImageAspectRatio(shell, element);

  slide.appendChild(element);
  if (titleText) {
    const caption = document.createElement('figcaption');
    caption.className = 'ledger-card-media-title';
    caption.textContent = titleText;
    slide.appendChild(caption);
  }
  return slide;
}

function carouselStateId(block: Extract<LedgerMarkdownBlock, { kind: 'images' }>, options: LedgerCardMediaOptions, isCarousel: boolean): string {
  if (!isCarousel) return '';
  return ledgerCardMediaCarouselStateId({
    tabId: String(state.activeTab ?? ''),
    cardId: options.cardId,
    sources: block.images.map((image) => image.src)
  });
}

function saveCurrentCarouselSlide(shell: HTMLElement, stateId: string): void {
  if (!stateId) return;
  const track = shell.querySelector('.ledger-card-media-track') as HTMLElement | null;
  const slideCount = track?.children.length ?? 0;
  saveLedgerCardMediaCarouselSlide(stateId, captureLedgerCardMediaHandoffState(shell).slideIndex, slideCount);
}

function hydrateCarouselSlide(shell: HTMLElement, stateId: string): void {
  if (!stateId) return;
  const slideCount = shell.querySelector('.ledger-card-media-track')?.children.length ?? 0;
  const slideIndex = readLedgerCardMediaCarouselSlide(stateId, slideCount);
  if (slideIndex <= 0) return;
  const restore = () => {
    restoreLedgerCardMediaHandoffState(shell, { slideIndex });
    scheduleCanvasMediaOverlayRender();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
  else setTimeout(restore, 0);
}

function scrollCarousel(shell: HTMLElement, track: HTMLElement, direction: -1 | 1, stateId: string): void {
  const slideCount = track.children.length;
  if (slideCount <= 0) return;
  const slideWidth = Math.max(1, track.clientWidth);
  const currentIndex = Math.round(track.scrollLeft / slideWidth);
  const nextIndex = (currentIndex + direction + slideCount) % slideCount;
  saveLedgerCardMediaCarouselSlide(stateId, nextIndex, slideCount);
  track.scrollTo({ left: nextIndex * slideWidth, behavior: 'smooth' });
  scheduleCanvasMediaOverlayRender();
}

export function renderLedgerCardMedia(block: Extract<LedgerMarkdownBlock, { kind: 'images' }>, options: LedgerCardMediaOptions = {}): HTMLElement {
  const isCarousel = block.images.length > 1;
  const persistedCarouselStateId = carouselStateId(block, options, isCarousel);
  const shell = document.createElement('div');
  shell.className = isCarousel
    ? 'ledger-card-media-shell ledger-card-media-carousel'
    : 'ledger-card-media-shell ledger-card-media-single';
  shell.dataset.ledgerCardMedia = 'true';
  shell.dataset.wheelCapture = 'true';
  const sizeSource = block.images[0]?.src ?? '';
  shell.dataset.imageSizeId = sizeSource;
  applyPersistedDimensions(shell, dimensionsFor(sizeSource, options.imageSizes));
  watchImageResize(shell, options, sizeSource);

  const track = document.createElement('div');
  track.className = 'ledger-card-media-track';
  track.setAttribute('aria-label', isCarousel ? 'Card image carousel' : 'Card image');
  track.addEventListener('scroll', () => {
    syncCarouselSlider(shell, track);
    saveCurrentCarouselSlide(shell, persistedCarouselStateId);
    scheduleCanvasMediaOverlayRender();
  }, { passive: true });
  for (const [index, image] of block.images.entries()) {
    track.appendChild(renderMediaSlide(image, index, shell));
  }
  shell.appendChild(track);
  watchContainedImageSizing(shell);
  scheduleLedgerCardMediaLayout(shell);

  if (isCarousel) {
    const progress = document.createElement('div');
    progress.className = 'ledger-card-media-progress';
    progress.setAttribute('aria-hidden', 'true');

    const thumb = document.createElement('div');
    thumb.className = 'ledger-card-media-progress-thumb';
    progress.appendChild(thumb);
    shell.appendChild(progress);
    watchCarouselSlider(shell, track);
    syncCarouselSlider(shell, track);
    hydrateCarouselSlide(shell, persistedCarouselStateId);

    const nav = document.createElement('div');
    nav.className = 'ledger-card-media-nav';

    const previous = document.createElement('button');
    previous.className = 'ledger-card-media-button';
    previous.type = 'button';
    previous.textContent = '<';
    previous.setAttribute('aria-label', 'Previous image');
    previous.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(shell, track, -1, persistedCarouselStateId);
    });

    const next = document.createElement('button');
    next.className = 'ledger-card-media-button';
    next.type = 'button';
    next.textContent = '>';
    next.setAttribute('aria-label', 'Next image');
    next.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(shell, track, 1, persistedCarouselStateId);
    });

    nav.replaceChildren(previous, next);
    shell.appendChild(nav);
  }

  return shell;
}
