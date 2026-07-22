import assert from 'node:assert/strict';
import test from 'node:test';
import { state } from '../../../../src/runtime/state.js';
import {
  overlayPendingActiveLedger,
  runOptimisticActiveLedgerMutation,
} from '../../../../src/runtime/ledger/effect/run-optimistic-active-ledger-mutation.js';

type FetchRequest = { input: string; init?: RequestInit };

test('active-ledger optimism preserves replica scope and overlays a stale refresh until acknowledgement', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousState = {
    projectId: state.projectId,
    replicaNodeId: state.replicaNodeId,
    activeTab: state.activeTab,
    activeLedgerId: state.activeLedgerId,
    activeLedger: state.activeLedger,
    canvasMode: state.canvasMode,
  };
  const requests: FetchRequest[] = [];
  let resolveMutation!: (response: Response) => void;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input: String(input), init });
    if (requests.length === 1) return new Promise<Response>((resolve) => { resolveMutation = resolve; });
    return new Response(JSON.stringify({ cards: [], annotations: [], relationships: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  globalThis.window = { dispatchEvent: () => true } as unknown as Window & typeof globalThis;
  Object.assign(state, {
    projectId: 'project-a',
    replicaNodeId: 'phone',
    activeTab: 'tasks',
    activeLedgerId: 'tasks',
    canvasMode: 'ledger',
    activeLedger: { cards: [{ id: 'card-a', title: 'Task' }], annotations: [], relationships: [] },
  });

  try {
    const pending = runOptimisticActiveLedgerMutation({
      mutation: { action: 'delete-card', cardId: 'card-a' },
      apply: (ledger) => { ledger.cards = ledger.cards.filter((card: { id: string }) => card.id !== 'card-a'); },
    });
    assert.deepEqual(state.activeLedger.cards, []);
    assert.deepEqual(overlayPendingActiveLedger({ cards: [{ id: 'card-a', title: 'Stale' }] }, 'tasks').cards, []);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests[0].input, '/p/project-a/decision-os/tasks?replica=phone');
    assert.equal(new Headers(requests[0].init?.headers).get('x-decision-os-replica-node'), 'phone');
    resolveMutation(new Response(JSON.stringify({ ok: true, removedCardIds: ['card-a'] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    assert.equal(await pending, true);
    assert.equal(requests[1].input, '/p/project-a/api/ledgers/tasks/canvas?replica=phone');
    assert.equal(new Headers(requests[1].init?.headers).get('x-decision-os-replica-node'), 'phone');
    assert.deepEqual(state.activeLedger.cards, []);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    Object.assign(state, previousState);
  }
});

test('active-ledger optimism restores confirmed state after mutation rejection', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousState = {
    projectId: state.projectId,
    replicaNodeId: state.replicaNodeId,
    activeTab: state.activeTab,
    activeLedgerId: state.activeLedgerId,
    activeLedger: state.activeLedger,
    canvasMode: state.canvasMode,
  };
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'conflict' }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch;
  globalThis.window = { dispatchEvent: () => true } as unknown as Window & typeof globalThis;
  Object.assign(state, {
    projectId: 'project-b',
    replicaNodeId: 'workstation',
    activeTab: 'tasks',
    activeLedgerId: 'tasks',
    canvasMode: 'ledger',
    activeLedger: { cards: [{ id: 'card-b', title: 'Before' }], annotations: [], relationships: [] },
  });

  try {
    const pending = runOptimisticActiveLedgerMutation({
      mutation: { action: 'patch-card', cardPatch: { id: 'card-b', title: 'After' } },
      apply: (ledger) => { ledger.cards[0].title = 'After'; },
    });
    assert.equal(state.activeLedger.cards[0].title, 'After');
    assert.equal(await pending, false);
    assert.equal(state.activeLedger.cards[0].title, 'Before');
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    Object.assign(state, previousState);
  }
});
