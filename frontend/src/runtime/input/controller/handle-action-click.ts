/**
 * WHAT: Routes toolbar and inline action clicks into runtime controllers.
 * WHY: Input action dispatch is the canonical control flow for UI command buttons.
 */
import { modal, shortcutModal } from '../../dom.js';
import { state } from '../../state.js';
import { deleteZoneController } from '../../zone/controller/delete-zone-controller.js';
import { editRegionController } from '../../zone/controller/edit-region-controller.js';
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
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function handleActionClick(event: MouseEvent): Promise<void> {
  const targetElement = event.target as HTMLElement;
  const actionTarget = targetElement.closest('[data-action]') as HTMLElement | null;
  const action = actionTarget?.dataset.action;
  if (!action) return;
  telemetry('tool-button-click', { action });
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
    await retryVoiceTranscription({ noteId: actionTarget.dataset.noteId ?? '', voiceFileRef: actionTarget.dataset.voiceFileRef ?? '' });
    return;
  }
  if (action === 'edit-zone') {
    const zone = targetElement.closest('[data-zone-id],[data-group-id]') as HTMLElement | null;
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
    telemetry('open-shortcut-help', { shortcuts: ['Escape', 'Delete', 'Ctrl+C', 'Ctrl+V'] });
    shortcutModal.showModal?.();
  }
  if (action === 'close-shortcut-help') shortcutModal.close?.();
  if (action === 'refresh') {
    void refreshRuntimeState();
  }
}
