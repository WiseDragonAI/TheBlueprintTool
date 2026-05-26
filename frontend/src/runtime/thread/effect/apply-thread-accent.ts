/**
 * WHAT: Applies the active thread target color to the terminal side panel.
 * WHY: Card and zone conversations should retain the visual identity of their canvas target.
 */
import { state } from '../../state.js';
import { clampCardCodeColor } from '../../card/effect/render-card-zone-colors.js';
import { colorToRgbChannels } from '../helper/color-to-rgb-channels.js';
import { resolveThreadTargetAccent } from '../helper/resolve-thread-target-accent.js';

export function applyThreadAccent(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement | null;
  if (!panel?.style) return;
  const inspector = document.querySelector('.panel') as HTMLElement | null;
  const threadId = String(state.threadId ?? '');
  const escapedThreadId = globalThis.CSS?.escape ? CSS.escape(threadId) : threadId.replace(/["\\]/g, '\\$&');
  const target = threadId ? document.querySelector(`[data-thread-id="${escapedThreadId}"]`) as HTMLElement | null : null;
  const color = resolveThreadTargetAccent(target);
  const rgb = colorToRgbChannels(color) ?? '255, 112, 67';
  const codeColor = clampCardCodeColor(color) ?? color;
  panel.style.setProperty('--thread-accent', color);
  panel.style.setProperty('--thread-code-color', codeColor);
  panel.style.setProperty('--card-code-color', codeColor);
  panel.style.setProperty('--workspace-secondary-rgb', rgb);
  panel.style.setProperty('--workspace-primary-rgb', rgb);
  panel.style.setProperty('--voice-workspace-secondary', color);
  panel.style.setProperty('--voice-workspace-primary', color);
  panel.style.setProperty('--voice-graph-secondary', `color-mix(in srgb, ${color}, #05070d 76%)`);
  inspector?.style.setProperty('--thread-accent', color);
  inspector?.style.setProperty('--thread-code-color', codeColor);
  inspector?.style.setProperty('--card-code-color', codeColor);
}
