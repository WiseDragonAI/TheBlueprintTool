/**
 * WHAT: Behavioral coverage for same-thread action control continuity.
 * WHY: Note refreshes must not remount focused model/effort controls or lose committed preferences.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type Listener = (event: Event) => void;

type FakeElement = {
  tagName: string;
  className: string;
  dataset: Record<string, string>;
  style: { setProperty(name: string, value: string): void; getPropertyValue(name: string): string };
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  value: string;
  type: string;
  title: string;
  disabled: boolean;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  parentElement: FakeElement | null;
  children: FakeElement[];
  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  append(...nodes: FakeElement[]): void;
  replaceChildren(...nodes: FakeElement[]): void;
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  dispatchEvent(event: Event): boolean;
  focus(): void;
  blur(): void;
};

const listeners = new WeakMap<FakeElement, Map<string, Listener[]>>();
let activeElement: FakeElement | null = null;

function classes(element: FakeElement): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

function descendants(element: FakeElement): FakeElement[] {
  return element.children.flatMap((child) => [child, ...descendants(child)]);
}

function matches(element: FakeElement, selector: string): boolean {
  const normalized = selector.trim();
  if (!normalized) return false;
  const classNames = [...normalized.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  if (classNames.some((className) => !classes(element).has(className))) return false;
  const attributes = [...normalized.matchAll(/\[data-([^=\]]+)(?:="([^"]*)")?\]/g)];
  for (const [, rawName, expected] of attributes) {
    const key = rawName.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    const actual = element.dataset[key];
    if (expected === undefined ? actual === undefined : actual !== expected) return false;
  }
  const tag = normalized.replace(/\.[a-zA-Z0-9_-]+/g, '').replace(/\[[^\]]+\]/g, '').trim();
  return !tag || tag === '*' || element.tagName.toLowerCase() === tag.toLowerCase();
}

function queryAll(root: FakeElement, selector: string): FakeElement[] {
  const selectors = selector.split(',').map((entry) => entry.trim()).filter(Boolean);
  return descendants(root).filter((element) => selectors.some((entry) => matches(element, entry.split(/\s+/).at(-1) ?? entry)));
}

function fakeElement(tagName = 'div', className = ''): FakeElement {
  const properties = new Map<string, string>();
  const element: FakeElement = {
    tagName: tagName.toUpperCase(),
    className,
    dataset: {},
    style: {
      setProperty(name: string, value: string) { properties.set(name, value); },
      getPropertyValue(name: string) { return properties.get(name) ?? ''; }
    },
    hidden: false,
    textContent: '',
    innerHTML: '',
    value: '',
    type: '',
    title: '',
    disabled: false,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    parentElement: null,
    children: [],
    classList: {
      toggle(name: string, force?: boolean) {
        const next = classes(element);
        const add = force ?? !next.has(name);
        if (add) next.add(name);
        else next.delete(name);
        element.className = [...next].join(' ');
        return add;
      },
      add(...names: string[]) {
        const next = classes(element);
        for (const name of names) next.add(name);
        element.className = [...next].join(' ');
      },
      remove(...names: string[]) {
        const next = classes(element);
        for (const name of names) next.delete(name);
        element.className = [...next].join(' ');
      },
      contains(name: string) { return classes(element).has(name); }
    },
    append(...nodes: FakeElement[]) {
      for (const node of nodes) {
        if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
        node.parentElement = element;
        element.children.push(node);
      }
    },
    replaceChildren(...nodes: FakeElement[]) {
      for (const child of element.children) child.parentElement = null;
      element.children = [];
      element.append(...nodes);
    },
    querySelector(selector: string) { return queryAll(element, selector)[0] ?? null; },
    querySelectorAll(selector: string) { return queryAll(element, selector); },
    setAttribute(name: string, value: string) {
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
        element.dataset[key] = value;
      }
    },
    addEventListener(type: string, listener: Listener) {
      const byType = listeners.get(element) ?? new Map<string, Listener[]>();
      byType.set(type, [...(byType.get(type) ?? []), listener]);
      listeners.set(element, byType);
    },
    removeEventListener(type: string, listener: Listener) {
      const byType = listeners.get(element);
      if (byType) byType.set(type, (byType.get(type) ?? []).filter((entry) => entry !== listener));
    },
    dispatchEvent(event: Event) {
      for (const listener of listeners.get(element)?.get(event.type) ?? []) listener.call(element, event);
      return true;
    },
    focus() { activeElement = element; },
    blur() { if (activeElement === element) activeElement = null; }
  };
  return element;
}

function installDom(): { root: FakeElement; heading: FakeElement; codexLog: FakeElement } {
  const root = fakeElement('document');
  const panel = fakeElement('aside', 'thread-panel');
  const inspector = fakeElement('aside', 'panel');
  const shell = fakeElement('main', 'shell');
  const target = fakeElement('div', 'thread-target');
  const heading = fakeElement('div', 'thread-heading');
  const logPanel = fakeElement('section', 'thread-log-panel');
  const logScroll = fakeElement('div', 'thread-log-scroll');
  const codexLog = fakeElement('div', 'thread-codex-log');
  const telemetry = fakeElement('ol', 'telemetry-list');
  logScroll.append(codexLog);
  logPanel.append(logScroll);
  root.append(panel, inspector, shell, target, heading, logPanel, telemetry);
  activeElement = null;

  (globalThis as unknown as { document: unknown }).document = {
    get activeElement() { return activeElement; },
    querySelector(selector: string) { return queryAll(root, selector)[0] ?? null; },
    querySelectorAll(selector: string) { return queryAll(root, selector); },
    createElement(tagName: string) { return fakeElement(tagName); },
    createElementNS(_namespace: string, tagName: string) { return fakeElement(tagName); }
  };
  (globalThis as unknown as { window: unknown }).window = {
    __coreTelemetry: [],
    location: { pathname: '/specs' },
    dispatchEvent() {}
  };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) { this.detail = init.detail; }
  };
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (element: FakeElement) => ({
    borderTopColor: '',
    getPropertyValue(name: string) { return element.style.getPropertyValue(name); }
  });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 0;
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem() { return null; },
    setItem() {}
  };
  return { root, heading, codexLog };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for condition.');
}

test('thread selection persists the complete default pair and synchronizes a mounted widget', async () => {
  const previousFetch = globalThis.fetch;
  const { root, heading } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const { persistCardCodexRunPreference } = await import('../../../../src/runtime/codex/effect/persist-card-codex-run-preference.js');
  const requests: Array<Record<string, unknown>> = [];
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A' }],
    annotations: [],
    relationships: [],
    notes: { 'thread-card-a': [{ id: 'note-1', role: 'operator', message: 'First' }] }
  };
  state.threadId = 'thread-card-a';
  state.renderedThreadId = '';
  state.threadPanelOpen = true;
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.canvasMode = 'ledger';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgerReconciliation = {
    routeEpoch: 1,
    routeLedgerStateId: 'specs',
    nextRequestSequence: 1,
    lastAppliedServerRevision: -1,
    lastAppliedSequence: 0,
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null
  };
  state.threadPinOnRender = false;
  state.threadScrollTopByThreadId = {};
  state.telemetry = [];
  state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const mutation = JSON.parse(String(init?.body ?? '{}')) as { cardPatch: Record<string, unknown> };
    requests.push(mutation);
    return new Response(JSON.stringify({
      ...state.activeLedger,
      cards: state.activeLedger.cards.map((card: Record<string, unknown>) => card.id === mutation.cardPatch.id
        ? { ...card, codexRunModel: mutation.cardPatch.codexRunModel, codexRunEffort: mutation.cardPatch.codexRunEffort }
        : card)
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-decision-os-ledger-revision': '1' }
    });
  }) as typeof fetch;

  const widget = fakeElement('section', 'codex-run-widget');
  widget.dataset.codexCardId = 'card-a';
  const widgetModel = fakeElement('select');
  widgetModel.dataset.codexRunModel = '';
  widgetModel.value = 'gpt-5.6-sol';
  const widgetEffort = fakeElement('select');
  widgetEffort.dataset.codexRunEffort = '';
  widgetEffort.value = 'high';
  widget.append(widgetModel, widgetEffort);
  root.append(widget);

  try {
    renderThreadPanel();
    const actions = heading.querySelector('.thread-actions') as FakeElement;
    const model = actions.querySelector('[data-codex-preference="model"]') as FakeElement;
    const effort = actions.querySelector('[data-codex-preference="effort"]') as FakeElement;
    const button = actions.querySelector('.thread-codex-button') as FakeElement;
    assert.ok(actions);
    assert.equal(model.value, 'gpt-5.6-sol');
    assert.equal(effort.value, 'medium');
    assert.equal(button.dataset.codexCardId, 'card-a');
    assert.equal(button.dataset.codexModel, 'gpt-5.6-sol');
    assert.equal(button.dataset.codexEffort, 'medium');
    assert.equal(button.classList.contains('thread-action-button'), true);
    assert.equal(button.title, 'Run Codex from this thread');
    assert.equal(button.querySelector('.thread-codex-run-icon')?.tagName, 'SVG');
    assert.equal(button.querySelector('.terminal-button__label')?.textContent, 'RUN');

    model.focus();
    model.value = 'gpt-5.4';
    model.dispatchEvent(new Event('change'));
    assert.equal(button.dataset.codexModel, 'gpt-5.6-sol');
    await waitFor(() => requests.length === 1 && state.activeLedger.cards[0].codexRunModel === 'gpt-5.4');

    assert.deepEqual(requests[0], {
      action: 'patch-card',
      cardPatch: { id: 'card-a', codexRunModel: 'gpt-5.4', codexRunEffort: 'medium' }
    });
    assert.equal(button.dataset.codexModel, 'gpt-5.4');
    assert.equal(widgetModel.value, 'gpt-5.4');
    assert.equal(widgetEffort.value, 'medium');

    widgetEffort.value = 'ultra';
    await persistCardCodexRunPreference({ cardId: 'card-a', model: widgetModel.value, effort: widgetEffort.value });
    assert.deepEqual(requests[1], {
      action: 'patch-card',
      cardPatch: { id: 'card-a', codexRunModel: 'gpt-5.4', codexRunEffort: 'ultra' }
    });
    assert.equal(effort.value, 'ultra');
    assert.equal(button.dataset.codexEffort, 'ultra');
    assert.equal(state.activeLedger.cards[0].codexRunEffort, 'ultra');

    state.activeLedger.notes['thread-card-a'].push({ id: 'note-2', role: 'agent', message: 'Lifecycle update' });
    renderThreadPanel();
    assert.equal(heading.querySelector('.thread-actions'), actions);
    assert.equal(actions.querySelector('[data-codex-preference="model"]'), model);
    assert.equal(model.value, 'gpt-5.4');
    assert.equal((globalThis.document as unknown as { activeElement: FakeElement }).activeElement, model);

    state.threadPanelOpen = false;
    renderThreadPanel();
    assert.equal(root.querySelector('.panel')?.hidden, true);
    assert.equal(root.querySelector('.thread-panel')?.hidden, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('rejected Codex preference mutation restores both surfaces to the durable pair', async () => {
  const previousFetch = globalThis.fetch;
  const { root, heading } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', codexRunModel: 'gpt-5.4', codexRunEffort: 'medium' }],
    annotations: [],
    relationships: [],
    notes: { 'thread-card-a': [] }
  };
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.canvasMode = 'ledger';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgerReconciliation = {
    routeEpoch: 1,
    routeLedgerStateId: 'specs',
    nextRequestSequence: 1,
    lastAppliedServerRevision: -1,
    lastAppliedSequence: 0,
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null
  };
  state.threadId = 'thread-card-a';
  state.renderedThreadId = '';
  state.threadPanelOpen = true;
  state.activeTool = 'select';
  state.threadPinOnRender = false;
  state.threadScrollTopByThreadId = {};
  state.telemetry = [];
  state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

  const widget = fakeElement('section', 'codex-run-widget');
  widget.dataset.codexCardId = 'card-a';
  const widgetModel = fakeElement('select');
  widgetModel.dataset.codexRunModel = '';
  widgetModel.value = 'gpt-5.4';
  const widgetEffort = fakeElement('select');
  widgetEffort.dataset.codexRunEffort = '';
  widgetEffort.value = 'medium';
  widget.append(widgetModel, widgetEffort);
  root.append(widget);
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false }), { status: 500 })) as typeof fetch;

  try {
    renderThreadPanel();
    const actions = heading.querySelector('.thread-actions') as FakeElement;
    const effort = actions.querySelector('[data-codex-preference="effort"]') as FakeElement;
    const button = actions.querySelector('.thread-codex-button') as FakeElement;
    effort.value = 'ultra';
    effort.dispatchEvent(new Event('change'));
    await waitFor(() => state.ledgerReconciliation.failedLoadCount === 1);

    assert.equal(effort.value, 'medium');
    assert.equal(widgetEffort.value, 'medium');
    assert.equal(button.dataset.codexModel, 'gpt-5.4');
    assert.equal(button.dataset.codexEffort, 'medium');
    assert.equal(state.activeLedger.cards[0].codexRunEffort, 'medium');
    assert.equal(state.ledgerReconciliation.lastFailedLoad.reason, 'http-500');
    assert.ok(state.telemetry.some((entry: Record<string, unknown>) => entry.name === 'commit-ledger-edit-failed'));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('generated skill-result threads bind and render their durable card run id', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const { codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const runId = 'codex-skill-1783682000000-generated';
  const cardId = `card-${runId}`;
  const threadId = `thread-${cardId}`;
  const requests: string[] = [];
  let scheduledPoll: (() => void) | null = null;

  try {
    globalThis.setTimeout = ((callback: () => void) => {
      scheduledPoll = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      return new Response(JSON.stringify({
        ok: true,
        runId,
        runKind: 'card',
        status: 'complete',
        pipelineRunId: 'codex-pipeline-1783682000000-generated',
        pipelineName: 'Research pipeline',
        pipelineStepName: 'Synthesis',
        skillName: 'research-synthesis',
        pipelineStatus: 'complete',
        lineCount: 1,
        nextSince: 1,
        events: [],
        diagnostics: [],
        metadata: {},
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    state.activeTab = 'ux';
    state.activeLedger = {
      cards: [{ id: cardId, title: 'Generated skill result', cardType: 'codex-skill-run' }],
      annotations: [],
      relationships: [],
      notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadPinOnRender = false;
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();

    assert.equal(state.threadRunIdByThreadId[threadId], runId);
    assert.ok(codexLog.querySelector('.codex-log-status'));
    assert.equal(codexLog.querySelector('.codex-log-empty'), null);
    assert.ok(scheduledPoll);
    (scheduledPoll as () => void)();
    assert.deepEqual(requests, [
      `/api/codex/skills/runs/${runId}?ledgerId=ux&cardId=${cardId}&since=0`,
    ]);
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
    renderThreadPanel();
    const statusValues = codexLog.querySelectorAll('dd').map((element) => element.textContent);
    assert.ok(statusValues.includes('Research pipeline · complete'));
    assert.ok(statusValues.includes('research-synthesis · complete'));
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});

test('Codex Log run arrows default to the newest retained run and select the previous run', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const { codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const oldRunId = 'codex-skill-1783681000000-oldrun';
  const newRunId = 'codex-skill-1783682000000-newrun';
  const threadId = 'thread-card-history';
  try {
    globalThis.setTimeout = (() => 1 as unknown as ReturnType<typeof setTimeout>) as unknown as typeof setTimeout;
    globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'not requested in this rendering assertion' }), { status: 404 })) as typeof fetch;
    state.activeTab = 'specs';
    state.activeLedger = {
      cards: [{ id: 'card-history', title: 'Run history', codexThreadRunId: newRunId, codexThreadRunIds: [oldRunId, newRunId] }],
      annotations: [], relationships: [], notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadPinOnRender = false;
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadSelectedRunIdByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();

    assert.equal(state.threadSelectedRunIdByThreadId[threadId], newRunId);
    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Run 2 of 2');
    assert.equal(codexLog.querySelector('.codex-log-run-arrow--previous')?.disabled, false);
    assert.equal(codexLog.querySelector('.codex-log-run-arrow--next')?.disabled, true);

    codexLog.querySelector('.codex-log-run-arrow--previous')?.dispatchEvent(new Event('click'));
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
    await new Promise<void>((resolve) => previousSetTimeout(resolve, 0));
    assert.equal(state.threadSelectedRunIdByThreadId[threadId], oldRunId);
    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Run 1 of 2');
    assert.equal(state.threadRunIdByThreadId[threadId], oldRunId);
    assert.equal(codexLog.querySelector('.codex-log-run-arrow--previous')?.disabled, true);
    assert.equal(codexLog.querySelector('.codex-log-run-arrow--next')?.disabled, false);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadSelectedRunIdByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});

test('Codex Log counts continuations as separate runs with execution-scoped metrics and events', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const { codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadCodexLog } = await import('../../../../src/runtime/thread/effect/render-thread-codex-log.js');
  const runId = 'codex-skill-1784439000000-continuations';
  const threadId = 'thread-card-continuations';
  const execution = (executionId: string, startLine: number, endLine: number | null, elapsedMs: number, toolCallCount: number, active = false) => ({
    executionId, runId, segment: startLine === 0 ? 'start' as const : 'continue' as const,
    startedAt: `2026-07-19T05:0${startLine}:00.000Z`, turnStartedAt: '', startLine, turnStartLine: startLine + 1, endLine,
    status: active ? 'running' as const : 'complete' as const, active, finishedAt: active ? '' : `2026-07-19T05:0${startLine}:30.000Z`,
    elapsedMs, toolCallCount, agentMessageCount: 0, fileChangeCount: 0, thinkingCount: 0, warningCount: 0, errorCount: 0, transportStatus: 'ok' as const,
  });
  const summary = {
    ok: true, active: true, runId, runKind: 'thread' as const, pipelineRunId: '', pipelineName: '', pipelineStepName: '', skillName: '', pipelineStatus: '' as const,
    status: 'running' as const, executionId: 'execution-c', queuePosition: null,
    executions: [execution('execution-a', 0, 2, 12000, 1), execution('execution-b', 2, 4, 24000, 2), execution('execution-c', 4, null, 36000, 3, true)],
    currentExecution: null, startedAt: '2026-07-19T05:04:00.000Z', elapsedMs: 36000, lineCount: 6, nextSince: 6,
    toolCallCount: 3, agentMessageCount: 0, fileChangeCount: 0, thinkingCount: 0, warningCount: 0, errorCount: 0, transportStatus: 'ok' as const,
    persistedEventCount: 0, metadata: { sourceCardTitle: '', sourceThreadId: threadId, codexModel: 'gpt-5.6-sol', codexEffort: 'medium' },
    latestEvent: null, events: [], diagnostics: [], error: '',
  };
  try {
    globalThis.fetch = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    globalThis.setTimeout = (() => 1 as unknown as ReturnType<typeof setTimeout>) as unknown as typeof setTimeout;
    globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
    state.activeTab = 'specs';
    state.activeLedger = { cards: [{ id: 'card-continuations', title: 'Continuations', codexThreadRunId: runId, codexThreadRunIds: [runId] }], annotations: [], relationships: [], notes: { [threadId]: [] } };
    state.threadId = threadId;
    state.threadPanelOpen = true;
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadSelectedRunIdByThreadId = { [threadId]: runId };
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadRunIdByThreadId = { [threadId]: runId };
    state.threadRunExecutionsByRunId = {};
    state.threadRunSummaryByThreadId = { [threadId]: summary };
    state.threadRunEventsByThreadId = { [threadId]: [
      { runId, line: 2, source: 'jsonl', sourceLine: 2, type: 'item.completed', kind: 'tool_call', title: 'first', text: '', status: 'completed', itemId: 'a', tool: 'first', output: '', exitCode: '0', severity: 'info', persist: false, eventKey: 'a', toolKey: 'a' },
      { runId, line: 4, source: 'jsonl', sourceLine: 4, type: 'item.completed', kind: 'tool_call', title: 'second', text: '', status: 'completed', itemId: 'b', tool: 'second', output: '', exitCode: '0', severity: 'info', persist: false, eventKey: 'b', toolKey: 'b' },
      { runId, line: 6, source: 'jsonl', sourceLine: 6, type: 'item.completed', kind: 'tool_call', title: 'third', text: '', status: 'completed', itemId: 'c', tool: 'third', output: '', exitCode: '0', severity: 'info', persist: false, eventKey: 'c', toolKey: 'c' },
    ] };
    state.threadCoalescedToolsByThreadId = { [threadId]: {} };

    renderThreadCodexLog();

    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Run 3 of 3');
    assert.equal(codexLog.querySelector('.codex-tool-call-command')?.textContent, 'third');
    assert.ok(codexLog.querySelectorAll('dd').map((element) => element.textContent).includes('3'));

    codexLog.querySelector('.codex-log-run-arrow--previous')?.dispatchEvent(new Event('click'));
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
    await new Promise<void>((resolve) => previousSetTimeout(resolve, 0));
    assert.equal(state.threadSelectedExecutionIdByThreadId[threadId], 'execution-b');
    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Run 2 of 3');
    assert.equal(codexLog.querySelector('.codex-tool-call-command')?.textContent, 'second');
    assert.ok(codexLog.querySelectorAll('dd').map((element) => element.textContent).includes('2'));
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    state.threadId = '';
    state.activeLedger = null;
    state.threadSelectedRunIdByThreadId = {};
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunExecutionsByRunId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});

test('queued thread runs become read-only and render their queue position without elapsed time', async () => {
  const previousFetch = globalThis.fetch;
  const { heading, codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const { syncThreadCodexRunControls } = await import('../../../../src/runtime/thread/effect/sync-thread-codex-run-controls.js');
  const runId = 'codex-skill-queued';
  const threadId = 'thread-card-a';
  const summary = {
    ok: true, active: false, runId, runKind: 'thread', pipelineRunId: '', pipelineName: '', pipelineStepName: '', skillName: '', pipelineStatus: '',
    status: 'pending', queuePosition: 3, startedAt: '', elapsedMs: 0, lineCount: 0, nextSince: 0, toolCallCount: 0, agentMessageCount: 0,
    fileChangeCount: 0, thinkingCount: 0, warningCount: 0, errorCount: 0, transportStatus: 'ok', persistedEventCount: 0,
    metadata: { sourceCardTitle: '', sourceThreadId: threadId, codexModel: 'gpt-5.6-sol', codexEffort: 'medium' },
    latestEvent: null, events: [], diagnostics: [], error: '',
  };
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify(summary), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    state.activeTab = 'specs';
    state.activeLedger = { cards: [{ id: 'card-a', title: 'Card A', codexThreadRunId: runId }], annotations: [], relationships: [], notes: { [threadId]: [] } };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadPinOnRender = false;
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadRunIdByThreadId = { [threadId]: runId };
    state.threadRunSummaryByThreadId = { [threadId]: summary };
    state.threadRunEventsByThreadId = { [threadId]: [] };
    state.threadCoalescedToolsByThreadId = { [threadId]: {} };
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();

    assert.equal(heading.querySelector('.thread-actions')?.hidden, true);
    assert.equal(heading.dataset.codexRunning, 'true');
    assert.equal(heading.dataset.codexStatus, 'pending');
    assert.equal(codexLog.querySelector('.terminal-button__label'), null);
    assert.equal(codexLog.querySelector('.codex-log-session-footer'), null);
    assert.ok(codexLog.querySelectorAll('dd').map((element) => element.textContent).includes('Queued · position 3'));
    assert.equal(codexLog.querySelector('[data-codex-log-elapsed]'), null);
    assert.equal(codexLog.querySelector('.codex-log-waiting.is-queued')?.querySelector('span')?.textContent, '');
    assert.equal(codexLog.querySelector('.codex-log-waiting.is-queued')?.querySelectorAll('i').length, 3);
    assert.equal(codexLog.querySelector('.codex-log-waiting.is-queued')?.children[1]?.textContent, 'Queued · position 3. Waiting for Codex capacity.');

    syncThreadCodexRunControls({ threadId, status: 'running', active: false });
    assert.equal(heading.querySelector('.thread-actions')?.hidden, false);
    assert.equal(heading.dataset.codexRunning, 'false');

    syncThreadCodexRunControls({ threadId, status: 'running', active: true });
    assert.equal(heading.querySelector('.thread-actions')?.hidden, true);
    assert.equal(heading.dataset.codexRunning, 'true');
  } finally {
    globalThis.fetch = previousFetch;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});

test('persisted card execution fields cannot override a terminal run summary', async () => {
  const previousFetch = globalThis.fetch;
  const { heading } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const runId = 'codex-skill-reopened-pending';
  const threadId = 'thread-card-reopened';
  try {
    globalThis.fetch = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    state.activeTab = 'specs';
    state.activeLedger = {
      cards: [{
        id: 'card-reopened',
        title: 'Reopened queued card',
        codexThreadRunId: runId,
        codexActiveRunId: runId,
        codexActiveExecutionId: 'execution-new',
        executionStatus: 'pending',
      }],
      annotations: [], relationships: [], notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadPinOnRender = false;
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'thread' };
    state.threadRunIdByThreadId = { [threadId]: runId };
    state.threadRunSummaryByThreadId = { [threadId]: {
      ok: true,
      status: 'complete',
      active: false,
      executionId: 'execution-old',
      queuePosition: null,
      runId,
      runKind: 'thread',
      pipelineRunId: '',
      pipelineName: '',
      pipelineStepName: '',
      skillName: '',
      pipelineStatus: '',
      currentExecution: null,
      executions: [],
      startedAt: '',
      elapsedMs: 0,
      lineCount: 0,
      nextSince: 0,
      toolCallCount: 0,
      agentMessageCount: 0,
      fileChangeCount: 0,
      thinkingCount: 0,
      warningCount: 0,
      errorCount: 0,
      transportStatus: 'ok',
      persistedEventCount: 0,
      metadata: { sourceCardTitle: '', sourceThreadId: threadId, codexModel: 'gpt-5.6-sol', codexEffort: 'medium' },
      latestEvent: null,
      events: [],
      diagnostics: [],
    } };
    state.threadRunEventsByThreadId = { [threadId]: [] };
    state.threadCoalescedToolsByThreadId = { [threadId]: {} };
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();

    assert.equal(heading.querySelector('.thread-actions')?.hidden, false);
    assert.equal(heading.dataset.codexStatus, '');
    assert.equal(heading.dataset.codexRunning, 'false');
  } finally {
    globalThis.fetch = previousFetch;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});
