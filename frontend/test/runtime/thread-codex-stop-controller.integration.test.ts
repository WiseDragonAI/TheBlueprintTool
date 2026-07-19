/**
 * WHAT: Exercises the shared Codex Log stop controller's in-flight and rejection behavior.
 * WHY: The mobile running-session widget must emit one stop request and remain actionable after failure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearThreadCodexStopState, stopThreadCodexRunController, threadCodexStopState } from '../../src/runtime/codex/controller/stop-thread-codex-run-controller.js';

function fakeButton() {
  const label = { textContent: 'STOP' };
  const error = { textContent: '', remove() {} };
  const root = { querySelector: () => error };
  const status = { after() {} };
  const attributes = new Map<string, string>();
  const button = {
    dataset: {} as Record<string, string>,
    disabled: false,
    title: '',
    querySelector: (selector: string) => selector === '[data-codex-log-stop-label]' ? label : null,
    closest: (selector: string) => selector === '.thread-codex-log' ? root : selector === '.codex-log-status' ? status : null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  } as unknown as HTMLButtonElement;
  return { button, label, error, attributes };
}

test('Codex Log STOP sends one request while the first stop is pending', async () => {
  clearThreadCodexStopState('run-a');
  const previousFetch = globalThis.fetch;
  let requests = 0;
  let settle!: (response: Response) => void;
  try {
    globalThis.fetch = (async () => {
      requests += 1;
      return await new Promise<Response>((resolve) => { settle = resolve; });
    }) as typeof fetch;
    const control = fakeButton();
    const first = stopThreadCodexRunController({ button: control.button, ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-a' });
    const second = await stopThreadCodexRunController({ button: control.button, ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-a' });
    assert.equal(requests, 1);
    assert.equal(second, false);
    assert.equal(control.button.disabled, true);
    assert.equal(control.label.textContent, 'STOPPING');
    assert.equal(threadCodexStopState('run-a').pending, true);
    settle(new Response(JSON.stringify({ ok: true, status: 'cancelled' }), { status: 202, headers: { 'content-type': 'application/json' } }));
    assert.equal(await first, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Codex Log STOP restores the control and exposes a rejected-request error', async () => {
  clearThreadCodexStopState('run-a');
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, status: 'unknown', error: 'Active run not found.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
    const control = fakeButton();
    const stopped = await stopThreadCodexRunController({ button: control.button, ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-a' });
    assert.equal(stopped, false);
    assert.equal(control.button.disabled, false);
    assert.equal(control.label.textContent, 'STOP');
    assert.equal(control.error.textContent, 'Active run not found.');
    assert.deepEqual(threadCodexStopState('run-a'), { pending: false, error: 'Active run not found.' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('queued cancellation restores the CANCEL label after rejection', async () => {
  clearThreadCodexStopState('run-queued');
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Queued run was not cancelled.' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
    const control = fakeButton();
    control.button.dataset.stopReadyLabel = 'CANCEL';
    control.button.dataset.stopPendingLabel = 'CANCELLING';
    control.button.dataset.stopReadyTitle = 'Cancel queued Codex run';
    control.button.dataset.stopPendingTitle = 'Cancelling queued Codex run';
    const stopped = await stopThreadCodexRunController({ button: control.button, ledgerId: 'specs', cardId: 'card-a', runId: 'run-queued', executionId: 'execution-queued' });
    assert.equal(stopped, false);
    assert.equal(control.label.textContent, 'CANCEL');
    assert.equal(control.button.title, 'Cancel queued Codex run');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
