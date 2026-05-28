import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { commitActiveLedgerMutation } from '../effect/commit-active-ledger-mutation.js';
import { state } from '../../state.js';

type LedgerCardImage = Extract<LedgerMarkdownBlock, { kind: 'images' }>['images'][number];
export type LedgerCardImageSizes = Record<string, { width?: number; height?: number }>;

type LedgerCardMediaOptions = {
  cardId?: string;
  imageSizes?: LedgerCardImageSizes;
};

const pendingResizeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

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

function watchImageResize(element: HTMLElement, options: LedgerCardMediaOptions, source: string): void {
  if (!options.cardId || typeof ResizeObserver === 'undefined') return;
  let initialized = false;
  const observer = new ResizeObserver(() => {
    if (!initialized) {
      initialized = true;
      return;
    }
    const width = Math.round(element.offsetWidth);
    const height = Math.round(element.offsetHeight);
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

  const element = document.createElement('img');
  element.className = 'ledger-card-media-image';
  element.src = image.src;
  element.alt = image.alt;
  element.loading = 'lazy';
  element.decoding = 'async';
  element.draggable = false;
  if (image.title) element.title = image.title;
  if (index === 0) {
    element.addEventListener('load', () => applyImageAspectRatio(shell, element), { once: true });
    if (element.complete) applyImageAspectRatio(shell, element);
  }

  slide.appendChild(element);
  return slide;
}

function scrollCarousel(track: HTMLElement, direction: -1 | 1): void {
  const slideCount = track.children.length;
  if (slideCount <= 0) return;
  const slideWidth = Math.max(1, track.clientWidth);
  const currentIndex = Math.round(track.scrollLeft / slideWidth);
  const nextIndex = (currentIndex + direction + slideCount) % slideCount;
  track.scrollTo({ left: nextIndex * slideWidth, behavior: 'smooth' });
}

export function renderLedgerCardMedia(block: Extract<LedgerMarkdownBlock, { kind: 'images' }>, options: LedgerCardMediaOptions = {}): HTMLElement {
  const isCarousel = block.images.length > 1;
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
  for (const [index, image] of block.images.entries()) {
    track.appendChild(renderMediaSlide(image, index, shell));
  }
  shell.appendChild(track);

  if (isCarousel) {
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
      scrollCarousel(track, -1);
    });

    const next = document.createElement('button');
    next.className = 'ledger-card-media-button';
    next.type = 'button';
    next.textContent = '>';
    next.setAttribute('aria-label', 'Next image');
    next.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(track, 1);
    });

    nav.replaceChildren(previous, next);
    shell.appendChild(nav);
  }

  return shell;
}
