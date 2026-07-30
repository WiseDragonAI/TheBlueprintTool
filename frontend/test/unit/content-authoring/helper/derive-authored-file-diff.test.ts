/**
 * WHAT: Proves authored diff Worker requests settle once on success, timeout, and cancellation.
 * WHY: Editor teardown and superseded generations must not leave active resources or callbacks.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAuthoredFileDiff } from '../../../../src/runtime/content-authoring/helper/derive-authored-file-diff.js';

class WorkerFixture {
  listeners = new Map<string, Set<EventListener>>();
  terminated = 0;
  posted: unknown[] = [];
  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
  postMessage(message: unknown): void { this.posted.push(message); }
  terminate(): void { this.terminated += 1; }
  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const input = {
  generation: 1,
  identity: 'identity-a',
  filename: 'card.md',
  baseMarkdown: 'base',
  draftMarkdown: 'draft',
  baseKey: 'base-a',
  draftKey: 'draft-a',
};

test('accepts only the matching Worker result and terminates once', async () => {
  const worker = new WorkerFixture();
  const pending = deriveAuthoredFileDiff({ ...input, createWorker: () => worker });
  worker.emit('message', new MessageEvent('message', { data: { ok: true, generation: 1, identity: 'identity-a', metadata: { hunks: [] } } }));
  const result = await pending;
  assert.deepEqual(result.metadata, { hunks: [] });
  assert.equal(worker.terminated, 1);
  assert.equal(worker.listeners.get('message')?.size, 0);
});

test('cancellation terminates once and rejects with AbortError', async () => {
  const worker = new WorkerFixture();
  const controller = new AbortController();
  const pending = deriveAuthoredFileDiff({ ...input, signal: controller.signal, createWorker: () => worker });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => (error as { name?: string }).name === 'AbortError');
  assert.equal(worker.terminated, 1);
});

test('deadline terminates once', async () => {
  const worker = new WorkerFixture();
  await assert.rejects(
    deriveAuthoredFileDiff({ ...input, deadlineMs: 5, createWorker: () => worker }),
    /2,000 ms deadline/,
  );
  assert.equal(worker.terminated, 1);
});
