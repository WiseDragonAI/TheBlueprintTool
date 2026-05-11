import { modal, shortcutModal } from '../dom.js';
import { state } from '../state.js';
import { deleteSelectedZones } from './delete-selected-zones.js';
import { beginZoneLabelEdit } from './begin-zone-label-edit.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { refreshRuntimeState } from './refresh-runtime-state.js';
import { selectTarget } from './select-target.js';
import { startVoiceRecording } from './start-voice-recording.js';
import { stopVoiceRecording } from './stop-voice-recording.js';
import { telemetry } from './telemetry.js';

export function handleActionClick(event: MouseEvent): void {
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
    target?.querySelectorAll('.card-tabs button').forEach((button) => button.classList.toggle('active', button === actionTarget));
    telemetry('resolve-thread-target', { threadId: state.threadId });
    renderThreadPanel();
  }
  if (action === 'open-card-data') {
    const target = targetElement.closest('[data-card-id]') as HTMLElement | null;
    target?.querySelectorAll('.card-tabs button').forEach((button) => button.classList.toggle('active', button === actionTarget));
    telemetry('open-card-data-panel', { cardId: target?.dataset.cardId });
  }
  if (action === 'edit-zone') {
    const zone = targetElement.closest('[data-zone-id]') as HTMLElement | null;
    if (zone?.dataset.zoneId) selectTarget('zone', zone.dataset.zoneId, false);
    telemetry('open-zone-edit-panel', { zoneId: zone?.dataset.zoneId });
    if (zone) beginZoneLabelEdit(zone);
  }
  if (action === 'create-note') {
    telemetry('commit-ledger-edit', { threadId: state.threadId, note: (document.querySelector('.thread-draft') as HTMLTextAreaElement).value });
    renderThreadPanel();
  }
  if (action === 'delete-note') {
    telemetry('commit-ledger-edit', { threadId: state.threadId, deleteMarker: true });
    renderThreadPanel();
  }
  if (action === 'voice-start') {
    void startVoiceRecording();
  }
  if (action === 'voice-stop') {
    stopVoiceRecording();
  }
  if (action === 'confirm-delete') deleteSelectedZones();
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
