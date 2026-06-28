import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import {
  captureLedgerCardMediaHandoffState,
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

type LedgerCardHtmlEmbed = Extract<LedgerMarkdownBlock, { kind: 'htmlEmbeds' }>['embeds'][number];
type LedgerCardHtmlEmbedOptions = {
  cardId?: string;
  mediaSurface?: 'card' | 'thread';
};

function activeLedgerStem(): string {
  const activeTab = String(state.activeTab ?? '');
  const ledgerFile = String((state.ledgerTabs ?? []).find((tab: { id?: string }) => String(tab.id ?? '') === activeTab)?.ledgerFile ?? '');
  const filename = ledgerFile.split('/').filter(Boolean).at(-1) ?? activeTab;
  return filename.replace(/\.[^.]+$/, '') || activeTab;
}

function decodeSource(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

function normalizeHtmlEmbedSource(source: string): string | null {
  const decoded = decodeSource(source).split('#')[0]?.split('?')[0] ?? '';
  const normalized = decoded.startsWith('/.blueprinttool/')
    ? decoded.slice(1)
    : decoded.startsWith('./.blueprinttool/')
      ? decoded.slice(2)
      : decoded.startsWith('.blueprinttool/')
        ? decoded
        : '';
  const ledgerStem = activeLedgerStem().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const allowedPrefix = `.blueprinttool/cards/${ledgerStem}/assets/`;
  if (!normalized.startsWith(allowedPrefix) || !normalized.toLowerCase().endsWith('.html')) return null;
  if (normalized.split('/').some((segment) => segment === '..' || segment === '')) return null;
  return normalized;
}

function browserUrlForWorkspacePath(path: string): string {
  return `/${path.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
}

function titleFromSource(source: string): string {
  const cleanSource = source.split('#')[0]?.split('?')[0] ?? source;
  const filename = cleanSource.split('/').filter(Boolean).at(-1) ?? cleanSource;
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
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

function watchCarouselSlider(shell: HTMLElement, track: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => syncCarouselSlider(shell, track));
  observer.observe(shell);
  observer.observe(track);
}

function syncHtmlCarousel(shell: HTMLElement, track: HTMLElement, stateId: string, options: { persist?: boolean } = {}): void {
  syncCarouselSlider(shell, track);
  if (options.persist !== false) saveCurrentCarouselSlide(shell, stateId);
  const index = carouselIndex(track);
  for (const button of Array.from(shell.querySelectorAll('.ledger-card-media-slide-button')) as HTMLButtonElement[]) {
    const active = button.dataset.slideIndex === String(index);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'true' : 'false');
  }
}

function carouselStateId(embeds: LedgerCardHtmlEmbed[], options: LedgerCardHtmlEmbedOptions, isCarousel: boolean): string {
  if (!isCarousel) return '';
  return ledgerCardMediaCarouselStateId({
    tabId: String(state.activeTab ?? ''),
    cardId: options.cardId,
    sources: embeds.map((embed) => embed.src)
  });
}

function saveCurrentCarouselSlide(shell: HTMLElement, stateId: string): void {
  if (!stateId) return;
  const track = shell.querySelector('.ledger-card-media-track') as HTMLElement | null;
  const slideCount = track?.children.length ?? 0;
  if (!track || !hasMeasuredCarouselTrack(track)) return;
  saveLedgerCardMediaCarouselSlide(stateId, captureLedgerCardMediaHandoffState(shell).slideIndex, slideCount);
}

function hydrateCarouselSlide(shell: HTMLElement, stateId: string): void {
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
    if (track) syncHtmlCarousel(shell, track, stateId);
    scheduleCanvasMediaOverlayRender();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
  else setTimeout(restore, 0);
}

function scrollCarouselTo(shell: HTMLElement, track: HTMLElement, index: number, stateId: string, behavior: ScrollBehavior): void {
  const slideCount = track.children.length;
  if (slideCount <= 0) return;
  const slideWidth = Math.max(1, track.clientWidth);
  const nextIndex = Math.max(0, Math.min(slideCount - 1, Math.round(index)));
  saveLedgerCardMediaCarouselSlide(stateId, nextIndex, slideCount);
  track.scrollTo({ left: nextIndex * slideWidth, behavior });
  syncHtmlCarousel(shell, track, stateId);
  scheduleCanvasMediaOverlayRender();
}

function scrollCarousel(shell: HTMLElement, track: HTMLElement, direction: -1 | 1, stateId: string): void {
  const slideCount = track.children.length;
  if (slideCount <= 0) return;
  const currentIndex = carouselIndex(track);
  const nextIndex = (currentIndex + direction + slideCount) % slideCount;
  scrollCarouselTo(shell, track, nextIndex, stateId, 'smooth');
}

function renderSlideButton(embed: LedgerCardHtmlEmbed, index: number, shell: HTMLElement, track: HTMLElement, stateId: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ledger-card-media-slide-button';
  button.type = 'button';
  button.textContent = String(index + 1);
  button.dataset.slideIndex = String(index);
  button.dataset.htmlSrc = embed.src;
  button.setAttribute('aria-label', `Go to HTML embed ${index + 1}`);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    scrollCarouselTo(shell, track, index, stateId, 'auto');
  });
  return button;
}

function renderHtmlSlide(embed: LedgerCardHtmlEmbed, index: number): HTMLElement {
  const slide = document.createElement('figure');
  slide.className = 'ledger-card-media-slide ledger-card-html-slide';
  slide.setAttribute('aria-label', embed.title || `HTML embed ${index + 1}`);
  const normalizedSource = normalizeHtmlEmbedSource(embed.src);
  const titleText = (embed.title || titleFromSource(embed.src)).trim();

  if (normalizedSource) {
    const iframe = document.createElement('iframe');
    iframe.className = 'ledger-card-html-frame';
    iframe.src = browserUrlForWorkspacePath(normalizedSource);
    iframe.title = titleText || `HTML embed ${index + 1}`;
    iframe.sandbox.add('allow-scripts', 'allow-same-origin');
    iframe.loading = 'lazy';
    slide.appendChild(iframe);
  } else {
    const invalid = document.createElement('div');
    invalid.className = 'ledger-card-html-invalid';
    invalid.textContent = 'HTML embed must live under the active ledger card assets directory.';
    slide.appendChild(invalid);
  }

  if (titleText) {
    const caption = document.createElement('figcaption');
    caption.className = 'ledger-card-media-title';
    caption.textContent = titleText;
    slide.appendChild(caption);
  }
  return slide;
}

export function renderLedgerCardHtmlEmbeds(block: Extract<LedgerMarkdownBlock, { kind: 'htmlEmbeds' }>, options: LedgerCardHtmlEmbedOptions = {}): HTMLElement {
  const isCarousel = block.embeds.length > 1;
  const persistedCarouselStateId = carouselStateId(block.embeds, options, isCarousel);
  const mediaSurface = options.mediaSurface ?? 'card';
  const shell = document.createElement('div');
  shell.className = [
    'ledger-card-media-shell',
    'ledger-card-html-shell',
    isCarousel ? 'ledger-card-media-carousel' : 'ledger-card-media-single',
    mediaSurface === 'thread' ? 'ledger-card-media-thread' : ''
  ].filter(Boolean).join(' ');
  shell.dataset.ledgerCardMedia = 'true';
  shell.dataset.wheelCapture = 'true';

  const track = document.createElement('div');
  track.className = 'ledger-card-media-track';
  track.setAttribute('aria-label', isCarousel ? 'Card HTML embed carousel' : 'Card HTML embed');
  track.addEventListener('scroll', () => {
    syncHtmlCarousel(shell, track, persistedCarouselStateId);
    if (mediaSurface !== 'thread') scheduleCanvasMediaOverlayRender();
  }, { passive: true });
  for (const [index, embed] of block.embeds.entries()) {
    track.appendChild(renderHtmlSlide(embed, index));
  }
  shell.appendChild(track);
  if (mediaSurface !== 'thread') scheduleLedgerCardMediaLayout(shell);

  if (isCarousel) {
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
    for (const [index, embed] of block.embeds.entries()) {
      slideNav.appendChild(renderSlideButton(embed, index, shell, track, persistedCarouselStateId));
    }

    const previous = document.createElement('button');
    previous.className = 'ledger-card-media-button';
    previous.type = 'button';
    previous.textContent = '<';
    previous.setAttribute('aria-label', 'Previous HTML embed');
    previous.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(shell, track, -1, persistedCarouselStateId);
    });

    const next = document.createElement('button');
    next.className = 'ledger-card-media-button';
    next.type = 'button';
    next.textContent = '>';
    next.setAttribute('aria-label', 'Next HTML embed');
    next.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollCarousel(shell, track, 1, persistedCarouselStateId);
    });

    nav.replaceChildren(previous, next);
    shell.appendChild(slideNav);
    shell.appendChild(nav);
    watchCarouselSlider(shell, track);
    syncHtmlCarousel(shell, track, persistedCarouselStateId, { persist: false });
    hydrateCarouselSlide(shell, persistedCarouselStateId);
  }

  return shell;
}
