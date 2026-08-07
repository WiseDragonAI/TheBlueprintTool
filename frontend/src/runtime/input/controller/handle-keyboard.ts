/**
 * WHAT: Routes global keyboard shortcuts to runtime controllers.
 * WHY: Keyboard input must preserve canonical UI command flow, including modal confirmations.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { pasteSelectionController } from '../../clipboard/controller/paste-selection-controller.js';
import { resizeSelectedCardsController } from '../../card/controller/resize-selected-cards-controller.js';
import { confirmCardDeletionController } from '../../card/controller/confirm-card-deletion-controller.js';
import { confirmGroupDeletionController } from '../../group/controller/confirm-group-deletion-controller.js';
import { confirmZoneDeletionController } from '../../zone/controller/confirm-zone-deletion-controller.js';
import { deleteGroupController } from '../../group/controller/delete-group-controller.js';
import { deleteZoneController } from '../../zone/controller/delete-zone-controller.js';
import { deleteCardController } from '../../card/controller/delete-card-controller.js';
import { deleteCardImageController } from '../../card/controller/delete-card-image-controller.js';
import { deleteNoteController } from '../../thread/controller/delete-note-controller.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { openThreadPanel } from '../../thread/effect/open-thread-panel.js';
import { closeThreadPanel } from '../../thread/effect/close-thread-panel.js';
import { focusThreadDraft } from '../../thread/effect/focus-thread-draft.js';
import { submitThreadDraft } from '../../thread/effect/submit-thread-draft.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import { executeVoiceAction } from '../../voice/controller/execute-voice-action.js';
import { cancelVoiceRecording } from '../../voice/controller/cancel-voice-recording.js';
import { voiceLaunchModeForModifiers } from '../../voice/helper/voice-launch-mode.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { isCardEditingKeyboardTarget } from '../helper/is-card-editing-keyboard-target.js';
import { currentVoiceCaptureOwner } from '../../voice/helper/voice-capture-ownership.js';
import { dispatchRuntimeAction } from './handle-action-click.js';

export async function handleKeyboard(event: KeyboardEvent): Promise<void> {
  const target = event.target as HTMLElement | null;
  const key = event.key.toLowerCase();
  const editableTarget = target?.closest('input,textarea,select,[contenteditable="true"]');
  if (modal.open) {
    if (key === 'enter') {
      event.preventDefault();
      const confirmation = modal.querySelector('[data-action]:not([data-action="cancel-delete"])') as HTMLElement | null;
      if (confirmation?.dataset.action) {
        await dispatchRuntimeAction(confirmation, event);
        return;
      }
      if (modal.dataset.confirmKind === 'note') {
        await deleteNoteController({ threadId: modal.dataset.threadId ?? state.threadId, noteId: modal.dataset.noteId ?? '' });
      } else if (modal.dataset.confirmKind === 'card-image') {
        await deleteCardImageController({
          cardId: modal.dataset.cardId ?? '',
          imageSrc: modal.dataset.imageSrc ?? '',
          carouselSources: modal.dataset.carouselSources,
          carouselSlideIndex: modal.dataset.carouselSlideIndex
        });
      } else if (modal.dataset.confirmKind === 'card') {
        await deleteCardController({ cardId: modal.dataset.cardId ?? '' });
      } else if (modal.dataset.confirmKind === 'group') {
        await deleteGroupController({ groupId: modal.dataset.groupId ?? '' });
      } else {
        await deleteZoneController();
      }
      return;
    }
    if (key === 'escape') {
      event.preventDefault();
      const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLElement | null;
      if (cancel) await dispatchRuntimeAction(cancel, event);
      else modal.close?.();
      return;
    }
  }
  if (target?.closest('.thread-draft') && event.ctrlKey && key === 'enter') {
    event.preventDefault();
    const submit = target.closest('.terminal-composer')?.querySelector('[data-action="submit-thread-draft"]') as HTMLElement | null;
    if (submit) await dispatchRuntimeAction(submit, event);
    else await submitThreadDraft();
    return;
  }
  if (isCardEditingKeyboardTarget(target)) return;
  if (editableTarget && key !== 'escape') return;
  telemetry('keyboard-shortcut', { key, ctrlKey: event.ctrlKey });
  if (key === 'a') {
    event.preventDefault();
    if (state.threadPanelOpen) focusThreadDraft();
    else openThreadPanel();
    return;
  }
  if (key === 'x') {
    event.preventDefault();
    if (currentVoiceCaptureOwner()?.startsWith('git-review:')) return;
    if (!state.threadPanelOpen) openThreadPanel();
    const voiceToggle = document.querySelector('.thread-panel [data-action="voice-toggle"]') as HTMLElement | null;
    if (voiceToggle) await dispatchRuntimeAction(voiceToggle, event);
    else if (state.voice.recording) await executeVoiceAction({ launchMode: voiceLaunchModeForModifiers(event) });
    else void startVoiceRecording();
    return;
  }
  if (key === 'escape') {
    if (state.voice.recording) {
      cancelVoiceRecording();
      return;
    }
    if (state.threadPanelOpen || state.activeTool === 'thread') {
      const close = document.querySelector('.thread-close[data-action="close-thread-panel"]') as HTMLElement | null;
      if (close) await dispatchRuntimeAction(close, event);
      else closeThreadPanel();
      return;
    }
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    resetActiveTool('escape');
    telemetry('clear-transient-selection', { reason: 'escape' });
    renderCanvasSurface();
  }
  if (key === 'delete' && state.selection.groupIds.length > 0) {
    confirmGroupDeletionController();
    return;
  }
  if (key === 'delete' && state.selection.cardIds.length > 0) {
    confirmCardDeletionController({ cardId: state.selection.cardIds.at(-1) ?? '' });
    return;
  }
  if (key === 'delete' && state.selection.zoneIds.length > 0) {
    confirmZoneDeletionController();
  }
  if (event.ctrlKey && key === 'c') {
    state.clipboard = structuredClone(state.selection);
    telemetry('copy-selection-payload', state.clipboard);
  }
  if (event.ctrlKey && key === 'd') {
    event.preventDefault();
    const resize = document.querySelector('[data-action="resize"]') as HTMLElement | null;
    if (resize) await dispatchRuntimeAction(resize, event);
    else await resizeSelectedCardsController();
  }
  if (event.ctrlKey && key === 'v' && state.clipboard) {
    await pasteSelectionController();
  }
}
