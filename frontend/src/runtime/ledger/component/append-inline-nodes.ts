import { type LedgerMarkdownInline } from '../helper/parse-ledger-card-markdown.js';
import { commitActiveLedgerMutation } from '../effect/commit-active-ledger-mutation.js';
import { state } from '../../state.js';
import { type LedgerCardImageSizes } from './render-ledger-card-media.js';

type InlineNodeOptions = {
  cardId?: string;
  imageSizes?: LedgerCardImageSizes;
};

const pendingInlineResizeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function currentCardImageSizes(cardId: string): LedgerCardImageSizes {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  const card = cards.find((entry) => String(entry.id ?? '') === cardId);
  return card?.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
    ? { ...(card.imageSizes as LedgerCardImageSizes) }
    : {};
}

function applyInlineImageSize(frame: HTMLElement, source: string, imageSizes: LedgerCardImageSizes = {}): void {
  const dimensions = imageSizes[source] ?? {};
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  if (Number.isFinite(width) && width > 0) frame.style.width = `${Math.max(48, width)}px`;
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    frame.style.setProperty('--ledger-card-inline-image-aspect-ratio', `${Math.max(1, width)} / ${Math.max(1, height)}`);
  }
}

function watchInlineImageResize(frame: HTMLElement, options: InlineNodeOptions, source: string): void {
  if (!options.cardId || typeof ResizeObserver === 'undefined') return;
  let initialized = false;
  const observer = new ResizeObserver(() => {
    if (!initialized) {
      initialized = true;
      return;
    }
    const width = Math.round(frame.offsetWidth);
    const height = Math.round(frame.offsetHeight);
    if (!width || !height) return;
    const previous = pendingInlineResizeTimers.get(frame);
    if (previous) clearTimeout(previous);
    pendingInlineResizeTimers.set(frame, setTimeout(() => {
      const imageSizes = currentCardImageSizes(options.cardId ?? '');
      const existing = imageSizes[source] ?? {};
      if (existing.width === width && existing.height === height) return;
      imageSizes[source] = { width, height };
      void commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: options.cardId ?? '', imageSizes } });
    }, 350));
  });
  observer.observe(frame);
}

export function appendInlineNodes(parent: HTMLElement, nodes: LedgerMarkdownInline[], options: InlineNodeOptions = {}): void {
  for (const node of nodes) {
    if (node.kind === 'text') {
      parent.appendChild(document.createTextNode(node.text));
      continue;
    }
    if (node.kind === 'image') {
      const frame = document.createElement('span');
      frame.className = 'ledger-card-inline-image-frame';
      frame.dataset.ledgerCardMedia = 'true';
      frame.dataset.imageSizeId = node.src;
      applyInlineImageSize(frame, node.src, options.imageSizes);
      watchInlineImageResize(frame, options, node.src);
      const image = document.createElement('img');
      image.className = 'ledger-card-inline-image';
      image.src = node.src;
      image.alt = node.alt;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.draggable = false;
      if (node.title) image.title = node.title;
      image.addEventListener('load', () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        frame.style.setProperty('--ledger-card-inline-image-aspect-ratio', `${image.naturalWidth} / ${image.naturalHeight}`);
      }, { once: true });
      if (image.complete && image.naturalWidth && image.naturalHeight) {
        frame.style.setProperty('--ledger-card-inline-image-aspect-ratio', `${image.naturalWidth} / ${image.naturalHeight}`);
      }
      frame.appendChild(image);
      parent.appendChild(frame);
      continue;
    }
    const child = document.createElement(node.kind);
    child.textContent = node.text;
    parent.appendChild(child);
  }
}
