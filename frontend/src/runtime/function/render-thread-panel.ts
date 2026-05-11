import { state } from '../state.js';
import { renderTelemetry } from './render-telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { selectionHasTarget } from './selection-has-target.js';
import { telemetry } from './telemetry.js';

export function renderThreadPanel(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement;
  const inspector = document.querySelector('.panel') as HTMLElement;
  const shell = document.querySelector('.shell') as HTMLElement;
  const shouldOpenThread = state.activeTool === 'thread' || selectionHasTarget();
  panel.hidden = !shouldOpenThread;
  inspector.hidden = !shouldOpenThread;
  shell.classList.toggle('has-inspector', shouldOpenThread);
  (document.querySelector('.thread-target') as HTMLElement).textContent = state.threadId ? `Open: ${state.threadId}` : 'No thread selected';
  telemetry('render-thread-panel', { threadId: state.threadId });
  renderVoiceStatus();
  renderTelemetry();
}
