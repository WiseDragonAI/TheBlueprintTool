const storageKey = 'decision-os.cardMedia.carouselSlides';

function readStates(): Record<string, number> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const states = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return states && typeof states === 'object' && !Array.isArray(states)
      ? states as Record<string, number>
      : {};
  } catch {
    return {};
  }
}

function writeStates(states: Record<string, number>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(states));
  } catch {
    // Carousel state is cosmetic and must never block card rendering.
  }
}

function normalizeSlideIndex(slideIndex: number, slideCount = 0): number {
  if (!Number.isFinite(slideIndex)) return 0;
  const rounded = Math.max(0, Math.round(slideIndex));
  return slideCount > 0 ? Math.min(slideCount - 1, rounded) : rounded;
}

export function ledgerCardMediaCarouselStateId(options: { tabId?: string; cardId?: string; sources: readonly string[] }): string {
  const cardId = String(options.cardId ?? '').trim();
  const sources = options.sources.map((source) => String(source)).filter(Boolean);
  if (!cardId || sources.length <= 1) return '';
  return [String(options.tabId ?? ''), cardId, ...sources].map((part) => encodeURIComponent(part)).join('|');
}

export function readLedgerCardMediaCarouselSlide(stateId: string, slideCount = 0): number {
  if (!stateId) return 0;
  return normalizeSlideIndex(Number(readStates()[stateId]), slideCount);
}

export function saveLedgerCardMediaCarouselSlide(stateId: string, slideIndex: number, slideCount = 0): void {
  if (!stateId) return;
  const states = readStates();
  const normalized = normalizeSlideIndex(slideIndex, slideCount);
  if (normalized > 0) states[stateId] = normalized;
  else delete states[stateId];
  writeStates(states);
}

export function persistLedgerCardMediaCarouselDeleteHandoff(options: {
  tabId?: string;
  cardId?: string;
  imageSrc?: string;
  sources: readonly string[];
  slideIndex: number;
}): void {
  const cardId = String(options.cardId ?? '').trim();
  const imageSrc = String(options.imageSrc ?? '');
  const sources = options.sources.map((source) => String(source)).filter(Boolean);
  const selectedIndex = normalizeSlideIndex(options.slideIndex, sources.length);
  const deletedIndex = sources[selectedIndex] === imageSrc
    ? selectedIndex
    : sources.findIndex((source) => source === imageSrc);
  if (!cardId || deletedIndex < 0) return;
  const nextSources = sources.filter((_, index) => index !== deletedIndex);
  if (nextSources.length <= 1) return;
  const stateId = ledgerCardMediaCarouselStateId({ tabId: options.tabId, cardId, sources: nextSources });
  saveLedgerCardMediaCarouselSlide(stateId, options.slideIndex, nextSources.length);
}
