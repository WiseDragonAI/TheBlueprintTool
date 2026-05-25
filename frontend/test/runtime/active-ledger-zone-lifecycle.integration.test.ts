import test from 'node:test';
import assert from 'node:assert/strict';

test('specs and data ledger tabs commit canvas mutations through the server ledger endpoint', async () => {
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
  (globalThis as any).document = {
    querySelector() {
      return {
        style: { setProperty() {} },
        classList: { toggle() {}, add() {}, remove() {} },
        append() {},
        appendChild() {},
        replaceChildren() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {}
      };
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return {
        style: { setProperty() {} },
        classList: { toggle() {}, add() {}, remove() {} },
        dataset: {},
        append() {},
        appendChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {}
      };
    },
    createElementNS() {
      return {
        setAttribute() {},
        appendChild() {}
      };
    }
  };

  const { state } = await import('../../src/runtime/state.js');
  const { createLedgerZoneAnnotation } = await import('../../src/runtime/ledger/helper/create-ledger-zone-annotation.js');
  const { createLedgerGroupAnnotation } = await import('../../src/runtime/ledger/helper/create-ledger-group-annotation.js');
  const { commitActiveLedgerMutation } = await import('../../src/runtime/ledger/effect/commit-active-ledger-mutation.js');

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
      ],
      notes: { [`thread-${activeTab}-card`]: [] }
    };
    const serverLedger = structuredClone(state.activeLedger);
    (globalThis as any).fetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = JSON.parse(String(init.body ?? '{}'));
      if (body.action === 'create-zone' || body.action === 'create-group') serverLedger.annotations.push(body.annotation);
      if (body.action === 'delete-zones') {
        const ids = new Set(body.zoneIds);
        serverLedger.annotations = serverLedger.annotations.filter((entry: Record<string, unknown>) => entry.variant === 'group' || !ids.has(entry.id));
      }
      if (body.action === 'patch-geometry') {
        const card = serverLedger.cards.find((entry: Record<string, unknown>) => entry.id === `${activeTab}-card`) as Record<string, unknown>;
        card.x = body.geometry.cards[`${activeTab}-card`].x;
        card.y = body.geometry.cards[`${activeTab}-card`].y;
        card.w = body.geometry.cards[`${activeTab}-card`].width;
        const zone = serverLedger.annotations.find((entry: Record<string, unknown>) => entry.id === `${activeTab}-keep-zone`) as Record<string, unknown>;
        zone.x = body.geometry.zones[`${activeTab}-keep-zone`].x;
        zone.y = body.geometry.zones[`${activeTab}-keep-zone`].y;
      }
      if (body.action === 'patch-region') {
        const region = serverLedger.annotations.find((entry: Record<string, unknown>) => entry.id === body.region.id) as Record<string, unknown>;
        if (body.region.label) region.label = body.region.label;
        if (body.region.color) region.color = body.region.color;
      }
      if (body.action === 'append-note') {
        serverLedger.notes[body.note.threadId].push({ id: 'note-1', role: 'operator', message: body.note.body, timestamp: 'now' });
      }
      if (body.action === 'delete-note') {
        serverLedger.notes[body.note.threadId] = serverLedger.notes[body.note.threadId].slice(0, -1);
      }
      if (body.action === 'paste-selection') {
        serverLedger.cards.push({ id: `${activeTab}-card-copy`, x: 58, y: 68, w: 240 });
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
      rect: { x: -40, y: -50, width: 260, height: 170 },
      color: '#d946ef'
    });
    await commitActiveLedgerMutation({ action: 'create-zone', annotation });

    assert.equal(calls.at(-1)?.url, `/blueprinttool/${activeTab}`);
    assert.equal(calls.at(-1)?.init.method, 'PATCH');
    assert.equal(state.activeLedger.annotations.length, 3);
    assert.deepEqual(state.activeLedger.annotations.at(-1), {
      id: `${activeTab}-created-zone`,
      label: 'New zone',
      variant: 'zone',
      color: '#d946ef',
      x: -40,
      y: -50,
      width: 260,
      height: 170
    });

    await commitActiveLedgerMutation({ action: 'create-group', annotation: createLedgerGroupAnnotation({
      id: `${activeTab}-created-group`,
      rect: { x: 60, y: 70, width: 320, height: 190 }
    }) });

    assert.equal(state.activeLedger.annotations.at(-1).variant, 'group');

    await commitActiveLedgerMutation({
      action: 'patch-geometry',
      geometry: {
        cards: { [`${activeTab}-card`]: { x: 111, y: 122, width: 333, height: 99 } },
        zones: { [`${activeTab}-keep-zone`]: { x: 11, y: 22, width: 188, height: 144 } },
        groups: {}
      }
    });

    assert.deepEqual(state.activeLedger.cards[0], { id: `${activeTab}-card`, x: 111, y: 122, w: 333 });
    assert.equal(state.activeLedger.annotations[0].x, 11);

    await commitActiveLedgerMutation({ action: 'patch-region', region: { id: `${activeTab}-keep-zone`, kind: 'zone', label: 'Renamed', color: '#ffcc00' } });

    assert.equal(state.activeLedger.annotations[0].label, 'Renamed');
    assert.equal(state.activeLedger.annotations[0].color, '#ffcc00');

    await commitActiveLedgerMutation({ action: 'append-note', note: { threadId: `thread-${activeTab}-card`, body: 'Server note' } });
    assert.equal(state.activeLedger.notes[`thread-${activeTab}-card`].length, 1);

    await commitActiveLedgerMutation({ action: 'delete-note', note: { threadId: `thread-${activeTab}-card` } });
    assert.equal(state.activeLedger.notes[`thread-${activeTab}-card`].length, 0);

    await commitActiveLedgerMutation({ action: 'paste-selection', selection: { cardIds: [`${activeTab}-card`], zoneIds: [], groupIds: [] } });
    assert.equal(state.activeLedger.cards.at(-1).id, `${activeTab}-card-copy`);

    await commitActiveLedgerMutation({ action: 'delete-zones', zoneIds: [`${activeTab}-created-zone`, `${activeTab}-created-group`, `${activeTab}-group`] });

    assert.deepEqual(state.activeLedger.annotations, [
      { id: `${activeTab}-keep-zone`, label: 'Renamed', variant: 'zone', x: 11, y: 22, width: 180, height: 140, color: '#ffcc00' },
      { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 },
      { id: `${activeTab}-created-group`, label: 'New group', variant: 'group', x: 60, y: 70, width: 320, height: 190 }
    ]);
    assert.deepEqual(state.activeLedger.cards, [
      { id: `${activeTab}-card`, x: 111, y: 122, w: 333 },
      { id: `${activeTab}-card-copy`, x: 58, y: 68, w: 240 }
    ]);
  }
});

test('active ledger load keeps server geometry authoritative over stale browser persistence', async () => {
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
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');

  state.activeTab = 'specs';
  state.ledgerTabs = [
    { id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.blueprinttool/data.json' }
  ];
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };

  (globalThis as any).localStorage = {
    getItem() {
      return JSON.stringify({
        geometry: {
          cards: { 'spec-card': { x: 999, y: 999, width: 999, height: 99 } },
          zones: { 'spec-zone': { x: 888, y: 888, width: 888, height: 888 } },
          groups: {}
        },
        regionEdits: {
          'spec-zone': { label: 'stale local label', color: '#000000' }
        }
      });
    }
  };

  (globalThis as any).fetch = async (url: string) => {
    assert.equal(url, '/blueprinttool/specs');
    return {
      ok: true,
      async json() {
        return {
          cards: [{ id: 'spec-card', x: 10, y: 20, w: 240 }],
          annotations: [{ id: 'spec-zone', variant: 'zone', label: 'server label', color: '#55b8ff', x: 30, y: 40, width: 180, height: 140 }]
        };
      }
    };
  };

  await loadActiveLedgerState();

  assert.deepEqual(state.activeLedger.cards[0], { id: 'spec-card', x: 10, y: 20, w: 240 });
  assert.deepEqual(state.activeLedger.annotations[0], {
    id: 'spec-zone',
    variant: 'zone',
    label: 'server label',
    color: '#55b8ff',
    x: 30,
    y: 40,
    width: 180,
    height: 140
  });
});
