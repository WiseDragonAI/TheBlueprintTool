import { state } from '../state.js';
import { renderTelemetry } from './render-telemetry.js';
import { telemetry } from './telemetry.js';

export function renderThreadPanel(): void {
  (document.querySelector('.thread-target') as HTMLElement).textContent = state.threadId ? `Open: ${state.threadId}` : 'No thread open';
  telemetry('render-thread-panel', { threadId: state.threadId });
  renderTelemetry();
}
