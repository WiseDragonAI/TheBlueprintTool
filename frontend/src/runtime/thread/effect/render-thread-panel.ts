import { state } from '../../state.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';
import { renderVoiceDock } from '../../voice/effect/render-voice-dock.js';
import { renderThreadNotes } from './render-thread-notes.js';
import { applyThreadAccent } from './apply-thread-accent.js';
import { pinThreadFeedToLastMessage } from './pin-thread-feed-to-last-message.js';
import { renderThreadJumpButton, syncThreadJumpButtonVisibility } from './render-thread-jump-button.js';
import { restoreThreadDraft } from './persist-thread-draft.js';
import { restoreThreadScrollPosition, saveThreadScrollPosition } from './persist-thread-scroll.js';
import { resolveThreadTargetTitle } from '../helper/resolve-thread-target-title.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { codexEffortOptions, codexModelOptions } from '../../codex/helper/codex-run-options.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';

let threadCodexModel = 'gpt-5.5';
let threadCodexEffort = 'xhigh';

function renderThreadCodexSelect(input: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }): HTMLLabelElement {
  const field = document.createElement('label');
  field.className = 'thread-codex-field';
  const label = document.createElement('span');
  label.textContent = input.label;
  const select = document.createElement('select');
  select.className = 'thread-codex-select';
  select.setAttribute('aria-label', `${input.label} for thread Codex`);
  for (const value of input.options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = input.value;
  select.addEventListener('change', () => input.onChange(select.value));
  field.replaceChildren(label, select);
  return field;
}

function renderThreadActions(threadId: string): void {
  const heading = document.querySelector('.thread-heading') as HTMLElement | null;
  if (!heading) return;
  let actions = heading.querySelector('.thread-actions') as HTMLElement | null;
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'thread-actions';
    heading.append(actions);
  }
  actions.replaceChildren();
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  if (!cardId) return;
  const button = document.createElement('button');
  button.className = 'thread-codex-button terminal-button terminal-button--compact';
  button.type = 'button';
  button.dataset.action = 'process-thread-codex';
  button.dataset.threadId = threadId;
  button.dataset.cardId = cardId;
  button.dataset.codexModel = threadCodexModel;
  button.dataset.codexEffort = threadCodexEffort;
  button.title = 'Start Codex from this thread';
  button.setAttribute('aria-label', button.title);
  const key = document.createElement('span');
  key.className = 'terminal-button__key';
  key.textContent = '>';
  const label = document.createElement('span');
  label.className = 'terminal-button__label';
  label.textContent = 'Codex';
  button.replaceChildren(key, label);
  const model = renderThreadCodexSelect({
    label: 'Model',
    value: threadCodexModel,
    options: codexModelOptions,
    onChange: (value) => {
      threadCodexModel = value;
      button.dataset.codexModel = value;
    },
  });
  const effort = renderThreadCodexSelect({
    label: 'Effort',
    value: threadCodexEffort,
    options: codexEffortOptions,
    onChange: (value) => {
      threadCodexEffort = value;
      button.dataset.codexEffort = value;
    },
  });
  actions.append(model, effort, button);
}

export function renderThreadPanel(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement;
  const inspector = document.querySelector('.panel') as HTMLElement;
  const shell = document.querySelector('.shell') as HTMLElement;
  const shouldOpenThread = Boolean(state.threadPanelOpen || state.activeTool === 'thread');
  const activeThreadId = String(state.threadId ?? '');
  const shouldPinThread = Boolean(shouldOpenThread && state.threadPinOnRender);
  if (shouldOpenThread && !shouldPinThread && activeThreadId && state.renderedThreadId === activeThreadId) {
    saveThreadScrollPosition(activeThreadId);
  }
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
  renderThreadActions(activeThreadId);
  applyThreadAccent();
  telemetry('render-thread-panel', { threadId: state.threadId });
  renderThreadNotes();
  renderThreadJumpButton();
  state.renderedThreadId = activeThreadId;
  renderVoiceDock();
  restoreThreadDraft();
  renderVoiceStatus();
  renderTelemetry();
  if (shouldPinThread) {
    state.threadPinOnRender = false;
    pinThreadFeedToLastMessage();
  } else if (shouldOpenThread) {
    restoreThreadScrollPosition(activeThreadId);
  }
  syncThreadJumpButtonVisibility();
}
