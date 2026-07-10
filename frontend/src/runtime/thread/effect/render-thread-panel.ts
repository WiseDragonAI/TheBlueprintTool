/**
 * WHAT: Renders the active thread panel while preserving same-thread Codex control identity.
 * WHY: Thread note refreshes must not reset focused model and effort controls or their committed preferences.
 */
import { state, type ThreadCodexPreference } from '../../state.js';
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

const defaultThreadCodexPreference: ThreadCodexPreference = { model: 'gpt-5.5', effort: 'xhigh' };

function threadCodexPreference(threadId: string): ThreadCodexPreference {
  // WHAT: Repair absent or invalid preference storage at its access boundary.
  // WHY: Restored runtime state may predate per-thread preferences.
  if (!state.threadCodexPreferencesByThreadId || typeof state.threadCodexPreferencesByThreadId !== 'object' || Array.isArray(state.threadCodexPreferencesByThreadId)) {
    state.threadCodexPreferencesByThreadId = {};
  }
  const preferences = state.threadCodexPreferencesByThreadId as Record<string, ThreadCodexPreference>;
  const existing = preferences[threadId];
  // WHAT: Reuse a complete preference object for the active thread.
  // WHY: Control remounts must preserve the operator's committed values.
  if (existing && typeof existing.model === 'string' && typeof existing.effort === 'string') return existing;
  const preference = { ...defaultThreadCodexPreference };
  preferences[threadId] = preference;
  return preference;
}

function renderThreadCodexSelect(input: { preference: 'model' | 'effort'; label: string; value: string; options: readonly string[]; onChange: (value: string) => void }): HTMLLabelElement {
  const field = document.createElement('label');
  field.className = 'thread-codex-field';
  const label = document.createElement('span');
  label.textContent = input.label;
  const select = document.createElement('select');
  select.className = 'thread-codex-select';
  select.dataset.codexPreference = input.preference;
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
  // WHAT: Skip action rendering when the thread heading is absent.
  // WHY: Headless and partially mounted surfaces may render notes independently.
  if (!heading) return;
  let actions = heading.querySelector('.thread-actions') as HTMLElement | null;
  // WHAT: Create the stable actions host once for the thread panel.
  // WHY: Subsequent same-thread renders must retain descendant control identity.
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'thread-actions';
    heading.append(actions);
  }
  const preference = threadCodexPreference(threadId);
  const threadCodexModel = preference.model;
  const threadCodexEffort = preference.effort;
  // WHAT: Update button metadata in place for the same rendered thread.
  // WHY: Replacing controls would lose focus, listeners, and current select values.
  if (actions.dataset.threadId === threadId) {
    const button = actions.querySelector('.thread-codex-button') as HTMLButtonElement | null;
    // WHAT: Refresh the retained button's request operands when it exists.
    // WHY: Card ownership can change without requiring control remounting.
    if (button) {
      button.dataset.threadId = threadId;
      button.dataset.cardId = threadCodexCardId(state.activeLedger, threadId);
      button.dataset.codexModel = threadCodexModel;
      button.dataset.codexEffort = threadCodexEffort;
    }
    return;
  }
  actions.replaceChildren();
  actions.dataset.threadId = threadId;
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  // WHAT: Leave actions empty when the thread has no owning card.
  // WHY: Codex requests require a card-scoped output target.
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
    preference: 'model',
    label: 'Model',
    value: threadCodexModel,
    options: codexModelOptions,
    onChange: (value) => {
      preference.model = value;
      button.dataset.codexModel = value;
    },
  });
  const effort = renderThreadCodexSelect({
    preference: 'effort',
    label: 'Effort',
    value: threadCodexEffort,
    options: codexEffortOptions,
    onChange: (value) => {
      preference.effort = value;
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
