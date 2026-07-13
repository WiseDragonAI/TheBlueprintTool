import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMobileThreadSessionDeletionHandler,
  resetMobileThreadConfirmationModal,
} from '../src/mobile-thread-session-deletion.js';

function fixture() {
  const message = { textContent: '' };
  const confirm = { dataset: { action: 'delete-note' }, textContent: '', disabled: false };
  const modal = {
    dataset: {},
    open: true,
    closeCalls: 0,
    close() { this.open = false; this.closeCalls += 1; },
    querySelector(selector) {
      if (selector === 'p') return message;
      if (selector === '[data-action]:not([data-action="cancel-delete"])') return confirm;
      return null;
    },
  };
  return { modal, message, confirm };
}

test('mobile session deletion routes exact identity from the visible button through confirmation and removal', async () => {
  const { modal, message, confirm } = fixture();
  const calls = [];
  let triggerFocus = 0;
  let startFocus = 0;
  const trigger = {
    isConnected: true,
    dataset: { codexCardId: 'card-a', codexRunId: 'run-a', threadId: 'thread-card-a' },
    focus() { triggerFocus += 1; },
  };
  const handler = createMobileThreadSessionDeletionHandler({
    modal: () => modal,
    ledgerId: () => 'specs',
    cardId: () => 'fallback-card',
    threadId: () => 'fallback-thread',
    confirm(input) {
      calls.push({ phase: 'confirm', input });
      modal.dataset.confirmKind = 'codex-session';
      Object.assign(modal.dataset, input);
      confirm.dataset.action = 'delete-thread-codex-session';
    },
    async remove(input) { calls.push({ phase: 'remove', input }); return true; },
    successFocus: () => ({ isConnected: true, focus() { startFocus += 1; } }),
  });

  assert.equal(await handler({ action: 'confirm-delete-thread-codex-session', button: trigger }), true);
  assert.deepEqual(calls[0], { phase: 'confirm', input: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', threadId: 'thread-card-a' } });
  assert.equal(await handler({ action: 'delete-thread-codex-session', button: { dataset: {} } }), true);
  assert.deepEqual(calls[1], { phase: 'remove', input: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', threadId: 'thread-card-a' } });
  assert.equal(confirm.dataset.action, 'delete-note');
  assert.equal(startFocus, 1);
  assert.equal(triggerFocus, 0);
});

test('mobile session deletion cancellation is non-mutating and returns focus to its trigger', async () => {
  const { modal, message, confirm } = fixture();
  let removals = 0;
  let triggerFocus = 0;
  const trigger = { isConnected: true, dataset: { codexCardId: 'card-a', codexRunId: 'run-a', threadId: 'thread-card-a' }, focus() { triggerFocus += 1; } };
  const handler = createMobileThreadSessionDeletionHandler({
    modal: () => modal,
    ledgerId: () => 'specs',
    cardId: () => 'card-a',
    threadId: () => 'thread-card-a',
    confirm(input) { modal.dataset.confirmKind = 'codex-session'; Object.assign(modal.dataset, input); confirm.dataset.action = 'delete-thread-codex-session'; },
    async remove() { removals += 1; return true; },
  });

  await handler({ action: 'confirm-delete-thread-codex-session', button: trigger });
  assert.equal(await handler({ action: 'cancel-delete', button: { dataset: {} } }), true);
  assert.equal(removals, 0);
  assert.equal(modal.closeCalls, 1);
  assert.equal(triggerFocus, 1);
  assert.equal(message.textContent, 'Delete this note?');
  assert.equal(confirm.dataset.action, 'delete-note');
  assert.equal(confirm.disabled, false);
  assert.equal('runId' in modal.dataset, false);
});

test('non-session cancellation remains owned by the note deletion flow', async () => {
  const { modal } = fixture();
  resetMobileThreadConfirmationModal(modal);
  const handler = createMobileThreadSessionDeletionHandler({
    modal: () => modal,
    ledgerId: () => 'specs',
    cardId: () => 'card-a',
    threadId: () => 'thread-card-a',
    confirm() {},
    async remove() { return true; },
  });
  assert.equal(await handler({ action: 'cancel-delete', button: { dataset: {} } }), false);
});

test('a rejected mobile deletion closes the modal, restores note semantics, and returns focus', async () => {
  const { modal, confirm } = fixture();
  let triggerFocus = 0;
  const trigger = { isConnected: true, dataset: { codexCardId: 'card-a', codexRunId: 'run-a', threadId: 'thread-card-a' }, focus() { triggerFocus += 1; } };
  const handler = createMobileThreadSessionDeletionHandler({
    modal: () => modal,
    ledgerId: () => 'specs',
    cardId: () => 'card-a',
    threadId: () => 'thread-card-a',
    confirm(input) { modal.dataset.confirmKind = 'codex-session'; Object.assign(modal.dataset, input); confirm.dataset.action = 'delete-thread-codex-session'; },
    async remove() { return false; },
  });
  await handler({ action: 'confirm-delete-thread-codex-session', button: trigger });
  await handler({ action: 'delete-thread-codex-session', button: { dataset: {} } });
  assert.equal(modal.open, false);
  assert.equal(confirm.dataset.action, 'delete-note');
  assert.equal(triggerFocus, 1);
});
