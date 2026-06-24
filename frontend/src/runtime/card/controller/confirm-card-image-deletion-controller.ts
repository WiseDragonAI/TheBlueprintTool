/**
 * WHAT: Opens the shared confirmation modal for one markdown card image.
 * WHY: Carousel image deletion must use the same confirmed flow as cards, notes, and zones.
 */
import { modal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmCardImageDeletionController(input: { cardId: string; imageSrc: string; carouselSources?: string; carouselSlideIndex?: string }): void {
  telemetry('confirm-card-image-deletion-controller', input);
  modal.dataset.confirmKind = 'card-image';
  modal.dataset.cardId = input.cardId;
  modal.dataset.imageSrc = input.imageSrc;
  if (input.carouselSources) modal.dataset.carouselSources = input.carouselSources;
  else delete modal.dataset.carouselSources;
  if (input.carouselSlideIndex) modal.dataset.carouselSlideIndex = input.carouselSlideIndex;
  else delete modal.dataset.carouselSlideIndex;
  delete modal.dataset.groupId;
  delete modal.dataset.threadId;
  delete modal.dataset.noteId;
  const message = modal.querySelector('p');
  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
  if (message) message.textContent = 'Delete this image from the card and disk?';
  if (confirm) {
    confirm.dataset.action = 'delete-card-image';
    confirm.dataset.cardId = input.cardId;
    confirm.dataset.imageSrc = input.imageSrc;
    if (input.carouselSources) confirm.dataset.carouselSources = input.carouselSources;
    else delete confirm.dataset.carouselSources;
    if (input.carouselSlideIndex) confirm.dataset.carouselSlideIndex = input.carouselSlideIndex;
    else delete confirm.dataset.carouselSlideIndex;
    confirm.textContent = 'Delete image';
  }
  if (cancel) cancel.textContent = 'Cancel';
  modal.showModal?.();
  confirm?.focus();
}
