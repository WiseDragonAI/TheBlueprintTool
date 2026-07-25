/**
 * WHAT: Defines one receipt-aware and lifecycle-aware gate for replicated task projections.
 * WHY: Numerically newer relay snapshots can still be causally older than locally persisted intent.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldAcceptReplicatedTaskState } from '../../../../src/runtime/refresh/helper/task-projection-acceptance.js';

const pendingReceipt = {
  receiptId: 'receipt-local-7',
  entityId: 'thread-card-a/note-a',
  localRevision: 7,
  acknowledged: false,
};

for (const domain of ['message', 'image', 'queued-execution', 'pipeline', 'content-head'] as const) {
  test(`${domain} keeps locally persisted intent when a newer relay projection lacks its receipt`, () => {
    assert.equal(shouldAcceptReplicatedTaskState({
      domain,
      local: { entityId: pendingReceipt.entityId, revision: 7, receiptId: pendingReceipt.receiptId, status: 'pending' },
      incoming: { entityId: pendingReceipt.entityId, revision: 8, status: 'pending' },
      pendingReceipt,
      source: 'relay-refresh',
    }), false);
  });

  test(`${domain} accepts the projection that causally acknowledges its local receipt`, () => {
    assert.equal(shouldAcceptReplicatedTaskState({
      domain,
      local: { entityId: pendingReceipt.entityId, revision: 7, receiptId: pendingReceipt.receiptId, status: 'pending' },
      incoming: { entityId: pendingReceipt.entityId, revision: 8, acknowledgedReceiptIds: [pendingReceipt.receiptId], status: 'pending' },
      pendingReceipt,
      source: 'relay-refresh',
    }), true);
  });
}

test('a pending receipt does not block a projection for another entity', () => {
  assert.equal(shouldAcceptReplicatedTaskState({
    domain: 'message',
    local: { entityId: 'thread-card-a/note-b', revision: 3 },
    incoming: { entityId: 'thread-card-a/note-b', revision: 4 },
    pendingReceipt,
    source: 'relay-refresh',
  }), true);
});

test('only the exact rejected mutation response may remove its optimistic intent', () => {
  assert.equal(shouldAcceptReplicatedTaskState({
    domain: 'message',
    local: { entityId: pendingReceipt.entityId, revision: 7, receiptId: pendingReceipt.receiptId, status: 'pending' },
    incoming: { entityId: pendingReceipt.entityId, revision: 6 },
    pendingReceipt,
    source: 'mutation-rejection',
    responseReceiptId: pendingReceipt.receiptId,
  }), true);
  assert.equal(shouldAcceptReplicatedTaskState({
    domain: 'message',
    local: { entityId: pendingReceipt.entityId, revision: 7, receiptId: pendingReceipt.receiptId, status: 'pending' },
    incoming: { entityId: pendingReceipt.entityId, revision: 9 },
    pendingReceipt,
    source: 'mutation-rejection',
    responseReceiptId: 'receipt-other',
  }), false);
});

test('terminal execution state rejects a later non-terminal relay lifecycle', () => {
  assert.equal(shouldAcceptReplicatedTaskState({
    domain: 'queued-execution',
    local: { revision: 4, status: 'succeeded' },
    incoming: { revision: 5, status: 'running' },
    pendingReceipt: null,
    source: 'relay-refresh',
  }), false);
});

test('active execution state rejects a numerically newer backward lifecycle', () => {
  assert.equal(shouldAcceptReplicatedTaskState({
    domain: 'queued-execution',
    local: { entityId: 'execution-a', revision: 4, phase: 'running' },
    incoming: { entityId: 'execution-a', revision: 5, phase: 'queued' },
    pendingReceipt: null,
    source: 'relay-refresh',
  }), false);
});

test('an explicit retry receipt starts a new execution lifecycle', () => {
  assert.equal(shouldAcceptReplicatedTaskState({
    domain: 'queued-execution',
    local: { revision: 4, status: 'failed' },
    incoming: { revision: 5, status: 'queued', acknowledgedReceiptIds: ['receipt-retry'] },
    pendingReceipt: {
      receiptId: 'receipt-retry',
      entityId: 'execution-a',
      localRevision: 5,
      acknowledged: false,
      intent: 'retry',
    },
    source: 'mutation-response',
  }), true);
});
