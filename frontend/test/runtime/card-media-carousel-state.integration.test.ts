import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ledgerCardMediaCarouselStateId,
  readLedgerCardMediaCarouselSlide,
  saveLedgerCardMediaCarouselSlide
} from '../../src/runtime/ledger/helper/persist-ledger-card-media-carousel.js';

test('card media carousel slide state persists locally outside the ledger', () => {
  const previousLocalStorage = globalThis.localStorage;
  const values = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };

  try {
    const stateId = ledgerCardMediaCarouselStateId({
      tabId: 'specs',
      cardId: 'card-a',
      sources: ['.blueprinttool/a.png', '.blueprinttool/b.png', '.blueprinttool/c.png']
    });
    assert.ok(stateId);
    assert.equal(readLedgerCardMediaCarouselSlide(stateId, 3), 0);

    saveLedgerCardMediaCarouselSlide(stateId, 2, 3);
    assert.equal(readLedgerCardMediaCarouselSlide(stateId, 3), 2);
    assert.equal(readLedgerCardMediaCarouselSlide(stateId, 2), 1);

    saveLedgerCardMediaCarouselSlide(stateId, 0, 3);
    assert.equal(readLedgerCardMediaCarouselSlide(stateId, 3), 0);
  } finally {
    (globalThis as unknown as { localStorage: unknown }).localStorage = previousLocalStorage;
  }
});
