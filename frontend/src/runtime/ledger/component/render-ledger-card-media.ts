import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { sendActiveLedgerMutation } from '../effect/send-active-ledger-mutation.js';
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
import { scheduleCanvasMediaOverlayRender } from '../../surface/effect/canvas-surface-effects.js';
import { state } from '../../state.js';
import { openLedgerCardImageViewer } from '../effect/open-ledger-card-image-viewer.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import {
  ensureLedgerCardMediaResizeInteraction,
  resizeLedgerCardMediaFromKeyboard
} from '../helper/bind-ledger-card-media-resize.js';

type LedgerCardImage = Extract<LedgerMarkdownBlock, { kind: 'images' }>['images'][number];
export type LedgerCardImageSizes = Record<string, { width?: number; height?: number }>;

type LedgerCardMediaOptions = {
  cardId?: string;
  carouselDriver?: 'internal' | 'external';
  imageSizes?: LedgerCardImageSizes;
  mediaSurface?: 'card' | 'thread';
  onImageResize?: (source: string, dimensions: { width: number; height: number }) => void;
};

const pendingResizeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const pendingResizeRevisions = new WeakMap<HTMLElement, number>();

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

function currentCard(cardId: string): Record<string, unknown> | undefined {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  return cards.find((entry) => String(entry.id ?? '') === cardId);
}

function mediaLocalMaxWidth(element: HTMLElement): number {
  const promotedMaxWidth = Number(element.dataset.mediaLocalMaxWidth);
  if (Number.isFinite(promotedMaxWidth) && promotedMaxWidth > 0) return promotedMaxWidth;
  return Math.max(1, element.parentElement?.clientWidth || element.offsetWidth || 1);
}

function restoreConfirmedImageResize(element: HTMLElement, dimensions: { width?: number; height?: number }): void {
  const promotionScale = Number(element.dataset.mediaPromotionScale);
  const dimensionScale = Number.isFinite(promotionScale) && promotionScale > 0 ? promotionScale : 1;
  if (dimensions.width) element.style.width = `${Math.max(96, dimensions.width) * dimensionScale}px`;
  else if (dimensionScale > 1) element.style.width = `${mediaLocalMaxWidth(element) * dimensionScale}px`;
  else element.style.removeProperty('width');
  if (dimensions.width && dimensions.height) {
    element.style.setProperty('--ledger-card-media-aspect-ratio', `${Math.max(1, dimensions.width)} / ${Math.max(1, dimensions.height)}`);
  }
  scheduleLedgerCardMediaLayout(element);
  scheduleCanvasMediaOverlayRender();
}

async function persistImageResize(element: HTMLElement, options: LedgerCardMediaOptions, source: string, width: number, height: number): Promise<void> {
  if (!width || !height) return;
  if (options.onImageResize) {
    options.onImageResize(source, { width, height });
    return;
  }
  if (!options.cardId) return;
  const card = currentCard(options.cardId);
  if (!card) return;
  const imageSizes = currentCardImageSizes(options.cardId);
  const existing = imageSizes[source] ?? {};
  if (existing.width === width && existing.height === height) return;
  const previousImageSizes = currentCardImageSizes(options.cardId);
  imageSizes[source] = { width, height };
  card.imageSizes = imageSizes;
  const revision = (pendingResizeRevisions.get(element) ?? 0) + 1;
  pendingResizeRevisions.set(element, revision);
  const committed = await sendActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: options.cardId, imageSizes } });
  if (committed || pendingResizeRevisions.get(element) !== revision) return;
  const current = currentCard(options.cardId);
  if (current) current.imageSizes = previousImageSizes;
  restoreConfirmedImageResize(element, previousImageSizes[source] ?? {});
}

function renderedImageDimensions(element: HTMLElement): { width: number; height: number } {
  const promotionScale = Number(element.dataset.mediaPromotionScale);
  const dimensionScale = Number.isFinite(promotionScale) && promotionScale > 0 ? promotionScale : 1;
  return {
    width: Math.min(mediaLocalMaxWidth(element), Math.round(element.offsetWidth / dimensionScale)),
    height: Math.round(element.offsetHeight / dimensionScale)
  };
}

function commitRenderedImageResize(element: HTMLElement, options: LedgerCardMediaOptions, source: string): void {
  const { width, height } = renderedImageDimensions(element);
  if (!width || !height) return;
  const previous = pendingResizeTimers.get(element);
  if (previous) clearTimeout(previous);
  pendingResizeTimers.delete(element);
  void persistImageResize(element, options, source, width, height);
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
    const { width, height } = renderedImageDimensions(element);
    if (!width || !height) return;
    const previous = pendingResizeTimers.get(element);
    if (previous) clearTimeout(previous);
    pendingResizeTimers.set(element, setTimeout(() => {
      void persistImageResize(element, options, source, width, height);
    }, 350));
  });
  observer.observe(element);
}

function renderCardImageResizeHandle(element: HTMLElement, options: LedgerCardMediaOptions, source: string): HTMLElement | null {
  if (!options.cardId) return null;
  ensureLedgerCardMediaResizeInteraction();
  const handle = document.createElement('button');
  handle.className = 'ledger-card-media-resize-handle';
  handle.type = 'button';
  handle.setAttribute('aria-label', 'Resize carousel');
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    resizeLedgerCardMediaFromKeyboard(handle, event.key === 'ArrowLeft' ? -1 : 1);
  });
  element.addEventListener('ledger-card-media-resize-commit', () => commitRenderedImageResize(element, options, source));
  return handle;
}

function renderThreadImageResizeHandle(element: HTMLElement, options: LedgerCardMediaOptions, source: string): HTMLElement | null {
  if (!options.onImageResize) return null;
  const handle = document.createElement('div');
  handle.className = 'ledger-card-media-thread-resize';
  handle.setAttribute('aria-hidden', 'true');
  const aspectRatio = () => {
    const configured = element.style.getPropertyValue('--ledger-card-media-aspect-ratio').trim();
    const ratio = configured.match(/^([0-9.]+)\s*\/\s*([0-9.]+)$/);
    if (ratio) {
      const width = Number(ratio[1]);
      const height = Number(ratio[2]);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return width / height;
    }
    const measured = element.offsetWidth && element.offsetHeight ? element.offsetWidth / element.offsetHeight : 0;
    return Number.isFinite(measured) && measured > 0 ? measured : 4 / 3;
  };
  const maxThreadWidth = () => {
    const note = element.closest('.thread-note') as HTMLElement | null;
    const list = element.closest('.thread-note-list') as HTMLElement | null;
    const listWidth = list?.clientWidth || note?.parentElement?.clientWidth || element.parentElement?.clientWidth || element.offsetWidth || 320;
    const noteMax = note?.classList.contains('is-agent') ? Math.min(listWidth * 0.92, 640) : Math.min(listWidth * 0.86, 520);
    const style = note ? getComputedStyle(note) : null;
    const horizontalPadding = style ? (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0) : 0;
    return Math.max(96, Math.floor(noteMax - horizontalPadding));
  };
  const persistIntendedSize = (width: number) => {
    const height = Math.max(1, Math.round(width / aspectRatio()));
    persistImageResize(element, options, source, width, height);
  };
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = Math.max(1, element.offsetWidth);
    handle.setPointerCapture?.(event.pointerId);
    const resize = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const width = Math.min(maxThreadWidth(), Math.max(96, Math.round(startWidth + moveEvent.clientX - startX)));
      element.style.maxWidth = 'none';
      element.style.width = `${width}px`;
      persistIntendedSize(width);
    };
    const finish = (finishEvent: PointerEvent) => {
      finishEvent.preventDefault();
      finishEvent.stopPropagation();
      handle.removeEventListener('pointermove', resize);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      handle.releasePointerCapture?.(finishEvent.pointerId);
      const width = Math.min(maxThreadWidth(), Math.max(96, Math.round(element.offsetWidth)));
      element.style.maxWidth = 'none';
      element.style.width = `${width}px`;
      persistIntendedSize(width);
    };
    handle.addEventListener('pointermove', resize);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  });
  return handle;
}

function applyImageAspectRatio(shell: HTMLElement, image: HTMLImageElement): void {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return;
  shell.style.setProperty('--ledger-card-media-aspect-ratio', `${width} / ${height}`);
}

function imageTitleFromSource(source: string): string {
  const cleanSource = source.split('#')[0]?.split('?')[0] ?? source;
  const filename = cleanSource.split('/').filter(Boolean).at(-1) ?? cleanSource;
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

function renderFullscreenButton(image: LedgerCardImage, slide: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ledger-card-media-fullscreen terminal-button';
  button.type = 'button';
  button.textContent = '⛶';
  button.setAttribute('aria-label', `Open ${image.alt || 'carousel image'} fullscreen`);
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openLedgerCardImageViewer({ alt: image.alt, source: projectScopedRequestPath(image.src), trigger: button });
  });
  slide.appendChild(button);
  return button;
}

function renderMediaSlide(image: LedgerCardImage, index: number, shell: HTMLElement, options: LedgerCardMediaOptions, isCarousel: boolean): HTMLElement {
  const slide = document.createElement('figure');
  slide.className = 'ledger-card-media-slide';
  slide.setAttribute('aria-label', image.alt || `Image ${index + 1}`);
  const titleText = imageTitleFromSource(image.src).trim();

  const element = document.createElement('img');
  element.className = 'ledger-card-media-image';
  element.src = projectScopedRequestPath(image.src);
  element.alt = image.alt;
  element.loading = 'lazy';
  element.decoding = 'async';
  element.draggable = false;
  if (image.title) element.title = image.title;
  element.addEventListener('load', () => {
    if (index === 0) {
      applyImageAspectRatio(shell, element);
    }
    if (options.mediaSurface !== 'thread') {
      scheduleLedgerCardMediaLayout(shell);
      scheduleCanvasMediaOverlayRender();
    }
  }, { once: true });
  if (index === 0 && element.complete) applyImageAspectRatio(shell, element);

  slide.appendChild(element);
  if (isCarousel) {
    const fullscreenButton = renderFullscreenButton(image, slide);
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const visible = slide.classList.toggle('is-fullscreen-control-visible');
      fullscreenButton.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible) fullscreenButton.focus({ preventScroll: true });
    });
    fullscreenButton.setAttribute('aria-hidden', 'true');
  }
  if (titleText) {
    const caption = document.createElement('figcaption');
    caption.className = 'ledger-card-media-title';
    caption.textContent = titleText;
    slide.appendChild(caption);
  }
  return slide;
}

function updateMediaDeleteButton(button: HTMLButtonElement, images: LedgerCardImage[], track: HTMLElement): void {
  const slideWidth = Math.max(1, track.clientWidth);
  const index = Math.max(0, Math.min(images.length - 1, Math.round(track.scrollLeft / slideWidth)));
  const image = images[index];
  if (!image) return;
  const titleText = imageTitleFromSource(image.src).trim();
  button.dataset.imageSrc = image.src;
  button.dataset.carouselSlideIndex = String(index);
  button.dataset.carouselSources = JSON.stringify(images.map((entry) => entry.src));
  button.setAttribute('aria-label', `Delete ${titleText || image.alt || `image ${index + 1}`}`);
}

function renderMediaDeleteButton(block: Extract<LedgerMarkdownBlock, { kind: 'images' }>, options: LedgerCardMediaOptions, track: HTMLElement): HTMLButtonElement | null {
  if (!options.cardId) return null;
  const deleteButton = document.createElement('button');
  deleteButton.className = 'ledger-card-media-delete terminal-button terminal-button--compact';
  deleteButton.type = 'button';
  deleteButton.textContent = 'X';
  deleteButton.dataset.action = 'confirm-delete-card-image';
  deleteButton.dataset.cardId = options.cardId;
  deleteButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  deleteButton.addEventListener('click', () => {
    updateMediaDeleteButton(deleteButton, block.images, track);
  });
  updateMediaDeleteButton(deleteButton, block.images, track);
  return deleteButton;
}

function carouselIndex(track: HTMLElement): number {
  const slideCount = track.children.length;
  if (slideCount <= 0) return 0;
  const slideWidth = Math.max(1, track.clientWidth);
  return Math.max(0, Math.min(slideCount - 1, Math.round(track.scrollLeft / slideWidth)));
}

function hasMeasuredCarouselTrack(track: HTMLElement): boolean {
  return track.children.length > 0 && track.clientWidth > 0;
}

function syncMediaCarousel(shell: HTMLElement, images: LedgerCardImage[], track: HTMLElement, stateId: string, options: { persist?: boolean } = {}): void {
  syncCarouselSlider(shell, track);
  if (options.persist !== false) saveCurrentCarouselSlide(shell, stateId);
  const index = carouselIndex(track);
  const deleteButton = shell.querySelector('.ledger-card-media-delete') as HTMLButtonElement | null;
  if (deleteButton) updateMediaDeleteButton(deleteButton, images, track);
  for (const button of Array.from(shell.querySelectorAll('.ledger-card-media-slide-button')) as HTMLButtonElement[]) {
    const active = button.dataset.slideIndex === String(index);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'true' : 'false');
  }
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
  if (!track || !hasMeasuredCarouselTrack(track)) return;
  saveLedgerCardMediaCarouselSlide(stateId, captureLedgerCardMediaHandoffState(shell).slideIndex, slideCount);
}

function hydrateCarouselSlide(shell: HTMLElement, stateId: string, images: LedgerCardImage[]): void {
  if (!stateId) return;
  const track = shell.querySelector('.ledger-card-media-track') as HTMLElement | null;
  const slideCount = track?.children.length ?? 0;
  const slideIndex = readLedgerCardMediaCarouselSlide(stateId, slideCount);
  let attempts = 0;
  const restore = () => {
    if (track && !hasMeasuredCarouselTrack(track) && attempts < 6) {
      attempts += 1;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
      else setTimeout(restore, 0);
      return;
    }
    restoreLedgerCardMediaHandoffState(shell, { slideIndex });
    if (track) syncMediaCarousel(shell, images, track, stateId);
    scheduleCanvasMediaOverlayRender();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
  else setTimeout(restore, 0);
}

function scrollCarouselTo(shell: HTMLElement, images: LedgerCardImage[], track: HTMLElement, index: number, stateId: string, behavior: ScrollBehavior): void {
  const slideCount = track.children.length;
  if (slideCount <= 0) return;
  const slideWidth = Math.max(1, track.clientWidth);
  const nextIndex = Math.max(0, Math.min(slideCount - 1, Math.round(index)));
  saveLedgerCardMediaCarouselSlide(stateId, nextIndex, slideCount);
  track.scrollTo({ left: nextIndex * slideWidth, behavior });
  syncMediaCarousel(shell, images, track, stateId);
  scheduleCanvasMediaOverlayRender();
}

function scrollCarousel(shell: HTMLElement, images: LedgerCardImage[], track: HTMLElement, direction: -1 | 1, stateId: string): void {
  const slideCount = track.children.length;
  if (slideCount <= 0) return;
  const currentIndex = carouselIndex(track);
  const nextIndex = (currentIndex + direction + slideCount) % slideCount;
  scrollCarouselTo(shell, images, track, nextIndex, stateId, 'smooth');
}

function bindSingleSlideSwipe(shell: HTMLElement, images: LedgerCardImage[], track: HTMLElement, stateId: string): void {
  let gesture: { pointerId: number; startX: number; startY: number; startIndex: number; horizontal: boolean } | null = null;

  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIndex: carouselIndex(track),
      horizontal: false
    };
    track.setPointerCapture?.(event.pointerId);
  });

  track.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.horizontal && Math.abs(deltaX) <= Math.abs(deltaY)) return;
    gesture.horizontal = true;
    event.preventDefault();
    const slideWidth = Math.max(1, track.clientWidth);
    const minLeft = Math.max(0, (gesture.startIndex - 1) * slideWidth);
    const maxLeft = Math.min((track.children.length - 1) * slideWidth, (gesture.startIndex + 1) * slideWidth);
    track.scrollLeft = Math.max(minLeft, Math.min(maxLeft, gesture.startIndex * slideWidth - deltaX));
  });

  const finish = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = gesture;
    gesture = null;
    track.releasePointerCapture?.(event.pointerId);
    const deltaX = event.clientX - current.startX;
    const threshold = Math.max(48, track.clientWidth * 0.18);
    const direction = current.horizontal && Math.abs(deltaX) >= threshold ? (deltaX < 0 ? 1 : -1) : 0;
    scrollCarouselTo(shell, images, track, current.startIndex + direction, stateId, 'smooth');
  };

  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', finish);
}

function renderSlideButton(image: LedgerCardImage, index: number, shell: HTMLElement, track: HTMLElement, stateId: string, images: LedgerCardImage[]): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ledger-card-media-slide-button';
  button.type = 'button';
  button.textContent = String(index + 1);
  button.dataset.slideIndex = String(index);
  button.dataset.imageSrc = image.src;
  button.setAttribute('aria-label', `Go to image ${index + 1}`);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    scrollCarouselTo(shell, images, track, index, stateId, 'auto');
  });
  return button;
}

export function renderLedgerCardMedia(block: Extract<LedgerMarkdownBlock, { kind: 'images' }>, options: LedgerCardMediaOptions = {}): HTMLElement {
  const isCarousel = block.images.length > 1;
  const externalCarouselDriver = options.carouselDriver === 'external';
  const persistedCarouselStateId = carouselStateId(block, options, isCarousel);
  const mediaSurface = options.mediaSurface ?? 'card';
  const shell = document.createElement('div');
  shell.className = [
    'ledger-card-media-shell',
    isCarousel ? 'ledger-card-media-carousel' : 'ledger-card-media-single',
    mediaSurface === 'thread' ? 'ledger-card-media-thread' : ''
  ].filter(Boolean).join(' ');
  shell.dataset.ledgerCardMedia = 'true';
  shell.dataset.wheelCapture = 'true';
  shell.dataset.carouselDriver = externalCarouselDriver ? 'external' : 'internal';
  if (persistedCarouselStateId) {
    shell.dataset.carouselStateId = persistedCarouselStateId;
    shell.dataset.carouselStartIndex = String(readLedgerCardMediaCarouselSlide(persistedCarouselStateId, block.images.length));
  }
  const sizeSource = block.images[0]?.src ?? '';
  shell.dataset.imageSizeId = sizeSource;
  applyPersistedDimensions(shell, dimensionsFor(sizeSource, options.imageSizes));
  if (mediaSurface !== 'thread') watchImageResize(shell, options, sizeSource);

  const track = document.createElement('div');
  track.className = 'ledger-card-media-track';
  track.setAttribute('aria-label', isCarousel ? 'Card image carousel' : 'Card image');
  if (!externalCarouselDriver) {
    track.addEventListener('scroll', () => {
      syncMediaCarousel(shell, block.images, track, persistedCarouselStateId);
      if (mediaSurface !== 'thread') scheduleCanvasMediaOverlayRender();
    }, { passive: true });
  }
  for (const [index, image] of block.images.entries()) {
    track.appendChild(renderMediaSlide(image, index, shell, options, isCarousel));
  }
  shell.appendChild(track);
  const threadResizeHandle = mediaSurface === 'thread' ? renderThreadImageResizeHandle(shell, options, sizeSource) : null;
  if (threadResizeHandle) shell.appendChild(threadResizeHandle);
  const cardResizeHandle = mediaSurface === 'card' ? renderCardImageResizeHandle(shell, options, sizeSource) : null;
  if (cardResizeHandle) shell.appendChild(cardResizeHandle);
  if (mediaSurface !== 'thread') {
    watchContainedImageSizing(shell);
    scheduleLedgerCardMediaLayout(shell);
  }

  if (isCarousel) {
    if (!externalCarouselDriver) bindSingleSlideSwipe(shell, block.images, track, persistedCarouselStateId);
    const progress = document.createElement('div');
    progress.className = 'ledger-card-media-progress';
    progress.setAttribute('aria-hidden', 'true');

    const thumb = document.createElement('div');
    thumb.className = 'ledger-card-media-progress-thumb';
    progress.appendChild(thumb);
    shell.appendChild(progress);

    const nav = document.createElement('div');
    nav.className = 'ledger-card-media-nav';

    const slideNav = document.createElement('div');
    slideNav.className = 'ledger-card-media-slide-nav';
    for (const [index, image] of block.images.entries()) {
      slideNav.appendChild(renderSlideButton(image, index, shell, track, persistedCarouselStateId, block.images));
    }

    const previous = document.createElement('button');
    previous.className = 'ledger-card-media-button';
    previous.type = 'button';
    previous.textContent = '‹';
    previous.setAttribute('aria-label', 'Previous image');
    previous.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(shell, block.images, track, -1, persistedCarouselStateId);
    });

    const next = document.createElement('button');
    next.className = 'ledger-card-media-button';
    next.type = 'button';
    next.textContent = '›';
    next.setAttribute('aria-label', 'Next image');
    next.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(shell, block.images, track, 1, persistedCarouselStateId);
    });

    const deleteButton = renderMediaDeleteButton(block, options, track);
    nav.replaceChildren(previous, next, ...(deleteButton ? [deleteButton] : []));
    shell.appendChild(slideNav);
    shell.appendChild(nav);
    if (!externalCarouselDriver) {
      watchCarouselSlider(shell, track);
      syncMediaCarousel(shell, block.images, track, persistedCarouselStateId, { persist: false });
      hydrateCarouselSlide(shell, persistedCarouselStateId, block.images);
    }
  }

  return shell;
}
