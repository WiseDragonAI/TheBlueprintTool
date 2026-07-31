import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';

test('patch-card persists validated facts without changing card content', () => {
  const ledger = { cards: [{ id: 'card-a', title: 'Card A', comment: { what: 'Existing body.' }, facts: [] }] };
  const result = applyLedgerMutation({
    decisionOsRoot: '/workspace/.decision-os',
    ledgerPath: '/workspace/.decision-os/tasks.json',
    ledger,
    mutation: { action: 'patch-card', cardPatch: { id: 'card-a', facts: ['First fact', 'Second fact'] } },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(ledger.cards[0]?.facts, ['First fact', 'Second fact']);
  assert.equal(ledger.cards[0]?.comment.what, 'Existing body.');
});

test('patch-card rejects blank facts without changing existing facts', () => {
  const ledger = { cards: [{ id: 'card-a', title: 'Card A', facts: ['Existing fact'] }] };
  const result = applyLedgerMutation({
    decisionOsRoot: '/workspace/.decision-os',
    ledgerPath: '/workspace/.decision-os/tasks.json',
    ledger,
    mutation: { action: 'patch-card', cardPatch: { id: 'card-a', facts: [''] } },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(ledger.cards[0]?.facts, ['Existing fact']);
});
