import test from 'node:test';
import assert from 'node:assert/strict';

test('specs and data ledger tabs keep zone create and delete in the active ledger model', async () => {
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

  const { state } = await import('../../src/runtime/state.js');
  const { createLedgerZoneAnnotation } = await import('../../src/runtime/ledger/helper/create-ledger-zone-annotation.js');
  const { addActiveLedgerZone } = await import('../../src/runtime/ledger/effect/add-active-ledger-zone.js');
  const { removeActiveLedgerZones } = await import('../../src/runtime/ledger/effect/remove-active-ledger-zones.js');

  for (const activeTab of ['specs', 'data']) {
    state.activeTab = activeTab;
    state.activeLedger = {
      cards: [{ id: `${activeTab}-card`, x: 10, y: 20, w: 240 }],
      annotations: [
        { id: `${activeTab}-keep-zone`, label: 'Keep zone', variant: 'zone', x: 1, y: 2, width: 180, height: 140 },
        { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 }
      ]
    };

    const annotation = createLedgerZoneAnnotation({
      id: `${activeTab}-created-zone`,
      rect: { x: 40, y: 50, width: 260, height: 170 },
      color: '#55b8ff'
    });
    addActiveLedgerZone(annotation);

    assert.equal(state.activeLedger.annotations.length, 3);
    assert.deepEqual(state.activeLedger.annotations.at(-1), {
      id: `${activeTab}-created-zone`,
      label: 'New zone',
      variant: 'zone',
      color: '#55b8ff',
      x: 40,
      y: 50,
      width: 260,
      height: 170
    });

    removeActiveLedgerZones([`${activeTab}-created-zone`, `${activeTab}-group`]);

    assert.deepEqual(state.activeLedger.annotations, [
      { id: `${activeTab}-keep-zone`, label: 'Keep zone', variant: 'zone', x: 1, y: 2, width: 180, height: 140 },
      { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 }
    ]);
    assert.deepEqual(state.activeLedger.cards, [{ id: `${activeTab}-card`, x: 10, y: 20, w: 240 }]);
  }
});
