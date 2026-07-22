import assert from 'node:assert/strict';
import test from 'node:test';
import { createOptimisticLedgerTransactionCoordinator } from '../../../../src/runtime/ledger/helper/optimistic-ledger-transaction.js';

type Ledger = { cards: Array<{ id: string; title: string }> };
type Mutation = { id: string; title?: string; delete?: boolean };

function reducer(mutation: Mutation): (ledger: Ledger) => void {
  return (ledger) => {
    if (mutation.delete) ledger.cards = ledger.cards.filter((card) => card.id !== mutation.id);
    else ledger.cards = ledger.cards.map((card) => card.id === mutation.id ? { ...card, title: mutation.title ?? card.title } : card);
  };
}

test('applies before persistence and restores confirmed state after rejection', async () => {
  let ledger: Ledger = { cards: [{ id: 'card-a', title: 'Before' }] };
  let resolvePersistence!: (result: { ok: false; error: Error }) => void;
  const coordinator = createOptimisticLedgerTransactionCoordinator<Ledger, Mutation>({
    read: () => ledger,
    write: (next) => { ledger = next; },
    persist: () => new Promise((resolve) => { resolvePersistence = resolve; }),
  });

  const pending = coordinator.run({ scope: 'project/ledger', mutation: { id: 'card-a', delete: true }, apply: reducer({ id: 'card-a', delete: true }) });
  assert.deepEqual(ledger.cards, []);
  await new Promise((resolve) => setImmediate(resolve));
  resolvePersistence({ ok: false, error: new Error('rejected') });
  assert.equal(await pending, false);
  assert.equal(ledger.cards[0]?.title, 'Before');
});

test('replays a later optimistic edit over an earlier acknowledgement', async () => {
  let ledger: Ledger = { cards: [{ id: 'card-a', title: 'Before' }] };
  const resolutions: Array<(result: { ok: true; confirmed: Ledger }) => void> = [];
  const coordinator = createOptimisticLedgerTransactionCoordinator<Ledger, Mutation>({
    read: () => ledger,
    write: (next) => { ledger = next; },
    persist: () => new Promise((resolve) => { resolutions.push(resolve); }),
  });

  const first = coordinator.run({ scope: 'project/ledger', mutation: { id: 'card-a', title: 'First' }, apply: reducer({ id: 'card-a', title: 'First' }) });
  const second = coordinator.run({ scope: 'project/ledger', mutation: { id: 'card-a', title: 'Second' }, apply: reducer({ id: 'card-a', title: 'Second' }) });
  assert.equal(ledger.cards[0]?.title, 'Second');

  await new Promise((resolve) => setImmediate(resolve));
  resolutions[0]({ ok: true, confirmed: { cards: [{ id: 'card-a', title: 'First' }] } });
  await first;
  assert.equal(ledger.cards[0]?.title, 'Second');
  await new Promise((resolve) => setImmediate(resolve));
  resolutions[1]({ ok: true, confirmed: { cards: [{ id: 'card-a', title: 'Second' }] } });
  await second;
  assert.equal(ledger.cards[0]?.title, 'Second');
});

test('overlays pending intent onto a stale authoritative refresh', async () => {
  let ledger: Ledger = { cards: [{ id: 'card-a', title: 'Before' }] };
  let resolvePersistence!: (result: { ok: true; confirmed: Ledger }) => void;
  const coordinator = createOptimisticLedgerTransactionCoordinator<Ledger, Mutation>({
    read: () => ledger,
    write: (next) => { ledger = next; },
    persist: () => new Promise((resolve) => { resolvePersistence = resolve; }),
  });

  const pending = coordinator.run({ scope: 'project/ledger', mutation: { id: 'card-a', delete: true }, apply: reducer({ id: 'card-a', delete: true }) });
  ledger = coordinator.reconcile('project/ledger', { cards: [{ id: 'card-a', title: 'Stale' }] });
  assert.deepEqual(ledger.cards, []);
  await new Promise((resolve) => setImmediate(resolve));
  resolvePersistence({ ok: true, confirmed: { cards: [] } });
  await pending;
  assert.deepEqual(ledger.cards, []);
});
