import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { pasteSelectionController } from '../../clipboard/controller/paste-selection-controller.js';
import { confirmZoneDeletionController } from '../../zone/controller/confirm-zone-deletion-controller.js';
import { deleteZoneController } from '../../zone/controller/delete-zone-controller.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { openThreadPanel } from '../../thread/effect/open-thread-panel.js';
import { closeThreadPanel } from '../../thread/effect/close-thread-panel.js';
import { focusThreadDraft } from '../../thread/effect/focus-thread-draft.js';
import { submitThreadDraft } from '../../thread/effect/submit-thread-draft.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '../../voice/controller/stop-voice-recording.js';
import { cancelVoiceRecording } from '../../voice/controller/cancel-voice-recording.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function handleKeyboard(event: KeyboardEvent): Promise<void> {
  const target = event.target as HTMLElement | null;
  const key = event.key.toLowerCase();
  const editableTarget = target?.closest('input,textarea,select,[contenteditable="true"]');
  if (target?.closest('.thread-draft') && event.ctrlKey && key === 'enter') {
    event.preventDefault();
    await submitThreadDraft();
    return;
  }
  if (editableTarget && key !== 'escape' && !(key === 'a' && !state.threadPanelOpen)) return;
  telemetry('keyboard-shortcut', { key, ctrlKey: event.ctrlKey });
  if (key === 'a') {
    event.preventDefault();
    if (state.threadPanelOpen) focusThreadDraft();
    else openThreadPanel();
    return;
  }
  if (key === 'x') {
    event.preventDefault();
    if (!state.threadPanelOpen) openThreadPanel();
    if (state.voice.recording) await stopVoiceRecording();
    else void startVoiceRecording();
    return;
  }
  if (key === 'escape') {
    if (state.voice.recording) {
      cancelVoiceRecording();
      return;
    }
    if (state.threadPanelOpen || state.activeTool === 'thread') {
      closeThreadPanel();
      return;
    }
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    resetActiveTool('escape');
    telemetry('clear-transient-selection', { reason: 'escape' });
    renderCanvasSurface();
  }
  if (key === 'delete' && state.selection.zoneIds.length > 0) {
    confirmZoneDeletionController();
  }
  if (event.ctrlKey && key === 'c') {
    state.clipboard = structuredClone(state.selection);
    telemetry('copy-selection-payload', state.clipboard);
  }
  if (event.ctrlKey && key === 'v' && state.clipboard) {
    await pasteSelectionController();
  }
  if (modal.open && key === 'enter') await deleteZoneController();
  if (modal.open && key === 'escape') modal.close?.();
}
