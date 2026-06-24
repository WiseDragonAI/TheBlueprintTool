import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ledgerCardMediaCarouselStateId,
  persistLedgerCardMediaCarouselDeleteHandoff,
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

    persistLedgerCardMediaCarouselDeleteHandoff({
      tabId: 'specs',
      cardId: 'card-a',
      imageSrc: '.blueprinttool/b.png',
      sources: ['.blueprinttool/a.png', '.blueprinttool/b.png', '.blueprinttool/c.png'],
      slideIndex: 1
    });
    const afterMiddleDelete = ledgerCardMediaCarouselStateId({
      tabId: 'specs',
      cardId: 'card-a',
      sources: ['.blueprinttool/a.png', '.blueprinttool/c.png']
    });
    assert.equal(readLedgerCardMediaCarouselSlide(afterMiddleDelete, 2), 1);

    persistLedgerCardMediaCarouselDeleteHandoff({
      tabId: 'specs',
      cardId: 'card-b',
      imageSrc: '.blueprinttool/c.png',
      sources: ['.blueprinttool/a.png', '.blueprinttool/b.png', '.blueprinttool/c.png'],
      slideIndex: 2
    });
    const afterLastDelete = ledgerCardMediaCarouselStateId({
      tabId: 'specs',
      cardId: 'card-b',
      sources: ['.blueprinttool/a.png', '.blueprinttool/b.png']
    });
    assert.equal(readLedgerCardMediaCarouselSlide(afterLastDelete, 2), 1);

    persistLedgerCardMediaCarouselDeleteHandoff({
      tabId: 'specs',
      cardId: 'card-c',
      imageSrc: '.blueprinttool/a.png',
      sources: ['.blueprinttool/a.png', '.blueprinttool/b.png', '.blueprinttool/c.png'],
      slideIndex: 0
    });
    const afterFirstDelete = ledgerCardMediaCarouselStateId({
      tabId: 'specs',
      cardId: 'card-c',
      sources: ['.blueprinttool/b.png', '.blueprinttool/c.png']
    });
    assert.equal(readLedgerCardMediaCarouselSlide(afterFirstDelete, 2), 0);
  } finally {
    (globalThis as unknown as { localStorage: unknown }).localStorage = previousLocalStorage;
  }
});
