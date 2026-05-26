import { state } from '../../state.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';
import { renderVoiceDock } from '../../voice/effect/render-voice-dock.js';
import { renderThreadNotes } from './render-thread-notes.js';
import { applyThreadAccent } from './apply-thread-accent.js';
import { pinThreadFeedToLastMessage } from './pin-thread-feed-to-last-message.js';
import { resolveThreadTargetTitle } from '../helper/resolve-thread-target-title.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderThreadPanel(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement;
  const inspector = document.querySelector('.panel') as HTMLElement;
  const shell = document.querySelector('.shell') as HTMLElement;
  const shouldOpenThread = Boolean(state.threadPanelOpen || state.activeTool === 'thread');
  inspector.hidden = false;
  panel.hidden = !shouldOpenThread;
  shell.classList.toggle('has-inspector', shouldOpenThread);
  const target = document.querySelector('.thread-target') as HTMLElement;
  target.replaceChildren();
  if (state.threadId) {
    const title = document.createElement('span');
    title.className = 'thread-target-title';
    title.textContent = resolveThreadTargetTitle(state.threadId);
    const id = document.createElement('span');
    id.className = 'thread-target-id';
    id.textContent = `Open: ${state.threadId}`;
    target.append(title, id);
  } else {
    target.textContent = 'No thread selected';
  }
  applyThreadAccent();
  telemetry('render-thread-panel', { threadId: state.threadId });
  renderThreadNotes();
  renderVoiceDock();
  renderVoiceStatus();
  renderTelemetry();
  if (shouldOpenThread && state.threadPinOnRender) {
    state.threadPinOnRender = false;
    pinThreadFeedToLastMessage();
  }
}
