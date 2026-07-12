/**
 * WHAT: Opens one carousel image in an isolated fullscreen pan-and-zoom dialog.
 * WHY: Card carousel state stays owned by decision-os while Panzoom owns gesture normalization and cleanup.
 */
import Panzoom from '../../../../assets/vendor/panzoom-4.6.2.es.js';

type PanzoomInstance = {
  destroy: () => void;
  zoomWithWheel: (event: WheelEvent) => void;
};

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLDialogElement): void {
  if (event.key !== 'Tab') return;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls.at(-1) ?? first;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openLedgerCardImageViewer(input: { alt: string; source: string; trigger: HTMLButtonElement }): void {
  const { alt, source, trigger } = input;
  const previousBodyOverflow = document.body.style.overflow;
  const dialog = document.createElement('dialog');
  dialog.className = 'ledger-card-image-viewer';
  dialog.setAttribute('aria-label', alt ? `Fullscreen image: ${alt}` : 'Fullscreen carousel image');

  const stage = document.createElement('div');
  stage.className = 'ledger-card-image-viewer-stage';

  const image = document.createElement('img');
  image.className = 'ledger-card-image-viewer-image';
  image.src = source;
  image.alt = alt;
  image.draggable = false;
  stage.appendChild(image);

  const closeButton = document.createElement('button');
  closeButton.className = 'ledger-card-image-viewer-close terminal-button';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close fullscreen image');
  dialog.append(stage, closeButton);
  document.body.appendChild(dialog);

  const panzoom = Panzoom(image, {
    minScale: 0.3,
    maxScale: 50,
    startScale: 1,
    cursor: 'grab'
  }) as PanzoomInstance;

  const stopViewerGesture = (event: Event) => event.stopPropagation();
  const zoomWithWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    panzoom.zoomWithWheel(event);
  };
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    trapDialogFocus(event, dialog);
  };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    stage.removeEventListener('wheel', zoomWithWheel);
    dialog.removeEventListener('pointerdown', stopViewerGesture);
    dialog.removeEventListener('pointermove', stopViewerGesture);
    dialog.removeEventListener('pointerup', stopViewerGesture);
    dialog.removeEventListener('keydown', handleKeydown);
    panzoom.destroy();
    dialog.close();
    dialog.remove();
    document.body.style.overflow = previousBodyOverflow;
    trigger.focus();
  };

  stage.addEventListener('wheel', zoomWithWheel, { passive: false });
  dialog.addEventListener('pointerdown', stopViewerGesture);
  dialog.addEventListener('pointermove', stopViewerGesture);
  dialog.addEventListener('pointerup', stopViewerGesture);
  dialog.addEventListener('keydown', handleKeydown);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  }, { once: true });
  closeButton.addEventListener('click', close, { once: true });

  document.body.style.overflow = 'hidden';
  dialog.showModal();
  closeButton.focus();
}
