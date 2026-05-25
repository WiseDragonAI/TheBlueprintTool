import { modal, shortcutModal } from '../../dom.js';
import { state } from '../../state.js';
import { deleteZoneController } from '../../zone/controller/delete-zone-controller.js';
import { editRegionController } from '../../zone/controller/edit-region-controller.js';
import { createNoteController } from '../../thread/controller/create-note-controller.js';
import { deleteNoteController } from '../../thread/controller/delete-note-controller.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '../../voice/controller/stop-voice-recording.js';
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
    state.threadId = target?.dataset.threadId ?? 'conversation-ledger';
    if (action === 'open-card-thread' && target?.dataset.cardId) selectTarget('card', target.dataset.cardId, false);
    if (action === 'open-zone-thread' && target?.dataset.zoneId) selectTarget('zone', target.dataset.zoneId, false);
    if (target?.dataset.groupId) selectTarget('group', target.dataset.groupId, false);
    telemetry('resolve-thread-target', { threadId: state.threadId });
    renderThreadPanel();
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
    await deleteNoteController(state.threadId);
    renderThreadPanel();
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
