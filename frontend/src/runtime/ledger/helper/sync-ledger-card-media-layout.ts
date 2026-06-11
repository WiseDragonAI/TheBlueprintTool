export type LedgerCardMediaHandoffState = {
  slideIndex: number;
};

const resizePersistenceSuppressionMs = 700;
const suppressedResizePersistenceUntil = new WeakMap<HTMLElement, number>();

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function mediaTrack(shell: HTMLElement): HTMLElement | null {
  return shell.querySelector('.ledger-card-media-track') as HTMLElement | null;
}

export function suppressLedgerCardMediaResizePersistence(shell: HTMLElement, durationMs = resizePersistenceSuppressionMs): void {
  suppressedResizePersistenceUntil.set(shell, Math.max(suppressedResizePersistenceUntil.get(shell) ?? 0, now() + durationMs));
}

export function isLedgerCardMediaResizePersistenceSuppressed(shell: HTMLElement): boolean {
  return (suppressedResizePersistenceUntil.get(shell) ?? 0) > now();
}

function syncContainedImageSize(shell: HTMLElement, image: HTMLImageElement): void {
  const track = mediaTrack(shell);
  const slide = image.closest('.ledger-card-media-slide') as HTMLElement | null;
  const title = slide?.querySelector('.ledger-card-media-title') as HTMLElement | null;
  const titleHeight = title ? title.offsetHeight : 0;
  const frameWidth = track?.clientWidth || shell.clientWidth || shell.offsetWidth;
  const rawFrameHeight = slide?.clientHeight || track?.clientHeight || shell.clientHeight || shell.offsetHeight;
  const frameHeight = Math.max(1, rawFrameHeight - titleHeight);
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (!frameWidth || !frameHeight || !naturalWidth || !naturalHeight) return;

  const imageRatio = naturalWidth / naturalHeight;
  const frameRatio = frameWidth / frameHeight;
  const width = imageRatio > frameRatio ? frameWidth : frameHeight * imageRatio;
  const height = imageRatio > frameRatio ? frameWidth / imageRatio : frameHeight;
  image.style.setProperty('--ledger-card-media-contained-width', `${Math.max(1, Math.round(width))}px`);
  image.style.setProperty('--ledger-card-media-contained-height', `${Math.max(1, Math.round(height))}px`);
}

export function syncContainedImageSizes(shell: HTMLElement): void {
  for (const image of Array.from(shell.querySelectorAll('.ledger-card-media-image')) as HTMLImageElement[]) {
    syncContainedImageSize(shell, image);
  }
}

export function syncCarouselSlider(shell: HTMLElement, track = mediaTrack(shell)): void {
  if (!track) return;
  const slideCount = Math.max(1, track.children.length);
  const thumbWidth = slideCount > 1 ? Math.max(8, 100 / slideCount) : 100;
  const maxLeft = Math.max(0, 100 - thumbWidth);
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  const progress = maxScroll > 0 ? track.scrollLeft / maxScroll : 0;
  const thumbLeft = Math.min(maxLeft, Math.max(0, progress * maxLeft));
  shell.style.setProperty('--ledger-card-media-slider-thumb-width', `${thumbWidth}%`);
  shell.style.setProperty('--ledger-card-media-slider-thumb-left', `${thumbLeft}%`);
}

export function captureLedgerCardMediaHandoffState(shell: HTMLElement): LedgerCardMediaHandoffState {
  const track = mediaTrack(shell);
  const slideCount = track?.children.length ?? 0;
  if (!track || slideCount <= 0) return { slideIndex: 0 };
  const slideWidth = Math.max(1, track.clientWidth);
  const slideIndex = Math.max(0, Math.min(slideCount - 1, Math.round(track.scrollLeft / slideWidth)));
  return { slideIndex };
}

export function restoreLedgerCardMediaHandoffState(shell: HTMLElement, state: LedgerCardMediaHandoffState): void {
  const track = mediaTrack(shell);
  const slideCount = track?.children.length ?? 0;
  if (!track || slideCount <= 0) {
    syncContainedImageSizes(shell);
    return;
  }
  const slideIndex = Math.max(0, Math.min(slideCount - 1, state.slideIndex));
  track.scrollLeft = slideIndex * Math.max(1, track.clientWidth);
  syncContainedImageSizes(shell);
  syncCarouselSlider(shell, track);
}

export function scheduleLedgerCardMediaLayout(shell: HTMLElement): void {
  const run = () => {
    syncContainedImageSizes(shell);
    syncCarouselSlider(shell);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else setTimeout(run, 0);
}
