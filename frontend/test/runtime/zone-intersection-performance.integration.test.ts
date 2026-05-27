import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardsIntersectingZone } from '../../src/runtime/zone/helper/cards-intersecting-zone.js';
import { state } from '../../src/runtime/state.js';

const root = new URL('../../../', import.meta.url);

function element(input: {
  id?: string;
  left: number;
  top: number;
  width: number;
  height: number;
}): HTMLElement {
  return {
    dataset: input.id ? { cardId: input.id } : { zoneId: 'zone-a' },
    style: {
      left: `${input.left}px`,
      top: `${input.top}px`,
      width: `${input.width}px`,
      height: `${input.height}px`,
      minHeight: ''
    },
    getBoundingClientRect() {
      throw new Error('zone intersection must not use viewport layout reads');
    }
  } as unknown as HTMLElement;
}

test('zone card intersection uses ledger geometry without DOM reads', () => {
  const previousLedger = state.activeLedger;
  const previousDocument = globalThis.document;
  try {
    state.activeLedger = {
      annotations: [{ id: 'zone-a', x: 100, y: 100, width: 300, height: 220 }],
      cards: [
        { id: 'inside', x: 130, y: 160, w: 120, h: 90 },
        { id: 'outside', x: 460, y: 160, w: 120, h: 90 }
      ]
    };
    globalThis.document = {
      querySelector() {
        throw new Error('ledger-backed zone intersection must not query the DOM');
      },
      querySelectorAll() {
        throw new Error('ledger-backed zone intersection must not query the DOM');
      }
    } as unknown as Document;

    assert.deepEqual(cardsIntersectingZone('zone-a'), ['inside']);

    const source = readFileSync(new URL('frontend/src/runtime/zone/helper/cards-intersecting-zone.ts', root), 'utf8');
    assert.match(source, /state\.activeLedger/);
    assert.match(source, /ledgerCardRect/);
    assert.match(source, /ledgerZoneRect/);
  } finally {
    state.activeLedger = previousLedger;
    globalThis.document = previousDocument;
  }
});

test('zone card intersection DOM fallback uses canvas geometry without viewport layout reads', () => {
  const previousLedger = state.activeLedger;
  const previousDocument = globalThis.document;
  const previousCss = globalThis.CSS;
  const zone = element({ left: 100, top: 100, width: 300, height: 220 });
  const inside = element({ id: 'inside', left: 130, top: 160, width: 120, height: 90 });
  const outside = element({ id: 'outside', left: 460, top: 160, width: 120, height: 90 });

  try {
    state.activeLedger = null;
    globalThis.CSS = { escape: (value: string) => value } as unknown as typeof CSS;
    globalThis.document = {
      querySelector: (selector: string) => selector === '[data-zone-id="zone-a"]' ? zone : null,
      querySelectorAll: (selector: string) => selector === '.card[data-card-id]' ? [inside, outside] : []
    } as unknown as Document;

    assert.deepEqual(cardsIntersectingZone('zone-a'), ['inside']);

    const source = readFileSync(new URL('frontend/src/runtime/zone/helper/cards-intersecting-zone.ts', root), 'utf8');
    assert.doesNotMatch(source, /getBoundingClientRect/);
    assert.match(source, /CSS\.escape\(zoneId\)/);
    assert.match(source, /for \(const card of document\.querySelectorAll\('\.card\[data-card-id\]'\)\)/);
  } finally {
    state.activeLedger = previousLedger;
    globalThis.document = previousDocument;
    globalThis.CSS = previousCss;
  }
});
