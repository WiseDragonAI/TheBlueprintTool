/**
 * WHAT: Applies the active thread target color to the terminal side panel.
 * WHY: Card and zone conversations should retain the visual identity of their canvas target.
 */
import { state } from '../../state.js';

export function applyThreadAccent(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement | null;
  if (!panel?.style) return;
  const threadId = String(state.threadId ?? '');
  const escapedThreadId = globalThis.CSS?.escape ? CSS.escape(threadId) : threadId.replace(/["\\]/g, '\\$&');
  const target = threadId ? document.querySelector(`[data-thread-id="${escapedThreadId}"]`) as HTMLElement | null : null;
  const computed = target ? getComputedStyle(target) : null;
  const color = computed?.borderTopColor || '#ff7043';
  const match = color.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
  const rgb = match ? `${Math.round(Number(match[1]))}, ${Math.round(Number(match[2]))}, ${Math.round(Number(match[3]))}` : '255, 112, 67';
  panel.style.setProperty('--thread-accent', color);
  panel.style.setProperty('--workspace-secondary-rgb', rgb);
  panel.style.setProperty('--workspace-primary-rgb', rgb);
  panel.style.setProperty('--voice-workspace-secondary', color);
  panel.style.setProperty('--voice-workspace-primary', color);
}
