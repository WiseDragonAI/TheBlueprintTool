import { state } from '../../state.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';
import { renderVoiceDock } from '../../voice/effect/render-voice-dock.js';
import { renderThreadNotes } from './render-thread-notes.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderThreadPanel(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement;
  const inspector = document.querySelector('.panel') as HTMLElement;
  const shell = document.querySelector('.shell') as HTMLElement;
  const shouldOpenThread = Boolean(state.threadPanelOpen || state.activeTool === 'thread');
  inspector.hidden = false;
  panel.hidden = !shouldOpenThread;
  shell.classList.toggle('has-inspector', shouldOpenThread);
  (document.querySelector('.thread-target') as HTMLElement).textContent = state.threadId ? `Open: ${state.threadId}` : 'No thread selected';
  telemetry('render-thread-panel', { threadId: state.threadId });
  renderThreadNotes();
  renderVoiceDock();
  renderVoiceStatus();
  renderTelemetry();
}
