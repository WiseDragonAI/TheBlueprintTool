/** WHAT: Covers responsive thread ledger reconciliation. WHY: A post-launch refresh must not replace optimistic running state with a stale ledger reference. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileResponsiveThreadLedger } from '../src/app/responsive/thread-ledger-reconciliation.js';

test('reconciliation replaces the active ledger before resolving the thread card', () => {
  const oldCard = { id: 'card-a', title: 'Old snapshot' };
  const oldLedger = { cards: [oldCard], notes: { 'thread-card-a': [] } };
  const refreshedCard = { id: 'card-a', title: 'Server snapshot', codexActiveRunId: 'codex-skill-new', codexThreadRunId: 'codex-skill-new' };
  const refreshedLedger = { cards: [refreshedCard], notes: {} };

  const result = reconcileResponsiveThreadLedger({
    activeLedger: oldLedger,
    refreshedLedger,
    slice: { notes: { 'thread-card-a': [{ id: 'note-a' }] } },
    currentCard: oldCard,
  });

  assert.equal(result.ledger, refreshedLedger);
  assert.equal(result.card, refreshedCard);
  assert.deepEqual(result.ledger.notes['thread-card-a'], [{ id: 'note-a' }]);
});

test('reconciliation retains the accepted optimistic run across a stale navigation response', () => {
  const staleCard = { id: 'card-a', title: 'Stale server snapshot' };
  const refreshedLedger = { cards: [staleCard] };

  const result = reconcileResponsiveThreadLedger({
    activeLedger: { cards: [{ id: 'card-a' }] },
    refreshedLedger,
    slice: {},
    currentCard: { id: 'card-a' },
    optimisticRunId: 'codex-skill-accepted',
  });

  assert.equal(result.card.codexActiveRunId, 'codex-skill-accepted');
  assert.equal(result.card.codexThreadRunId, 'codex-skill-accepted');
});
