import test from 'node:test';
import assert from 'node:assert/strict';

test('specs and data ledger tabs commit zone create and delete through the server ledger endpoint', async () => {
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
  const { commitActiveLedgerZoneMutation } = await import('../../src/runtime/ledger/effect/commit-active-ledger-zone-mutation.js');

  for (const activeTab of ['specs', 'data']) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    state.activeTab = activeTab;
    state.ledgerTabs = [
      { id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' },
      { id: 'data', title: 'Data', ledgerFile: '.blueprinttool/data.json' }
    ];
    state.activeLedger = {
      cards: [{ id: `${activeTab}-card`, x: 10, y: 20, w: 240 }],
      annotations: [
        { id: `${activeTab}-keep-zone`, label: 'Keep zone', variant: 'zone', x: 1, y: 2, width: 180, height: 140 },
        { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 }
      ]
    };
    const serverLedger = structuredClone(state.activeLedger);
    (globalThis as any).fetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = JSON.parse(String(init.body ?? '{}'));
      if (body.action === 'create-zone') serverLedger.annotations.push(body.annotation);
      if (body.action === 'delete-zones') {
        const ids = new Set(body.zoneIds);
        serverLedger.annotations = serverLedger.annotations.filter((entry: Record<string, unknown>) => entry.variant === 'group' || !ids.has(entry.id));
      }
      return {
        ok: true,
        async json() {
          return structuredClone(serverLedger);
        }
      };
    };

    const annotation = createLedgerZoneAnnotation({
      id: `${activeTab}-created-zone`,
      rect: { x: 40, y: 50, width: 260, height: 170 },
      color: '#55b8ff'
    });
    await commitActiveLedgerZoneMutation({ action: 'create-zone', annotation });

    assert.equal(calls.at(-1)?.url, `/blueprinttool/${activeTab}`);
    assert.equal(calls.at(-1)?.init.method, 'PATCH');
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

    await commitActiveLedgerZoneMutation({ action: 'delete-zones', zoneIds: [`${activeTab}-created-zone`, `${activeTab}-group`] });

    assert.deepEqual(state.activeLedger.annotations, [
      { id: `${activeTab}-keep-zone`, label: 'Keep zone', variant: 'zone', x: 1, y: 2, width: 180, height: 140 },
      { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 }
    ]);
    assert.deepEqual(state.activeLedger.cards, [{ id: `${activeTab}-card`, x: 10, y: 20, w: 240 }]);
  }
});
