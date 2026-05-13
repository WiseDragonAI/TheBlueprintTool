import test from 'node:test';
import assert from 'node:assert/strict';

test('sync-active-ledger-geometry updates active ledger coordinates from moved ledger nodes', async () => {
  (globalThis as any).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  (globalThis as any).window = {
    location: { pathname: '/specs' },
    dispatchEvent() {},
    __coreTelemetry: []
  };
  const { state } = await import('../../../../src/runtime/state.js');
  const { syncActiveLedgerGeometry } = await import('../../../../src/runtime/ledger/effect/sync-active-ledger-geometry.js');
  state.activeTab = 'specs';
  state.activeLedger = {
    cards: [{ id: 'card-a', x: 10, y: 20, w: 240 }],
    annotations: [{ id: 'zone-a', x: 1, y: 2, width: 180, height: 140 }]
  };
  const card = {
    classList: { contains: (name: string) => name === 'ledger-node' },
    dataset: { cardId: 'card-a' },
    offsetLeft: 88,
    offsetTop: 99,
    offsetWidth: 260,
    offsetHeight: 130
  } as unknown as HTMLElement;
  const zone = {
    classList: { contains: (name: string) => name === 'ledger-node' },
    dataset: { zoneId: 'zone-a' },
    offsetLeft: 120,
    offsetTop: 140,
    offsetWidth: 320,
    offsetHeight: 180
  } as unknown as HTMLElement;
  syncActiveLedgerGeometry([card, zone]);
  assert.deepEqual(state.activeLedger.cards[0], { id: 'card-a', x: 88, y: 99, w: 260 });
  assert.deepEqual(state.activeLedger.annotations[0], { id: 'zone-a', x: 120, y: 140, width: 320, height: 180 });
});
