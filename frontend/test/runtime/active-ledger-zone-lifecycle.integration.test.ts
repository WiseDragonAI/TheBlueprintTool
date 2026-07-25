/**
 * WHAT: Integration coverage for active-ledger loading, mutation, geometry, selection, and refresh lifecycle.
 * WHY: Server authority and local interaction continuity must remain consistent across same-ledger reloads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function deferredResponse(): {
  promise: Promise<Response>;
  resolve(response: Response): void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function ledgerResponse(ledger: Record<string, unknown>, revision: number): Response {
  return new Response(JSON.stringify(ledger), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-decision-os-ledger-revision': String(revision)
    }
  });
}

function resetLedgerReconciliation(runtimeState: Record<string, any>, ledgerStateId: string): void {
  runtimeState.ledgerReconciliation = {
    routeEpoch: 1,
    routeLedgerStateId: ledgerStateId,
    nextRequestSequence: 1,
    lastAppliedServerRevision: -1,
    lastAppliedSequence: 0,
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null
  };
}

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
      { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
      { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
    ];
    state.activeLedger = {
      cards: [{ id: `${activeTab}-card`, x: 10, y: 20, w: 240 }],
      annotations: [
        { id: `${activeTab}-keep-zone`, label: 'Keep zone', variant: 'zone', x: 1, y: 2, width: 180, height: 140 },
        { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 }
      ],
      relationships: [{ id: `${activeTab}-relationship`, source: `${activeTab}-card`, target: `${activeTab}-other-card` }],
      notes: { [`thread-${activeTab}-card`]: [] }
    };
    const serverLedger = structuredClone(state.activeLedger);
    (globalThis as any).fetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = JSON.parse(String(init.body ?? '{}'));
      if (body.action === 'create-zone' || body.action === 'create-group') serverLedger.annotations.push(body.annotation);
      if (body.action === 'delete-zones') {
        const zoneIds = new Set(body.zoneIds);
        const groupIds = new Set(body.groupIds);
        serverLedger.annotations = serverLedger.annotations.filter((entry: Record<string, unknown>) => entry.variant === 'group' ? !groupIds.has(entry.id) : !zoneIds.has(entry.id));
      }
      if (body.action === 'delete-card') {
        serverLedger.cards = serverLedger.cards.filter((entry: Record<string, unknown>) => entry.id !== body.cardId);
        serverLedger.relationships = serverLedger.relationships.filter((entry: Record<string, unknown>) => entry.source !== body.cardId && entry.target !== body.cardId);
        delete serverLedger.notes[`thread-${body.cardId}`];
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
      if (body.action === 'patch-card') {
        const card = serverLedger.cards.find((entry: Record<string, unknown>) => entry.id === body.cardPatch.id) as Record<string, unknown>;
        if (body.cardPatch.title) card.title = body.cardPatch.title;
      }
      if (body.action === 'transition-card-lifecycle') {
        const card = serverLedger.cards.find((entry: Record<string, unknown>) => entry.id === body.cardId) as Record<string, unknown>;
        card.status = body.lifecycleStatus;
      }
      if (body.action === 'append-note') {
        const deletedIds = serverLedger.deletedNoteIds?.[body.note.threadId] ?? [];
        if (deletedIds.includes(body.note.id)) return {
          ok: true,
          async json() {
            return structuredClone(serverLedger);
          }
        };
        serverLedger.notes[body.note.threadId].push({ id: 'note-1', role: 'operator', message: body.note.body, timestamp: 'now' });
      }
      if (body.action === 'delete-note') {
        const deletedNoteIds = serverLedger.deletedNoteIds ?? {};
        const tombstonedId = body.note.id || serverLedger.notes[body.note.threadId].at(-1)?.id;
        if (tombstonedId) deletedNoteIds[body.note.threadId] = Array.from(new Set([...(deletedNoteIds[body.note.threadId] ?? []), tombstonedId]));
        serverLedger.deletedNoteIds = deletedNoteIds;
        serverLedger.notes[body.note.threadId] = body.note.id
          ? serverLedger.notes[body.note.threadId].filter((entry: Record<string, unknown>) => entry.id !== body.note.id)
          : serverLedger.notes[body.note.threadId].slice(0, -1);
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

    assert.equal(calls.at(-1)?.url, `/decision-os/${activeTab}`);
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

    await commitActiveLedgerMutation({ action: 'transition-card-lifecycle', cardId: `${activeTab}-card`, lifecycleStatus: 'done' });
    assert.equal((state.activeLedger.cards[0] as Record<string, unknown>).status, 'done');

    await commitActiveLedgerMutation({ action: 'append-note', note: { threadId: `thread-${activeTab}-card`, body: 'Server note' } });
    assert.equal(state.activeLedger.notes[`thread-${activeTab}-card`].length, 1);

    await commitActiveLedgerMutation({ action: 'delete-note', note: { threadId: `thread-${activeTab}-card`, id: 'note-1' } });
    assert.equal(state.activeLedger.notes[`thread-${activeTab}-card`].length, 0);
    assert.deepEqual(state.activeLedger.deletedNoteIds[`thread-${activeTab}-card`], ['note-1']);

    state.activeLedger.notes[`thread-${activeTab}-card`].push({ id: 'note-race', role: 'operator', message: 'Optimistic stale note', optimistic: true });
    state.activeLedger.deletedNoteIds[`thread-${activeTab}-card`].push('note-race');
    serverLedger.notes[`thread-${activeTab}-card`].push({ id: 'note-race', role: 'operator', message: 'Late server note' });
    await commitActiveLedgerMutation({ action: 'patch-region', region: { id: `${activeTab}-keep-zone`, kind: 'zone', label: 'Renamed' } });
    assert.equal(state.activeLedger.notes[`thread-${activeTab}-card`].some((note: Record<string, unknown>) => note.id === 'note-race'), false);

    await commitActiveLedgerMutation({ action: 'paste-selection', selection: { cardIds: [`${activeTab}-card`], zoneIds: [], groupIds: [] } });
    assert.equal(state.activeLedger.cards.at(-1).id, `${activeTab}-card-copy`);

    await commitActiveLedgerMutation({ action: 'delete-card', cardId: `${activeTab}-card` });
    assert.deepEqual(state.activeLedger.cards.map((card: Record<string, unknown>) => card.id), [`${activeTab}-card-copy`]);
    assert.equal(state.activeLedger.relationships.length, 0);
    assert.equal(state.activeLedger.notes[`thread-${activeTab}-card`], undefined);

    await commitActiveLedgerMutation({ action: 'delete-zones', zoneIds: [`${activeTab}-created-zone`, `${activeTab}-created-group`, `${activeTab}-group`] });

    assert.deepEqual(state.activeLedger.annotations, [
      { id: `${activeTab}-keep-zone`, label: 'Renamed', variant: 'zone', x: 11, y: 22, width: 180, height: 140, color: '#ffcc00' },
      { id: `${activeTab}-group`, label: 'Keep group', variant: 'group', x: 3, y: 4, width: 280, height: 180 },
      { id: `${activeTab}-created-group`, label: 'New group', variant: 'group', x: 60, y: 70, width: 320, height: 190 }
    ]);

    await commitActiveLedgerMutation({ action: 'delete-zones', zoneIds: [], groupIds: [`${activeTab}-created-group`, `${activeTab}-group`] });

    assert.deepEqual(state.activeLedger.annotations, [
      { id: `${activeTab}-keep-zone`, label: 'Renamed', variant: 'zone', x: 11, y: 22, width: 180, height: 140, color: '#ffcc00' }
    ]);
    assert.deepEqual(state.activeLedger.cards, [
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
  state.activeLedger = null;
  state.activeLedgerId = '';
  state.ledgerTabs = [
    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
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
    assert.equal(url, '/api/ledgers/specs/canvas');
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

test('active ledger refresh keeps local canvas geometry and viewport while accepting server content', async () => {
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

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 321, y: -654, scale: 0.42 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'Local title', x: 100, y: 200, w: 300, h: 180 },
      { id: 'local-only-card', x: 900, y: 900, w: 220, h: 132 }
    ],
    annotations: [
      { id: 'zone-a', variant: 'zone', label: 'Local zone', color: '#111111', x: 10, y: 20, width: 400, height: 220 },
      { id: 'group-a', variant: 'group', label: 'Local group', x: -50, y: -60, width: 500, height: 260 }
    ],
    notes: { 'thread-card-a': [{ id: 'local-note', role: 'operator', message: 'Old local note' }] }
  };

  (globalThis as any).fetch = async (url: string) => {
    assert.equal(url, '/api/ledgers/specs/canvas');
    return {
      ok: true,
      async json() {
        return {
          cards: [
            { id: 'card-a', title: 'Server title', status: 'done', x: 1, y: 2, w: 111, h: 112 },
            { id: 'server-only-card', title: 'New server card', x: 50, y: 60, w: 240, h: 140 }
          ],
          annotations: [
            { id: 'zone-a', variant: 'zone', label: 'Server zone', color: '#55b8ff', x: 3, y: 4, width: 180, height: 140 },
            { id: 'group-a', variant: 'group', label: 'Server group', x: 5, y: 6, width: 220, height: 160 }
          ],
          notes: { 'thread-card-a': [{ id: 'server-note', role: 'agent', message: 'New server note' }] }
        };
      }
    };
  };

  await loadActiveLedgerState();

  assert.deepEqual(state.activeLedger.cards.map((card: Record<string, unknown>) => card.id), ['card-a', 'server-only-card']);
  assert.deepEqual(state.activeLedger.cards[0], { id: 'card-a', title: 'Server title', status: 'done', x: 100, y: 200, w: 300, h: 180 });
  assert.deepEqual(state.activeLedger.annotations[0], { id: 'zone-a', variant: 'zone', label: 'Server zone', color: '#55b8ff', x: 10, y: 20, width: 400, height: 220 });
  assert.deepEqual(state.activeLedger.annotations[1], { id: 'group-a', variant: 'group', label: 'Server group', x: -50, y: -60, width: 500, height: 260 });
  assert.deepEqual(state.activeLedger.notes['thread-card-a'], [{ id: 'server-note', role: 'agent', message: 'New server note' }]);
  assert.deepEqual(state.viewport, { x: 321, y: -654, scale: 0.42 });
  assert.deepEqual(state.viewports.specs, { x: 321, y: -654, scale: 0.42 });
});

test('active ledger refresh keeps viewport moves made while the server load is in flight', async () => {
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

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 10, y: 20, scale: 1 };
  state.viewports = { specs: { x: 10, y: 20, scale: 1 } };
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Local title', x: 100, y: 200, w: 300, h: 180 }],
    annotations: [],
    notes: {}
  };

  let resolveFetch!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const fetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as any).fetch = async (url: string) => {
      assert.equal(url, '/api/ledgers/specs/canvas');
      resolveStarted();
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    };
  });

  const load = loadActiveLedgerState();
  await fetchStarted;
  state.viewport = { x: 444, y: -555, scale: 0.5 };
  state.viewports = { specs: { x: 444, y: -555, scale: 0.5 } };
  resolveFetch({
    ok: true,
    async json() {
      return {
        viewport: { x: 10, y: 20, scale: 1 },
        cards: [{ id: 'card-a', title: 'Server title', x: 1, y: 2, w: 111, h: 112 }],
        annotations: [],
        notes: {}
      };
    }
  });

  await load;

  assert.deepEqual(state.viewport, { x: 444, y: -555, scale: 0.5 });
  assert.deepEqual(state.viewports.specs, { x: 444, y: -555, scale: 0.5 });
  assert.deepEqual(state.activeLedger.cards[0], { id: 'card-a', title: 'Server title', x: 100, y: 200, w: 300, h: 180 });
});

test('same-ledger active load preserves selected records and prunes missing records', async () => {
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

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.pointer = null;
  state.selection = {
    cardIds: ['card-a', 'missing-card'],
    zoneIds: ['zone-a', 'missing-zone', 'group-a'],
    groupIds: ['group-a', 'missing-group', 'zone-a']
  };
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'Local A', x: 10, y: 20, w: 240, h: 132 },
      { id: 'missing-card', title: 'Local missing', x: 100, y: 120, w: 240, h: 132 }
    ],
    annotations: [
      { id: 'zone-a', variant: 'zone', label: 'Local zone', x: 0, y: 0, width: 200, height: 140 },
      { id: 'group-a', variant: 'group', label: 'Local group', x: 20, y: 30, width: 260, height: 180 },
      { id: 'missing-zone', variant: 'zone', label: 'Local missing zone', x: 60, y: 70, width: 200, height: 140 },
      { id: 'missing-group', variant: 'group', label: 'Local missing group', x: 80, y: 90, width: 260, height: 180 }
    ],
    notes: {}
  };

  (globalThis as any).fetch = async (url: string) => {
    assert.equal(url, '/api/ledgers/specs/canvas');
    return {
      ok: true,
      async json() {
        return {
          cards: [{ id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 }],
          annotations: [
            { id: 'zone-a', variant: 'zone', label: 'Server zone', x: 3, y: 4, width: 180, height: 140 },
            { id: 'group-a', variant: 'group', label: 'Server group', x: 5, y: 6, width: 220, height: 160 }
          ],
          notes: {}
        };
      }
    };
  };

  await loadActiveLedgerState();

  assert.deepEqual(state.selection, {
    cardIds: ['card-a'],
    zoneIds: ['zone-a'],
    groupIds: ['group-a']
  });
});

test('non-geometry mutation responses keep newer local canvas geometry', async () => {
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
  const { commitActiveLedgerMutation } = await import('../../src/runtime/ledger/effect/commit-active-ledger-mutation.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Local', x: 700, y: 800, w: 360, h: 210 }],
    annotations: [{ id: 'zone-a', variant: 'zone', label: 'Local zone', x: 70, y: 80, width: 420, height: 240 }],
    notes: {}
  };

  (globalThis as any).fetch = async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body ?? '{}'));
    assert.equal(body.action, 'transition-card-lifecycle');
    return {
      ok: true,
      async json() {
        return {
          cards: [{ id: 'card-a', title: 'Server', status: 'done', x: 1, y: 2, w: 220, h: 132 }],
          annotations: [{ id: 'zone-a', variant: 'zone', label: 'Server zone', x: 3, y: 4, width: 180, height: 140 }],
          notes: {}
        };
      }
    };
  };

  const committed = await commitActiveLedgerMutation({ action: 'transition-card-lifecycle', cardId: 'card-a', lifecycleStatus: 'done' });

  assert.equal(committed, true);
  assert.deepEqual(state.activeLedger.cards[0], { id: 'card-a', title: 'Server', status: 'done', x: 700, y: 800, w: 360, h: 210 });
  assert.deepEqual(state.activeLedger.annotations[0], { id: 'zone-a', variant: 'zone', label: 'Server zone', x: 70, y: 80, width: 420, height: 240 });
});

test('patch-geometry mutation responses keep unrelated newer local canvas geometry', async () => {
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
  const { commitActiveLedgerMutation } = await import('../../src/runtime/ledger/effect/commit-active-ledger-mutation.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'Local A', x: 1000, y: 1100, w: 360, h: 210 },
      { id: 'card-b', title: 'Local B', x: 2000, y: 2100, w: 380, h: 230 }
    ],
    annotations: [
      { id: 'zone-a', variant: 'zone', label: 'Local zone A', x: 70, y: 80, width: 420, height: 240 },
      { id: 'zone-b', variant: 'zone', label: 'Local zone B', x: 170, y: 180, width: 520, height: 340 },
      { id: 'group-a', variant: 'group', label: 'Local group A', x: -70, y: -80, width: 620, height: 440 }
    ],
    notes: {}
  };

  (globalThis as any).fetch = async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body ?? '{}'));
    assert.equal(body.action, 'patch-geometry');
    assert.deepEqual(Object.keys(body.geometry.cards), ['card-b']);
    assert.deepEqual(Object.keys(body.geometry.zones), ['zone-b']);
    assert.deepEqual(Object.keys(body.geometry.groups), []);
    return {
      ok: true,
      async json() {
        return {
          cards: [
            { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
            { id: 'card-b', title: 'Server B', x: 2222, y: 2333, w: 444, h: 255 }
          ],
          annotations: [
            { id: 'zone-a', variant: 'zone', label: 'Server zone A', x: 3, y: 4, width: 180, height: 140 },
            { id: 'zone-b', variant: 'zone', label: 'Server zone B', x: 333, y: 444, width: 555, height: 222 },
            { id: 'group-a', variant: 'group', label: 'Server group A', x: 5, y: 6, width: 220, height: 160 }
          ],
          notes: {}
        };
      }
    };
  };

  const committed = await commitActiveLedgerMutation({
    action: 'patch-geometry',
    geometry: {
      cards: { 'card-b': { x: 2222, y: 2333, width: 444, height: 255 } },
      zones: { 'zone-b': { x: 333, y: 444, width: 555, height: 222 } },
      groups: {}
    }
  });

  assert.equal(committed, true);
  assert.deepEqual(state.activeLedger.cards[0], { id: 'card-a', title: 'Server A', x: 1000, y: 1100, w: 360, h: 210 });
  assert.deepEqual(state.activeLedger.cards[1], { id: 'card-b', title: 'Server B', x: 2222, y: 2333, w: 444, h: 255 });
  assert.deepEqual(state.activeLedger.annotations[0], { id: 'zone-a', variant: 'zone', label: 'Server zone A', x: 70, y: 80, width: 420, height: 240 });
  assert.deepEqual(state.activeLedger.annotations[1], { id: 'zone-b', variant: 'zone', label: 'Server zone B', x: 333, y: 444, width: 555, height: 222 });
  assert.deepEqual(state.activeLedger.annotations[2], { id: 'group-a', variant: 'group', label: 'Server group A', x: -70, y: -80, width: 620, height: 440 });
});

test('reverse-order concurrent loads retain the highest server revision', async () => {
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 14, y: 28, scale: 0.8 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Initial', x: 10, y: 20, w: 240, h: 132 }],
    annotations: [],
    relationships: [],
    notes: {}
  };
  resetLedgerReconciliation(state, 'specs');

  const responses = [deferredResponse(), deferredResponse()];
  let requestIndex = 0;
  globalThis.fetch = (() => responses[requestIndex++].promise) as typeof fetch;

  const olderLoad = loadActiveLedgerState();
  const newerLoad = loadActiveLedgerState();
  responses[1].resolve(ledgerResponse({
    cards: [{ id: 'card-a', title: 'Revision 12', x: 12, y: 24, w: 260, h: 140 }],
    annotations: [], relationships: [], notes: {}
  }, 12));
  assert.equal(await newerLoad, true);
  responses[0].resolve(ledgerResponse({
    cards: [{ id: 'card-a', title: 'Revision 11', x: 11, y: 22, w: 250, h: 136 }],
    annotations: [], relationships: [], notes: {}
  }, 11));

  assert.equal(await olderLoad, false);
  assert.equal(state.activeLedger.cards[0].title, 'Revision 12');
  assert.equal(state.ledgerReconciliation.lastAppliedServerRevision, 12);
  assert.deepEqual(state.viewport, { x: 14, y: 28, scale: 0.8 });
  assert.deepEqual(state.selection.cardIds, ['card-a']);
});

test('a response from the previous route epoch cannot replace the newly entered ledger', async () => {
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [
    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
  ];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 }, data: { x: 40, y: 50, scale: 0.7 } };
  state.selection = { cardIds: ['spec-card'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = { cards: [{ id: 'spec-card', title: 'Specs' }], annotations: [], relationships: [], notes: {} };
  resetLedgerReconciliation(state, 'specs');

  const specsResponse = deferredResponse();
  const dataResponse = deferredResponse();
  globalThis.fetch = ((url: string) => {
    if (url === '/api/ledgers/specs/canvas') return specsResponse.promise;
    if (url === '/api/ledgers/data/canvas') return dataResponse.promise;
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const oldRouteLoad = loadActiveLedgerState();
  const newRouteLoad = loadActiveLedgerState({
    activeTab: 'data',
    canvasMode: 'ledger',
    endpoint: '/api/ledgers/data/canvas',
    ledgerStateId: 'data'
  });
  dataResponse.resolve(ledgerResponse({
    cards: [{ id: 'data-card', title: 'Data revision 3' }], annotations: [], relationships: [], notes: {}
  }, 3));
  assert.equal(await newRouteLoad, true);
  specsResponse.resolve(ledgerResponse({
    cards: [{ id: 'spec-card', title: 'Late specs revision 99' }], annotations: [], relationships: [], notes: {}
  }, 99));

  assert.equal(await oldRouteLoad, false);
  assert.equal(state.activeLedgerId, 'data');
  assert.deepEqual(state.activeLedger.cards.map((card: Record<string, unknown>) => card.id), ['data-card']);
  assert.equal(state.ledgerReconciliation.routeLedgerStateId, 'data');
  assert.equal(state.ledgerReconciliation.lastAppliedServerRevision, 3);
  assert.deepEqual(state.viewport, { x: 40, y: 50, scale: 0.7 });
  assert.deepEqual(state.selection, { cardIds: [], zoneIds: [], groupIds: [] });
});

test('a geometry acknowledgement cannot overwrite a later edit to the same record', async () => {
  const { state } = await import('../../src/runtime/state.js');
  const { commitActiveLedgerMutation } = await import('../../src/runtime/ledger/effect/commit-active-ledger-mutation.js');
  const { patchLedgerCardGeometry } = await import('../../src/runtime/ledger/helper/active-ledger-geometry.js');
  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 132 }],
    annotations: [], relationships: [], notes: {}
  };
  resetLedgerReconciliation(state, 'specs');

  patchLedgerCardGeometry(state.activeLedger.cards[0], { x: 100, y: 120, width: 260, height: 150 });
  const submittedRevision = state.ledgerReconciliation.localGeometryRevisions['card:card-a'];
  let resolveMutation!: (response: Response) => void;
  let markMutationStarted!: () => void;
  const mutationStarted = new Promise<void>((resolve) => { markMutationStarted = resolve; });
  let submittedBody!: Record<string, any>;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    submittedBody = JSON.parse(String(init?.body ?? '{}'));
    markMutationStarted();
    return new Promise<Response>((resolve) => { resolveMutation = resolve; });
  }) as typeof fetch;

  const commit = commitActiveLedgerMutation({
    action: 'patch-geometry',
    geometry: { cards: { 'card-a': { x: 100, y: 120, width: 260, height: 150 } }, zones: {}, groups: {} }
  });
  await mutationStarted;
  patchLedgerCardGeometry(state.activeLedger.cards[0], { x: 300, y: 320, width: 340, height: 210 });
  const laterRevision = state.ledgerReconciliation.localGeometryRevisions['card:card-a'];
  assert.ok(laterRevision > submittedRevision);
  resolveMutation(ledgerResponse({
    cards: [{ id: 'card-a', title: 'Server Card A', x: 100, y: 120, w: 260, h: 150 }],
    annotations: [], relationships: [], notes: {}
  }, 20));

  assert.equal(await commit, true);
  assert.deepEqual(submittedBody.geometry.cards['card-a'], { x: 100, y: 120, width: 260, height: 150 });
  assert.deepEqual(state.activeLedger.cards[0], {
    id: 'card-a', title: 'Server Card A', x: 300, y: 320, w: 340, h: 210
  });
  assert.equal(state.ledgerReconciliation.localGeometryRevisions['card:card-a'], laterRevision);
  assert.equal(state.ledgerReconciliation.lastAppliedServerRevision, 20);
});

test('a direct task mutation receipt cannot lend its clock to a causally stale confirmation snapshot', async () => {
  (globalThis as any).window = {
    location: { pathname: '/tasks' },
    dispatchEvent() {},
    __coreTelemetry: [],
  };
  const { state } = await import('../../src/runtime/state.js');
  const { commitActiveLedgerMutation } = await import('../../src/runtime/ledger/effect/commit-active-ledger-mutation.js');
  state.canvasMode = 'ledger';
  state.activeTab = 'tasks';
  state.activeLedgerId = 'tasks';
  state.ledgerTabs = [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }];
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Locally committed task', status: 'todo' }],
    annotations: [],
    relationships: [],
    notes: { 'thread-card-a': [{ id: 'note-a', message: 'Local message' }] },
  };
  resetLedgerReconciliation(state, 'tasks');
  state.ledgerReconciliation.lastAppliedTaskClock = { workstation: 7, phone: 20 };
  let requestCount = 0;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    requestCount += 1;
    if (requestCount === 1) {
      const mutation = JSON.parse(String(init?.body ?? '{}')) as { mutationId: string };
      return new Response(JSON.stringify({
        ok: true,
        ledgerId: 'tasks',
        taskClock: { workstation: 8, phone: 20 },
        receipt: { mutationId: mutation.mutationId, clock: { workstation: 8, phone: 20 }, entities: [] },
      }), { status: 200, headers: { 'content-type': 'application/json', 'x-decision-os-ledger-revision': '8' } });
    }
    return new Response(JSON.stringify({
      cards: [{ id: 'card-a', title: 'Delayed relay task', status: 'todo' }],
      annotations: [],
      relationships: [],
      notes: { 'thread-card-a': [{ id: 'note-a', message: 'Delayed relay message' }] },
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-decision-os-ledger-revision': '9',
        'x-decision-os-task-clock': Buffer.from(JSON.stringify({ workstation: 7, phone: 21 })).toString('base64url'),
      },
    });
  }) as typeof fetch;

  // WHAT: Give the mutation acknowledgement and its confirmation snapshot different causal clocks.
  // WHY: Reconciliation must judge the installed bytes by the snapshot clock, not borrow authority from the receipt response.
  const committed = await commitActiveLedgerMutation({
    action: 'transition-card-lifecycle',
    cardId: 'card-a',
    lifecycleStatus: 'todo',
  });

  assert.equal(committed, false);
  assert.equal(requestCount, 2);
  assert.equal(state.activeLedger.cards[0].title, 'Locally committed task');
  assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Local message');
  assert.deepEqual(state.ledgerReconciliation.lastAppliedTaskClock, { workstation: 8, phone: 20 });
});
