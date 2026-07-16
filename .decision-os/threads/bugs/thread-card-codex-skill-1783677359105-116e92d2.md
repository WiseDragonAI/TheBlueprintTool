# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-1","timestamp":"2026-07-10T09:56:02.724Z","status":"running","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-2","timestamp":"2026-07-10T09:56:02.724Z","status":"running","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-3","timestamp":"2026-07-10T09:56:14.859Z","status":"Codex message","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’m using the `task-dependency` skill because this run starts from a ready task inventory and must produce dependency edges, safe implementation groups, gates, and readiness. I’ll inspect only the relevant ownership and state surfaces, then write the requested card without changing product code or running tests.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-4","timestamp":"2026-07-10T09:56:16.694Z","status":"in_progress","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/task-dependency/SKILL.md\nsed -n '1,260p' frontend/src/runtime/card/effect/create-card-from-rect.ts\nrg -n \\\"card creation preserves canvas x and y|createCardFromRect|threadPanelOpen|threadId|state\\\\.selection\\\" frontend/test/runtime/canvas-pan-performance.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/task-dependency/SKILL.md
sed -n '1,260p' frontend/src/runtime/card/effect/create-card-from-rect.ts
rg -n \"card creation preserves canvas x and y|createCardFromRect|threadPanelOpen|threadId|state\\.selection\" frontend/test/runtime/canvas-pan-performance.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-5","timestamp":"2026-07-10T09:56:16.694Z","status":"completed","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/task-dependency/SKILL.md\nsed -n '1,260p' frontend/src/runtime/card/effect/create-card-from-rect.ts\nrg -n \\\"card creation preserves canvas x and y|createCardFromRect|threadPanelOpen|threadId|state\\\\.selection\\\" frontend/test/runtime/canvas-pan-performance.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/task-dependency/SKILL.md
sed -n '1,260p' frontend/src/runtime/card/effect/create-card-from-rect.ts
rg -n \"card creation preserves canvas x and y|createCardFromRect|threadPanelOpen|threadId|state\\.selection\" frontend/test/runtime/canvas-pan-performance.integration.test.ts"`
Status: completed
Exit code: 0

````text
---
name: task-dependency
description: Analyze a `task-list` inventory and create dependency edges, independent implementation groups, sequential gates, collision risks, and readiness for `task-group-completeness`. Use after `task-list` returns `READY_FOR_TASK_DEPENDENCY` and before implementation grouping is audited.
---

# Task Dependency

## A. Scope

1. **Purpose.** Convert the flat `task-list` inventory into a dependency graph and implementation groups that can be worked independently where the evidence supports it.
2. **Start point.** Use this skill only after the upstream `task-list` output includes `Task Inventory`, `Open Questions`, and `Readiness`.
3. **Readiness gate.** Continue only when the upstream readiness value is `READY_FOR_TASK_DEPENDENCY`.
4. **Stop point.** Do not implement tasks, run tests, judge group completeness, or dispatch implementation workers.

---

## B. Required Inputs

1. **Task inventory.** Read the complete `task-list` output, including every `id`, `type`, `title`, `target_files`, `target_symbols`, `action`, `done_when`, and `depends_on` value.
2. **Source material.** Read any source cards, specs, architecture notes, codebase surface maps, data model notes, runtime state notes, migration notes, fixture notes, and test strategy included with the run.
3. **Codebase evidence.** Inspect the codebase only as needed to verify dependency evidence, shared ownership, file-family collisions, runtime-state coupling, migration order, and test fixture order.

---

## C. Dependency Construction

1. **Seed explicit edges.** Treat each populated `depends_on` value from `task-list` as an explicit dependency edge before inferring additional edges.
2. **Infer required edges.** Add an inferred edge only when file ownership, symbol ownership, data flow, runtime state, migration order, fixture setup, API contract order, or test setup proves that one task must happen before another task.
3. **Classify every edge.** Use exactly one edge type: `hard-blocker`, `shared-file-risk`, `shared-state-risk`, `test-order-risk`, `migration-order-risk`, or `soft-ordering`.
4. **Ground every edge.** Record the concrete evidence for each edge from task fields, source material, file paths, symbols, migrations, fixtures, tests, or runtime state.
5. **Preserve uncertainty.** Put unclear relationships in `Ambiguities` instead of forcing a dependency edge or an implementation group.

---

## D. Group Construction

1. **Place every task.** Put every task in exactly one proposed implementation group unless the task is explicitly blocked by an ambiguity.
2. **Keep collision-prone work together.** Keep tasks in the same group when splitting them would force multiple workers to edit the same file family, state object, migration chain, fixture, scenario setup, or test harness.
3. **Separate independent work.** Split tasks into separate groups only when their target files, target symbols, tests, fixtures, runtime state, and data assumptions can be changed independently.
4. **Respect gates.** Preserve sequential gates between groups when one group creates an API, schema, migration, fixture, state contract, or shared behavior that another group consumes.
5. **Avoid fake parallelism.** Do not optimize for maximum group count when shared-file conflicts would make parallel work unsafe.

---

## E. Output Contract

1. **`Dependency Graph`.** Produce a table with `from_task`, `to_task`, `edge_type`, `reason`, and `evidence`.
2. **`Independent Task Groups`.** Produce a table with `group_id`, `task_ids`, `target_files`, `target_symbols`, `independence_reason`, and `dispatch_notes`.
3. **`Sequential Gates`.** List group-to-group gates with the required completion condition for each downstream group.
4. **`Collision Risks`.** List files, symbols, tests, fixtures, migrations, data models, and runtime state that make parallel work unsafe.
5. **`Ambiguities`.** List only dependency questions that block reliable grouping.
6. **`Readiness`.** End with exactly one readiness value. Use `READY_FOR_TASK_GROUP_COMPLETENESS` when grouping is reliable. Use `BLOCKED_NEEDS_OPERATOR_ANSWER` when an operator answer is required.

---

## F. Hard Rules

1. **No implementation.** Do not edit product code, tests, fixtures, migrations, config, or docs while using this skill.
2. **No test runs.** Do not run verification commands while creating the dependency graph.
3. **No invented tasks.** Do not create implementation tasks; report missing or unsafe work as an ambiguity for the next gate.
4. **No hidden blockers.** Do not put an ambiguous task into a group just to make every task appear dispatchable.
5. **No duplicate placement.** Do not place the same task in multiple implementation groups.
6. **No generic rationale.** Keep output concrete and limited to edges, groups, gates, collision risks, ambiguities, and readiness.
/**
 * WHAT: Creates a canvas card from a drawn rectangle in active-ledger or standalone DOM mode.
 * WHY: Draw gestures need immediate local feedback while active-ledger persistence reconciles asynchronously.
 */
import { content } from '../../dom.js';
import { createCardResizeHandles } from '../component/create-card-resize-handles.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { createLedgerObjectId } from '../../ledger/helper/create-ledger-object-id.js';
import { createLedgerCardTitleRow } from '../../ledger/component/render-ledger-card-detail-layer.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { insertActiveLedgerCard } from '../../ledger/helper/active-ledger-geometry.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';

export async function createCardFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const cardId = createLedgerObjectId('card');
  const card = {
    id: cardId,
    title: state.canvasMode === 'ledgers' ? 'New Ledger' : 'New card',
    cardType: state.canvasMode === 'ledgers' ? 'ledger' : 'note',
    domainId: state.canvasMode === 'ledgers' ? 'ledgers' : state.activeTab,
    status: 'todo',
    x: rect.x,
    y: rect.y,
    w: Math.max(260, rect.width),
    h: Math.max(132, rect.height),
    comment: { what: 'New description' },
  };

  // WHAT: Insert and render the card immediately when ledger state owns the canvas.
  // WHY: The operator should not wait for a server round trip before seeing the drawn record.
  if (state.activeLedger) {
    insertActiveLedgerCard(card);
    refreshZoneAttributionCache('optimistic-create-card');
    state.selection = { cardIds: [cardId], zoneIds: [], groupIds: [] };
    telemetry('render-card-layer', { created: cardId, activeTab: state.activeTab, authority: 'optimistic-client' });
    renderCanvasSurface({ renderThreadPanel: false });
    await commitActiveLedgerMutation({ action: 'create-card', card });
    return;
  }

  const element = document.createElement('article');
  element.className = 'card selected';
  element.dataset.cardId = cardId;
  element.dataset.threadId = `thread-${cardId}`;
  element.style.left = `${card.x}px`;
  element.style.top = `${card.y}px`;
  element.style.width = `${card.w}px`;
  element.style.height = `${card.h}px`;
  element.replaceChildren(
    ...createCardResizeHandles(),
    createLedgerCardTitleRow(card, cardId),
    Object.assign(document.createElement('div'), { className: 'ledger-card-body', innerHTML: '<p>New description</p>' })
  );
  content.insertBefore(element, content.querySelector('.marquee'));
  state.selection = { cardIds: [cardId], zoneIds: [], groupIds: [] };
  telemetry('commit-static-surface-edit', { createCard: cardId, geometry: rect });
  telemetry('render-card-layer', { created: cardId });
}
551:  const previousSelection = state.selection;
553:  state.selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: ['group-a'] };
583:    state.selection = previousSelection;
589:  const previousSelection = state.selection;
590:  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
606:    state.selection = previousSelection;
610:test('card creation preserves canvas x and y instead of clamping to positive space', () => {
652:  state.threadPanelOpen = false;
655:  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
715:  state.threadPanelOpen = false;
718:  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
775:  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
819:  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-6","timestamp":"2026-07-10T09:56:20.128Z","status":"in_progress","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"6","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nrg -n \\\"export function selectTarget|function selectTarget|const selectTarget\\\" frontend/src/runtime\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
rg -n \"export function selectTarget|function selectTarget|const selectTarget\" frontend/src/runtime"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-7","timestamp":"2026-07-10T09:56:20.128Z","status":"completed","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"7","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\nrg -n \\\"export function selectTarget|function selectTarget|const selectTarget\\\" frontend/src/runtime\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '600,760p' frontend/test/runtime/canvas-pan-performance.integration.test.ts
rg -n \"export function selectTarget|function selectTarget|const selectTarget\" frontend/src/runtime"`
Status: completed
Exit code: 0

````text
    assert.equal(derivePointerIntent(ctrlZoneEvent, 'zone', null), 'pan');

    state.activeTool = 'select';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'pan');
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card creation preserves canvas x and y instead of clamping to positive space', () => {
  const createCard = source('frontend/src/runtime/card/effect/create-card-from-rect.ts');
  assert.match(createCard, /x:\s*rect\.x/);
  assert.match(createCard, /y:\s*rect\.y/);
  assert.doesNotMatch(createCard, /x:\s*Math\.max\(0,\s*rect\.x\)/);
  assert.doesNotMatch(createCard, /y:\s*Math\.max\(0,\s*rect\.y\)/);
});

test('direct canvas pointer down clears selection before pointer up', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /7d2c8b91/);
  assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
  assert.match(pointerDown, /canvas-background-pointer-down/);
  assert.match(pointerDown, /renderSelectionState\(\)/);
  assert.doesNotMatch(pointerUp, /canvas-background-click/);
  assert.doesNotMatch(pointerUp, /targetKind === 'canvas' && moved < 4[\s\S]*clear-transient-selection/);
});

test('plain pan pointer up does not force a full canvas rerender', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
  assert.match(pointerUp, /let releaseRendered = false/);
  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(gestureSelection\)/);
  assert.match(pointerUp, /if \(pointerIntent !== 'pan' && !releaseRendered\) renderCanvasSurface\(\)/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
});

test('manual runtime refresh preserves an active pan pointer and allows pan to continue', async () => {
  installCanvasRuntimeDom();
  const { refreshRuntimeState } = await import('../../src/runtime/refresh/controller/refresh-runtime-state.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 10, y: 20, scale: 1 };
  state.viewports = { specs: { x: 10, y: 20, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
  state.pointer = {
    intent: 'pan',
    targetKind: 'canvas',
    targetId: '',
    target: canvasDom.canvas,
    resizeHandle: null,
    start: { x: 100, y: 100 },
    current: { x: 100, y: 100 },
    startCanvas: { x: 100, y: 100 },
    currentCanvas: { x: 100, y: 100 },
    startedAt: 0
  };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      if (url === '/decision-os/data') return { ok: true, async json() { return {}; } };
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const refresh = refreshRuntimeState();
  await ledgerFetchStarted;
  resolveLedger({
    ok: true,
    async json() {
      return { cards: [], annotations: [], relationships: [], notes: {} };
    }
  });
  await refresh;

  assert.equal(state.pointer.intent, 'pan');
  handlePointerMove(canvasPointerEvent(130, 90));

  assert.deepEqual(state.viewport, { x: 40, y: 10, scale: 1 });
  assert.equal(canvasDom.content.style.transform, 'translate(40px, 10px) scale(1)');

  await handlePointerUp(canvasPointerEvent(130, 90));

  assert.equal(state.pointer, null);
  assert.deepEqual(JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}').viewport, { x: 40, y: 10, scale: 1 });
});

test('wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence', async () => {
  installCanvasRuntimeDom();
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handleWheel } = await import('../../src/runtime/gesture/controller/handle-wheel.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const load = loadActiveLedgerState();
  await ledgerFetchStarted;

  handleWheel(canvasWheelEvent({ clientX: 100, clientY: 80, deltaY: -120 }));
  const latestViewport = { ...state.viewport };
  assert.ok(latestViewport.scale > 1);

  resolveLedger({
    ok: true,
    async json() {
      return {
        viewport: { x: 999, y: 999, scale: 0.25 },
        cards: [],
        annotations: [],
        relationships: [],
        notes: {}
      };
    }
  });
  await load;

  assert.deepEqual(state.viewport, latestViewport);
  assert.deepEqual(state.viewports.specs, latestViewport);

  await waitForTimer(170);
  const persisted = JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}');
  assert.deepEqual(persisted.viewport, latestViewport);
  assert.deepEqual(persisted.viewports.specs, latestViewport);
frontend/src/runtime/selection/controller/select-target.ts:11:export function selectTarget(kind: string, id: string, additive: boolean): void {
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-8","timestamp":"2026-07-10T09:56:23.188Z","status":"in_progress","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"8","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"sed -n '1,180p' frontend/src/runtime/selection/controller/select-target.ts\nsed -n '1,140p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,180p' frontend/src/runtime/selection/controller/select-target.ts
sed -n '1,140p' frontend/test/runtime/canvas-pan-performance.integration.test.ts"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-9","timestamp":"2026-07-10T09:56:23.188Z","status":"completed","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"9","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"sed -n '1,180p' frontend/src/runtime/selection/controller/select-target.ts\nsed -n '1,140p' frontend/test/runtime/canvas-pan-performance.integration.test.ts\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,180p' frontend/src/runtime/selection/controller/select-target.ts
sed -n '1,140p' frontend/test/runtime/canvas-pan-performance.integration.test.ts"`
Status: completed
Exit code: 0

````text
import { state } from '../../state.js';
import { cardsIntersectingZone } from '../../zone/helper/cards-intersecting-zone.js';
import { resolveGroupMembership } from '../../group/helper/resolve-group-membership.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { threadIdForTarget } from '../../thread/helper/thread-id-for-target.js';
import { renderSelectionState } from '../effect/render-selection-state.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';

export function selectTarget(kind: string, id: string, additive: boolean): void {
  if (!id) return;
  telemetry('resolve-selection-target', { kind, id, additive });
  if (!additive) selectThread(threadIdForTarget(kind, id));
  if (!additive) state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  const key = kind === 'card' ? 'cardIds' : kind === 'zone' ? 'zoneIds' : 'groupIds';
  if (additive && state.selection[key].includes(id)) {
    state.selection[key] = state.selection[key].filter((selectedId: string) => selectedId !== id);
  } else if (!state.selection[key].includes(id)) {
    state.selection[key].push(id);
  }
  if (kind === 'zone') {
    const intersectingCards = cardsIntersectingZone(id);
    for (const cardId of intersectingCards) {
      if (!state.selection.cardIds.includes(cardId)) state.selection.cardIds.push(cardId);
    }
    telemetry('resolve-zone-intersections', { zoneId: id, cardIds: intersectingCards });
  }
  if (kind === 'group') {
    const membership = resolveGroupMembership(id);
    state.selection.groupIds = membership.groupIds;
    state.selection.zoneIds = membership.zoneIds;
    state.selection.cardIds = membership.cardIds;
    telemetry('resolve-group-membership', { groupId: id, selection: state.selection });
  }
  renderSelectionState();
  if (state.threadPanelOpen || state.activeTool === 'thread') renderThreadPanel();
  else renderTelemetry();
}
/**
 * WHAT: Runtime tests for transform-only canvas pan performance.
 * WHY: Canvas pan should not pay scale/detail-mode or unsampled telemetry costs on every pointermove.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePointerIntent, ctrlPanOnlySpec } from '../../src/runtime/gesture/helper/derive-pointer-intent.js';
import { state } from '../../src/runtime/state.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

type CanvasFakeStyle = Record<string, string> & {
  setProperty(name: string, value: string): void;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
};

type CanvasFakeElement = {
  tagName: string;
  id: string;
  className: string;
  dataset: Record<string, string>;
  style: CanvasFakeStyle;
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  type: string;
  title: string;
  ariaLabel: string;
  value: string;
  disabled: boolean;
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientWidth: number;
  clientHeight: number;
  children: CanvasFakeElement[];
  parentElement: CanvasFakeElement | null;
  isConnected: boolean;
  childElementCount: number;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  querySelector(selector: string): CanvasFakeElement | null;
  querySelectorAll(selector: string): CanvasFakeElement[];
  matches(selector: string): boolean;
  closest(selector: string): CanvasFakeElement | null;
  append(...nodes: CanvasFakeElement[]): void;
  appendChild(node: CanvasFakeElement): CanvasFakeElement;
  insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null): void;
  replaceChildren(...nodes: CanvasFakeElement[]): void;
  remove(): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  addEventListener(): void;
  removeEventListener(): void;
  scrollTo(options?: unknown): void;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
};

const canvasStorage = new Map<string, string>();
const canvasDom = createCanvasRuntimeDom();

function canvasElement(dataset: Record<string, string> = {}, tagName = 'div'): CanvasFakeElement {
  const customProperties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const style = {
    left: '0px',
    top: '0px',
    width: '120px',
    height: '80px',
    minHeight: '',
    display: '',
    transition: '',
    transform: '',
    visibility: '',
    right: '',
    bottom: '',
    maxWidth: '',
    position: '',
    zIndex: '',
    boxSizing: '',
    setProperty(name: string, value: string) {
      customProperties.set(name, value);
      style[name] = value;
    },
    getPropertyValue(name: string) {
      return customProperties.get(name) ?? style[name] ?? '';
    },
    removeProperty(name: string) {
      customProperties.delete(name);
      delete style[name];
    }
  } as unknown as CanvasFakeStyle;
  const element: CanvasFakeElement = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    dataset,
    style,
    hidden: false,
    textContent: '',
    innerHTML: '',
    type: '',
    title: '',
    ariaLabel: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientWidth: 120,
    clientHeight: 80,
    children: [],
    parentElement: null,
    isConnected: true,
    get childElementCount() { return element.children.length; },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    classList: {
      toggle(name: string, force?: boolean) {
        const classes = canvasClassSet(element);
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
        return shouldAdd;
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-10","timestamp":"2026-07-10T09:56:32.696Z","status":"Codex message","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"10","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_4"} -->

The evidence supports one hard dependency: `T1` establishes the selection/thread behavior that `T2` must exercise. The tasks touch separate files, so I’m keeping them in distinct groups with a strict `G1 → G2` gate; they are not safe for parallel dispatch because the test contract directly consumes the runtime-state change.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-11","timestamp":"2026-07-10T09:56:52.465Z","status":"in_progress","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"11","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_5"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-12","timestamp":"2026-07-10T09:56:52.465Z","status":"completed","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"12","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_5"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-13","timestamp":"2026-07-10T09:56:55.794Z","status":"in_progress","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"13","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-14","timestamp":"2026-07-10T09:56:55.794Z","status":"completed","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"14","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md"`
Status: completed
Exit code: 0

````text
## A. Dependency Graph

1. **Required dependency edge.** `T1` must establish the canonical created-card selection and thread preparation behavior before `T2` codifies that behavior in the runtime regression coverage.

| from_task | to_task | edge_type | reason | evidence |
|---|---|---|---|---|
| `T1` | `T2` | `hard-blocker` | The regression task consumes the behavior introduced by the implementation task: both creation branches must select the generated card through `selectTarget('card', cardId, false)`, prepare `state.threadId`, and leave `state.threadPanelOpen` closed. | `T2.depends_on` explicitly names `T1`. `frontend/src/runtime/card/effect/create-card-from-rect.ts` currently writes `state.selection` directly in both branches, while `frontend/src/runtime/selection/controller/select-target.ts` calls `selectThread(threadIdForTarget(kind, id))` before rebuilding selection. `frontend/test/runtime/canvas-pan-performance.integration.test.ts` currently covers only the source-level negative-coordinate contract for card creation. |

---

## B. Independent Task Groups

1. **Group construction.** Each task has exclusive file ownership, but `G2` remains sequentially gated by `G1` because its assertions consume the completed controller-routing behavior.

| group_id | task_ids | target_files | target_symbols | independence_reason | dispatch_notes |
|---|---|---|---|---|---|
| `G1` | `T1` | `frontend/src/runtime/card/effect/create-card-from-rect.ts` | `createCardFromRect()`; active-ledger creation branch; standalone DOM creation branch; `selectTarget()` | The production change is confined to the created-card effect and uses the existing canonical selection controller; it does not require edits to the integration-test harness. | Dispatch first. Preserve insertion and DOM availability before selection, persistence, telemetry, rendering, geometry, and the closed thread-panel state. |
| `G2` | `T2` | `frontend/test/runtime/canvas-pan-performance.integration.test.ts` | Existing negative-coordinate card-creation test; new active-ledger and standalone DOM regression coverage; `state.selection`; `state.threadId`; `state.threadPanelOpen` | The test work is confined to the existing runtime integration harness and does not require further product-code ownership after `G1` completes. | Dispatch only after the `G1` gate. Exercise both branches, derive each generated `cardId`, retain `rect.x` and `rect.y` assertions, and assert the exact selection/thread/panel state before the `A` and `X` shortcuts. |

---

## C. Sequential Gates

1. **`G1` → `G2`.** Start `G2` only after both creation branches in `createCardFromRect()` select the new card through `selectTarget('card', cardId, false)` after the card is available in active-ledger state and the DOM, no direct created-card `state.selection` assignment remains, `state.threadId` is prepared as `thread-${cardId}`, and creation leaves `state.threadPanelOpen` closed.

---

## D. Collision Risks

1. **Shared runtime state.** `G1` changes how `state.selection` and `state.threadId` are produced, while `G2` asserts `state.selection`, `state.threadId`, and `state.threadPanelOpen`. Parallel dispatch would make the regression contract depend on an unfinished implementation.
2. **Branch timing.** The active-ledger branch must insert the card before controller selection, and the standalone branch must insert the card element before controller selection. Moving selection earlier would make `renderSelectionState()` operate before its target is available.
3. **Render side effects.** `selectTarget()` invokes selection rendering and conditionally renders the thread panel only when `state.threadPanelOpen` is true or `state.activeTool` is `thread`. The implementation and regression must preserve the closed-panel creation contract while preparing the thread.
4. **Test harness ownership.** Only `G2` owns `frontend/test/runtime/canvas-pan-performance.integration.test.ts`; no second group may modify its card-creation setup or state cleanup during this batch.
5. **No file, fixture, migration, or data-model collision.** `G1` and `G2` have separate target files, and the inventory introduces no fixture, migration, schema, or persisted data-model work.

---

## E. Ambiguities

1. **None.** The explicit task dependency, controller behavior, creation branches, runtime state, and test surface support reliable grouping without an operator decision.

---

## F. Readiness

1. `READY_FOR_TASK_GROUP_COMPLETENESS`
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-15","timestamp":"2026-07-10T09:56:59.394Z","status":"Codex message","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"15","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_7"} -->

Created the task dependency analysis at [card-codex-skill-1783677359105-116e92d2.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/bugs/card-codex-skill-1783677359105-116e92d2.md).

Readiness: `READY_FOR_TASK_GROUP_COMPLETENESS`

No product code, tests, ledger JSON, or unrelated files were changed. Tests were not run, per the skill contract.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783677359105-116e92d2-line-16","timestamp":"2026-07-10T09:56:59.486Z","status":"complete","codexRunId":"codex-skill-1783677359105-116e92d2","codexLine":"16","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.
