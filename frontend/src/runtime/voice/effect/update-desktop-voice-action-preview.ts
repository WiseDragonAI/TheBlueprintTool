/**
 * WHAT: Previews the launch action selected by desktop keyboard modifiers.
 * WHY: Operators need to see what X will do before stopping an active recording.
 */
import { state } from '../../state.js';
import { voiceActionIcon, type VoiceLaunchMode } from '../component/control-dock.js';

let bound = false;

export function voiceLaunchModeForModifiers(input: { ctrlKey?: boolean; shiftKey?: boolean }): VoiceLaunchMode {
  if (input.ctrlKey) return 'pipeline';
  if (input.shiftKey) return 'run';
  return 'send';
}

export function updateDesktopVoiceActionPreview(input: { ctrlKey?: boolean; shiftKey?: boolean } = {}): void {
  const button = document.querySelector('.voice-action--send') as HTMLButtonElement | null;
  if (!button) return;
  const desktop = !window.matchMedia('(max-width: 760px)').matches;
  const mode = state.voice.recording && desktop ? voiceLaunchModeForModifiers(input) : 'send';
  if (button.dataset.launchMode === mode) return;
  const icon = button.querySelector('.terminal-button__icon');
  const label = button.querySelector('.terminal-button__label');
  if (icon) icon.outerHTML = voiceActionIcon(mode);
  if (label) label.textContent = mode.toUpperCase();
  button.dataset.launchMode = mode;
}

export function bindDesktopVoiceActionPreview(): void {
  if (bound) return;
  bound = true;
  document.addEventListener('keydown', updateDesktopVoiceActionPreview);
  document.addEventListener('keyup', updateDesktopVoiceActionPreview);
  window.addEventListener('blur', () => updateDesktopVoiceActionPreview());
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => updateDesktopVoiceActionPreview());
}
