type InteractDragEvent = {
  dx: number;
  target: HTMLElement;
};

type InteractFactory = ((target: string) => {
  draggable(options: {
    inertia: boolean;
    listeners: {
      start(event: InteractDragEvent): void;
      move(event: InteractDragEvent): void;
      end(event: InteractDragEvent): void;
    };
  }): unknown;
});

declare global {
  var interact: InteractFactory | undefined;
}

type ResizeState = {
  inputScale: number;
  localWidth: number;
  renderedWidthScale: number;
};

const handleSelector = '.ledger-card-media-resize-handle';
const resizeStates = new WeakMap<HTMLElement, ResizeState>();
let interactionBound = false;

function resizeShell(handle: HTMLElement): HTMLElement | null {
  return handle.closest('.ledger-card-media-shell') as HTMLElement | null;
}

function promotionScale(shell: HTMLElement): number {
  const scale = Number(shell.dataset.mediaPromotionScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function transformedScale(shell: HTMLElement): number {
  const width = Math.max(1, shell.offsetWidth);
  const renderedWidth = shell.getBoundingClientRect().width;
  const scale = renderedWidth / width;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function localMaxWidth(shell: HTMLElement): number {
  const promotedMaxWidth = Number(shell.dataset.mediaLocalMaxWidth);
  if (Number.isFinite(promotedMaxWidth) && promotedMaxWidth > 0) return promotedMaxWidth;
  return Math.max(140, shell.parentElement?.clientWidth || shell.offsetWidth || 140);
}

function startResize(handle: HTMLElement): void {
  const shell = resizeShell(handle);
  if (!shell) return;
  const promoted = shell.dataset.mediaPromoted === 'true';
  const renderedWidthScale = promoted ? promotionScale(shell) : 1;
  resizeStates.set(handle, {
    inputScale: promoted ? renderedWidthScale : transformedScale(shell),
    localWidth: shell.offsetWidth / renderedWidthScale,
    renderedWidthScale
  });
  shell.dataset.mediaResizing = 'true';
}

function moveResize(handle: HTMLElement, deltaX: number): void {
  const shell = resizeShell(handle);
  const resize = resizeStates.get(handle);
  if (!shell || !resize) return;
  resize.localWidth = Math.min(localMaxWidth(shell), Math.max(140, resize.localWidth + deltaX / resize.inputScale));
  shell.style.width = `${Math.round(resize.localWidth * resize.renderedWidthScale)}px`;
}

function finishResize(handle: HTMLElement): void {
  const shell = resizeShell(handle);
  resizeStates.delete(handle);
  if (!shell) return;
  delete shell.dataset.mediaResizing;
  shell.dispatchEvent(new CustomEvent('ledger-card-media-resize-commit'));
}

export function ensureLedgerCardMediaResizeInteraction(): void {
  if (interactionBound || typeof globalThis.interact !== 'function') return;
  interactionBound = true;
  globalThis.interact(handleSelector).draggable({
    inertia: false,
    listeners: {
      start: (event) => startResize(event.target),
      move: (event) => moveResize(event.target, event.dx),
      end: (event) => finishResize(event.target)
    }
  });
}

export function resizeLedgerCardMediaFromKeyboard(handle: HTMLElement, direction: -1 | 1): void {
  const shell = resizeShell(handle);
  if (!shell) return;
  startResize(handle);
  const resize = resizeStates.get(handle);
  if (resize) moveResize(handle, direction * 16 * resize.inputScale);
  finishResize(handle);
}
