/**
 * WHAT: Verifies task projection installation against the Epoch 4 causal clock.
 * WHY: Relay invalidation revisions cannot acknowledge local messages, images, executions, pipelines, or content heads.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { state } from '../../../../src/runtime/state.js';
import {
  advanceLedgerRouteEpoch,
  beginActiveLedgerRequest,
  reconcileActiveLedgerState,
} from '../../../../src/runtime/ledger/effect/reconcile-active-ledger-state.js';
import { taskClockFromResponse, taskMutationReceiptMatches } from '../../../../src/runtime/refresh/helper/task-causal-clock.js';

function reset() {
  globalThis.window = { __coreTelemetry: [], dispatchEvent: () => true } as unknown as Window & typeof globalThis;
  state.activeLedgerId = 'tasks';
  state.activeTab = 'tasks';
  state.canvasMode = 'ledger';
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Local task', executionStatus: 'succeeded' }],
    annotations: [],
    relationships: [],
    notes: { 'thread-card-a': [{ id: 'note-a', message: 'Locally committed message.' }] },
  };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.ledgerReconciliation = {
    routeEpoch: 1,
    routeLedgerStateId: 'tasks',
    nextRequestSequence: 1,
    lastAppliedServerRevision: 4,
    lastAppliedSequence: 0,
    lastAppliedTaskClock: { workstation: 7, phone: 20 },
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null,
  };
}

test('higher relay revision cannot install a task clock that omits local durable intent', () => {
  reset();
  const request = beginActiveLedgerRequest('tasks');
  const applied = reconcileActiveLedgerState({
    ledger: {
      cards: [{ id: 'card-a', title: 'Delayed relay task', executionStatus: 'running' }],
      annotations: [],
      relationships: [],
      notes: { 'thread-card-a': [{ id: 'note-a', message: 'Delayed relay message.' }] },
    },
    request,
    serverRevision: 9,
    taskClock: { workstation: 6, phone: 21 },
    source: 'relay-event-refresh',
  });

  assert.equal(applied, false);
  assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Locally committed message.');
  assert.equal(state.activeLedger.cards[0].executionStatus, 'succeeded');
});

test('causally dominating projection installs after acknowledging local durable intent', () => {
  reset();
  const request = beginActiveLedgerRequest('tasks');
  const applied = reconcileActiveLedgerState({
    ledger: {
      cards: [{ id: 'card-a', title: 'Converged task', executionStatus: 'succeeded' }],
      annotations: [],
      relationships: [],
      notes: { 'thread-card-a': [{ id: 'note-a', message: 'Converged message.' }] },
    },
    request,
    serverRevision: 9,
    taskClock: { workstation: 7, phone: 21 },
    source: 'relay-event-refresh',
  });

  assert.equal(applied, true);
  assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Converged message.');
  assert.deepEqual(state.ledgerReconciliation.lastAppliedTaskClock, { workstation: 7, phone: 21 });
});

test('a new project context does not merge the previous project thread document', () => {
  reset();
  advanceLedgerRouteEpoch('tasks');
  const request = beginActiveLedgerRequest('tasks');
  const applied = reconcileActiveLedgerState({
    ledger: {
      cards: [{ id: 'card-b', title: 'Other project task' }],
      annotations: [],
      relationships: [],
    },
    request,
    serverRevision: 5,
    source: 'responsive-thread-context',
    preserveLocalState: false,
  });

  assert.equal(applied, true);
  assert.deepEqual(state.activeLedger.cards, [{ id: 'card-b', title: 'Other project task' }]);
  assert.equal(state.activeLedger.notes, undefined);
});

test('task clock header parser accepts exact base64url JSON and rejects malformed clocks', () => {
  const valid = Buffer.from(JSON.stringify({ workstation: 7, phone: 21 })).toString('base64url');
  assert.deepEqual(taskClockFromResponse({ headers: new Headers({ 'x-decision-os-task-clock': valid }) }), { workstation: 7, phone: 21 });
  assert.equal(taskClockFromResponse({ headers: new Headers({ 'x-decision-os-task-clock': 'not-json' }) }), null);
});

test('a mutation response acknowledges only its exact local receipt identity', () => {
  assert.equal(taskMutationReceiptMatches({ receipt: { mutationId: 'mutation-a' } }, 'mutation-a'), true);
  assert.equal(taskMutationReceiptMatches({ receipt: { mutationId: 'mutation-b' } }, 'mutation-a'), false);
  assert.equal(taskMutationReceiptMatches({ taskClock: { workstation: 8 } }, 'mutation-a'), false);
});
