/**
 * WHAT: Routes toolbar and inline action clicks into runtime controllers.
 * WHY: Input action dispatch is the canonical control flow for UI command buttons.
 */
import { modal, runbookModal, shortcutModal } from '../../dom.js';
import { state } from '../../state.js';
import { switchCardTabController } from '../../card/controller/switch-card-tab-controller.js';
import { resizeSelectedCardsController } from '../../card/controller/resize-selected-cards-controller.js';
import { beginLedgerCardTitleEdit } from '../../card/effect/begin-ledger-card-edit.js';
import { toggleCardStatusController } from '../../card/controller/toggle-card-status-controller.js';
import { deleteZoneController } from '../../zone/controller/delete-zone-controller.js';
import { editRegionController } from '../../zone/controller/edit-region-controller.js';
import { confirmGroupDeletionController } from '../../group/controller/confirm-group-deletion-controller.js';
import { deleteGroupController } from '../../group/controller/delete-group-controller.js';
import { confirmCardDeletionController } from '../../card/controller/confirm-card-deletion-controller.js';
import { deleteCardController } from '../../card/controller/delete-card-controller.js';
import { confirmCardImageDeletionController } from '../../card/controller/confirm-card-image-deletion-controller.js';
import { deleteCardImageController } from '../../card/controller/delete-card-image-controller.js';
import { createNoteController } from '../../thread/controller/create-note-controller.js';
import { deleteNoteController } from '../../thread/controller/delete-note-controller.js';
import { confirmNoteDeletionController } from '../../thread/controller/confirm-note-deletion-controller.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { openThreadPanel } from '../../thread/effect/open-thread-panel.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '../../voice/controller/stop-voice-recording.js';
import { cancelVoiceRecording } from '../../voice/controller/cancel-voice-recording.js';
import { retryVoiceTranscription } from '../../voice/effect/retry-voice-transcription.js';
import { enterLedgersCanvasController } from '../../navigation/controller/enter-ledgers-canvas-controller.js';
import { applyRailCollapsedState } from '../../toolbox/effect/apply-rail-collapsed-state.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

function toggleRail(button: HTMLElement): void {
  const collapsed = !state.railCollapsed;
  applyRailCollapsedState(collapsed, button);
  persistState();
  telemetry('toggle-toolbox-rail', { collapsed });
}

export async function handleActionClick(event: MouseEvent): Promise<void> {
  const targetElement = event.target as HTMLElement;
  const actionTarget = targetElement.closest('[data-action]') as HTMLElement | null;
  const action = actionTarget?.dataset.action;
  if (!action) return;
  telemetry('tool-button-click', { action });
  if (action === 'open-ledgers-canvas') {
    await enterLedgersCanvasController();
    return;
  }
  if (action === 'toggle-rail') {
    toggleRail(actionTarget);
    return;
  }
  if (action === 'switch-card-tab') {
    const card = actionTarget.closest('.card[data-card-id]') as HTMLElement | null;
    const tab = actionTarget.dataset.cardTab === 'fields' ? 'fields' : 'description';
    if (card) switchCardTabController(card, tab);
    return;
  }
  if (action === 'resize') {
    await resizeSelectedCardsController();
    return;
  }
  if (action === 'open-card-thread' || action === 'open-zone-thread' || action === 'conversation') {
    const target = targetElement.closest('[data-card-id],[data-zone-id],[data-group-id]') as HTMLElement | null;
    if (action === 'conversation') state.activeTool = 'thread';
    selectThread(target?.dataset.threadId ?? 'conversation-ledger');
    if (action === 'open-card-thread' && target?.dataset.cardId) selectTarget('card', target.dataset.cardId, false);
    if (action === 'open-zone-thread' && target?.dataset.zoneId) selectTarget('zone', target.dataset.zoneId, false);
    if (target?.dataset.groupId) selectTarget('group', target.dataset.groupId, false);
    telemetry('resolve-thread-target', { threadId: state.threadId });
    openThreadPanel();
  }
  if (action === 'voice-toggle') {
    if (state.voice.recording) await stopVoiceRecording();
    else void startVoiceRecording();
  }
  if (action === 'voice-cancel') cancelVoiceRecording();
  if (action === 'voice-retry') {
    await retryVoiceTranscription({ threadId: actionTarget.dataset.threadId ?? state.threadId, noteId: actionTarget.dataset.noteId ?? '', voiceFileRef: actionTarget.dataset.voiceFileRef ?? '' });
    return;
  }
  if (action === 'confirm-delete-card') {
    confirmCardDeletionController({ cardId: actionTarget.dataset.cardId ?? '' });
    return;
  }
  if (action === 'confirm-delete-card-image') {
    confirmCardImageDeletionController({
      cardId: actionTarget.dataset.cardId ?? '',
      imageSrc: actionTarget.dataset.imageSrc ?? '',
      carouselSources: actionTarget.dataset.carouselSources,
      carouselSlideIndex: actionTarget.dataset.carouselSlideIndex
    });
    return;
  }
  if (action === 'toggle-card-status') {
    const status = actionTarget.dataset.nextStatus === 'todo' ? 'todo' : 'done';
    await toggleCardStatusController({ cardId: actionTarget.dataset.cardId ?? '', status });
    return;
  }
  if (action === 'edit-card-title') {
    const cardId = actionTarget.dataset.cardId ?? '';
    const card = cardId
      ? document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null
      : targetElement.closest('[data-card-id]') as HTMLElement | null;
    if (card) beginLedgerCardTitleEdit(card);
    return;
  }
  if (action === 'delete-card') {
    await deleteCardController({ cardId: actionTarget.dataset.cardId ?? modal.dataset.cardId ?? '' });
    renderThreadPanel();
    return;
  }
  if (action === 'delete-card-image') {
    await deleteCardImageController({
      cardId: actionTarget.dataset.cardId ?? modal.dataset.cardId ?? '',
      imageSrc: actionTarget.dataset.imageSrc ?? modal.dataset.imageSrc ?? '',
      carouselSources: actionTarget.dataset.carouselSources ?? modal.dataset.carouselSources,
      carouselSlideIndex: actionTarget.dataset.carouselSlideIndex ?? modal.dataset.carouselSlideIndex
    });
    renderThreadPanel();
    return;
  }
  if (action === 'confirm-delete-group') {
    confirmGroupDeletionController({ groupId: actionTarget.dataset.groupId ?? '' });
    return;
  }
  if (action === 'delete-group') {
    await deleteGroupController({ groupId: actionTarget.dataset.groupId ?? modal.dataset.groupId ?? '' });
    renderThreadPanel();
    return;
  }
  if (action === 'edit-zone') {
    const zone = actionTarget.dataset.zoneId
      ? document.querySelector(`[data-zone-id="${CSS.escape(actionTarget.dataset.zoneId)}"]`) as HTMLElement | null
      : actionTarget.dataset.groupId
        ? document.querySelector(`[data-group-id="${CSS.escape(actionTarget.dataset.groupId)}"]`) as HTMLElement | null
        : targetElement.closest('[data-zone-id],[data-group-id]') as HTMLElement | null;
    editRegionController(zone);
  }
  if (action === 'create-note') {
    await createNoteController({ threadId: state.threadId, body: (document.querySelector('.thread-draft') as HTMLTextAreaElement).value });
    renderThreadPanel();
  }
  if (action === 'delete-note') {
    await deleteNoteController({
      threadId: actionTarget.dataset.threadId ?? modal.dataset.threadId ?? state.threadId,
      noteId: actionTarget.dataset.noteId ?? modal.dataset.noteId ?? ''
    });
    renderThreadPanel();
    return;
  }
  if (action === 'confirm-delete-note') {
    confirmNoteDeletionController({
      threadId: actionTarget.dataset.threadId ?? state.threadId,
      noteId: actionTarget.dataset.noteId ?? ''
    });
    return;
  }
  if (action === 'voice-start') {
    void startVoiceRecording();
  }
  if (action === 'voice-stop') {
    await stopVoiceRecording();
  }
  if (action === 'confirm-delete') await deleteZoneController();
  if (action === 'cancel-delete') modal.close?.();
  if (action === 'shortcut-help') {
    telemetry('open-shortcut-help', { shortcuts: ['A', 'X', 'Escape', 'Delete', 'Ctrl+C', 'Ctrl+V', 'Ctrl+D'] });
    shortcutModal.showModal?.();
    return;
  }
  if (action === 'close-shortcut-help') {
    shortcutModal.close?.();
    return;
  }
  if (action === 'runbook') {
    telemetry('open-runbook', { sections: ['workspace-server', 'card-images', 'voice-notes'] });
    runbookModal.showModal?.();
    return;
  }
  if (action === 'close-runbook') {
    runbookModal.close?.();
    return;
  }
  if (action === 'refresh') {
    void refreshRuntimeState();
  }
}
