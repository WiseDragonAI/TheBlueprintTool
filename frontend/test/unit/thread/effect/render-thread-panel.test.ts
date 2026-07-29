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
  prepend(...nodes: FakeElement[]): void;
  appendChild(node: FakeElement): FakeElement;
  replaceChildren(...nodes: FakeElement[]): void;
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  closest(selector: string): FakeElement | null;
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
    prepend(...nodes: FakeElement[]) {
      for (const node of [...nodes].reverse()) {
        if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
        node.parentElement = element;
        element.children.unshift(node);
      }
    },
    appendChild(node: FakeElement) {
      element.append(node);
      return node;
    },
    replaceChildren(...nodes: FakeElement[]) {
      for (const child of element.children) child.parentElement = null;
      element.children = [];
      element.append(...nodes);
    },
    querySelector(selector: string) { return queryAll(element, selector)[0] ?? null; },
    querySelectorAll(selector: string) { return queryAll(element, selector); },
    closest(selector: string) {
      let current: FakeElement | null = element;
      while (current) {
        if (matches(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
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
  const fullscreen = fakeElement('button', 'thread-fullscreen');
  fullscreen.dataset.action = 'toggle-thread-fullscreen';
  heading.append(fullscreen);
  const logPanel = fakeElement('section', 'thread-log-panel');
  const logScroll = fakeElement('div', 'thread-log-scroll');
  const codexLog = fakeElement('div', 'thread-codex-log');
  const telemetry = fakeElement('ol', 'telemetry-list');
  logScroll.append(codexLog);
  logPanel.append(logScroll);
  root.append(panel, inspector, shell, target, heading, logPanel, telemetry);
  inspector.append(heading);
  activeElement = null;

  (globalThis as unknown as { document: unknown }).document = {
    get activeElement() { return activeElement; },
    querySelector(selector: string) { return queryAll(root, selector)[0] ?? null; },
    querySelectorAll(selector: string) { return queryAll(root, selector); },
    createElement(tagName: string) { return fakeElement(tagName); },
    createElementNS(_namespace: string, tagName: string) { return fakeElement(tagName); },
    createTextNode(text: string) {
      const node = fakeElement('#text');
      node.textContent = text;
      return node;
    }
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

function executionState(input: {
  executionId: string;
  sessionId: string;
  phase?: string;
  kind?: string;
  sourceCardId?: string;
  queuePosition?: number | null;
  requestedAt?: string;
}) {
  return {
    executionId: input.executionId,
    sessionId: input.sessionId,
    sourceCardId: input.sourceCardId ?? '',
    kind: input.kind ?? 'thread',
    phase: input.phase ?? 'succeeded',
    requestedAt: input.requestedAt ?? '2026-07-25T01:00:00.000Z',
    startedAt: input.phase === 'queued' ? null : input.requestedAt ?? '2026-07-25T01:00:00.000Z',
    finishedAt: ['queued', 'running'].includes(input.phase ?? '') ? null : '2026-07-25T01:00:30.000Z',
    model: 'gpt-5.6-sol',
    effort: 'medium',
    executorNodeId: 'workstation',
    revision: 1,
    queuePosition: input.queuePosition ?? null,
    error: null,
    artifacts: { jsonl: true, stderr: true, telemetry: false, result: false },
  };
}

function taskExecutionSummary(
  taskId: string,
  sessions: Array<{ sessionId: string; executions: ReturnType<typeof executionState>[] }>,
  activeExecutionIds: string[] = [],
) {
  const executions = sessions.flatMap((session) => session.executions);
  return {
    taskId,
    activeExecutionIds,
    defaultExecutionId: activeExecutionIds.at(-1) ?? executions.at(-1)?.executionId ?? null,
    sessions: sessions.map((session) => ({
      ...session,
      requestedAt: session.executions[0]?.requestedAt ?? '',
      executions: session.executions.map((execution) => ({
        ...execution,
        sourceCardId: execution.sourceCardId || taskId,
      })),
    })),
  };
}

function executionPresentation(
  execution: ReturnType<typeof executionState>,
  events: Array<Record<string, unknown>> = [],
) {
  return {
    execution: {
      executionId: execution.executionId,
      sessionId: execution.sessionId,
      taskId: 'task',
      kind: execution.kind,
      phase: execution.phase,
      requestedAt: execution.requestedAt,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      model: execution.model,
      effort: execution.effort,
      executorNodeId: execution.executorNodeId,
      revision: execution.revision,
      error: null,
      counts: {
        tools: events.filter((event) => event.kind === 'tool_call').length,
        messages: events.filter((event) => event.kind === 'agent_message').length,
        comments: events.filter((event) => event.kind === 'comment').length,
        thinking: events.filter((event) => event.kind === 'thinking').length,
        files: events.filter((event) => event.kind === 'file_change').length,
        warnings: events.filter((event) => event.kind === 'warning').length,
        errors: events.filter((event) => event.kind === 'error').length,
      },
    },
    events,
  };
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
  state.threadScrollTopByThreadId = {};
  state.telemetry = [];
  state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('/execution-state')) {
      return new Response(JSON.stringify(taskExecutionSummary('card-a', [])), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
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
    assert.equal(button.dataset.codexModel, 'gpt-5.4');
    await waitFor(() => requests.length === 1 && state.activeLedger.cards[0].codexRunModel === 'gpt-5.4');

    const { mutationId: modelMutationId, ...modelRequest } = requests[0] as Record<string, unknown>;
    assert.match(String(modelMutationId), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.deepEqual(modelRequest, {
      action: 'patch-card',
      cardPatch: { id: 'card-a', codexRunModel: 'gpt-5.4', codexRunEffort: 'medium' }
    });
    assert.equal(button.dataset.codexModel, 'gpt-5.4');
    assert.equal(widgetModel.value, 'gpt-5.4');
    assert.equal(widgetEffort.value, 'medium');

    widgetEffort.value = 'ultra';
    await persistCardCodexRunPreference({ cardId: 'card-a', model: widgetModel.value, effort: widgetEffort.value });
    const { mutationId: effortMutationId, ...effortRequest } = requests[1] as Record<string, unknown>;
    assert.match(String(effortMutationId), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(effortMutationId, modelMutationId);
    assert.deepEqual(effortRequest, {
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

test('thread fullscreen toggles the inspector width without replacing the active log', async () => {
  const { root, codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { toggleThreadPanelFullscreen } = await import('../../../../src/runtime/thread/effect/apply-thread-panel-fullscreen.js');
  const panel = root.querySelector('.panel') as FakeElement;
  const button = root.querySelector('[data-action="toggle-thread-fullscreen"]') as FakeElement;
  try {
    state.threadPanelFullscreen = false;

    toggleThreadPanelFullscreen();

    assert.equal(panel.classList.contains('is-thread-fullscreen'), true);
    assert.equal(button.title, 'Restore thread panel');
    assert.equal(root.querySelector('.thread-codex-log'), codexLog);

    toggleThreadPanelFullscreen();

    assert.equal(panel.classList.contains('is-thread-fullscreen'), false);
    assert.equal(button.title, 'Expand thread panel');
    assert.equal(root.querySelector('.thread-codex-log'), codexLog);
  } finally {
    state.threadPanelFullscreen = false;
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
  let rejectMutation!: (response: Response) => void;
  globalThis.fetch = (async () => new Promise<Response>((resolve) => { rejectMutation = resolve; })) as typeof fetch;

  try {
    renderThreadPanel();
    const actions = heading.querySelector('.thread-actions') as FakeElement;
    const effort = actions.querySelector('[data-codex-preference="effort"]') as FakeElement;
    const button = actions.querySelector('.thread-codex-button') as FakeElement;
    effort.value = 'ultra';
    effort.dispatchEvent(new Event('change'));
    assert.equal(effort.value, 'ultra');
    assert.equal(widgetEffort.value, 'ultra');
    assert.equal(button.dataset.codexEffort, 'ultra');
    assert.equal(state.activeLedger.cards[0].codexRunEffort, 'ultra');
    await new Promise((resolve) => setImmediate(resolve));
    rejectMutation(new Response(JSON.stringify({ ok: false }), { status: 500 }));
    await waitFor(() => state.activeLedger.cards[0].codexRunEffort === 'medium');

    assert.equal(effort.value, 'medium');
    assert.equal(widgetEffort.value, 'medium');
    assert.equal(button.dataset.codexModel, 'gpt-5.4');
    assert.equal(button.dataset.codexEffort, 'medium');
    assert.equal(state.activeLedger.cards[0].codexRunEffort, 'medium');
    assert.ok(state.telemetry.some((entry: Record<string, unknown>) => entry.name === 'commit-ledger-edit-failed'));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('generated skill-result threads bind and render their retained provider session id', async () => {
  const previousFetch = globalThis.fetch;
  const { codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const runId = 'codex-skill-1783682000000-generated';
  const executionId = 'execution-generated';
  const cardId = `card-${runId}`;
  const threadId = `thread-${cardId}`;
  const requests: string[] = [];
  const execution = executionState({ executionId, sessionId: runId, kind: 'pipeline-skill' });
  const summary = taskExecutionSummary(cardId, [{ sessionId: runId, executions: [execution] }]);
  const presentation = executionPresentation(execution);

  try {
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      const body = url.includes('/execution-state') ? summary : presentation;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    state.activeTab = 'ux';
    state.activeLedger = {
      cards: [{
        id: cardId,
        title: 'Generated skill result',
        cardType: 'codex-skill-run',
        codexThreadRunId: runId,
        codexPipelineRunId: 'codex-pipeline-1783682000000-generated',
        codexPipelineName: 'Research pipeline',
        codexPipelineStatus: 'complete',
        codexPipelineStepName: 'Synthesis',
        codexSkillName: 'research-synthesis',
      }],
      annotations: [],
      relationships: [],
      notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();
    await waitFor(() => state.threadExecutionPresentationByThreadId[threadId]?.execution?.executionId === executionId);
    renderThreadPanel();

    assert.equal(state.threadSelectedExecutionIdByThreadId[threadId], executionId);
    assert.ok(codexLog.querySelector('.codex-log-status'));
    assert.equal(codexLog.querySelector('.codex-log-empty'), null);
    assert.deepEqual(requests, [
      `/api/tasks/${cardId}/execution-state`,
      `/api/task-executions/${executionId}`,
    ]);
    const statusValues = codexLog.querySelectorAll('dd').map((element) => element.textContent);
    assert.ok(statusValues.includes('Research pipeline · complete'));
    assert.ok(statusValues.includes('research-synthesis · complete'));
  } finally {
    state.threadPanelOpen = false;
    renderThreadPanel();
    globalThis.fetch = previousFetch;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
  }
});

test('closing the desktop thread panel releases selected and active run polling', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const threadId = 'thread-card-close';
  const runId = 'codex-skill-close';
  const cleared = new Set<number>();
  let nextTimer = 0;
  try {
    globalThis.setTimeout = (() => ++nextTimer as unknown as ReturnType<typeof setTimeout>) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => { cleared.add(Number(timer)); }) as typeof clearTimeout;
    globalThis.fetch = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    state.activeTab = 'specs';
    state.activeLedger = {
      cards: [{ id: 'card-close', title: 'Close polling', codexThreadRunId: runId }],
      annotations: [], relationships: [], notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadPinOnRender = false;
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadRunIdByThreadId = {};
    state.threadActiveRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadActiveRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();
    assert.ok(nextTimer > 0);
    const clearedBeforeClose = cleared.size;
    state.threadPanelOpen = false;
    renderThreadPanel();

    assert.ok(cleared.size > clearedBeforeClose);
    assert.equal(state.threadActiveRunIdByThreadId[threadId], undefined);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadActiveRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadActiveRunSummaryByThreadId = {};
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
  const oldExecution = executionState({ executionId: 'execution-old', sessionId: oldRunId, requestedAt: '2026-07-25T01:00:00.000Z' });
  const newExecution = executionState({ executionId: 'execution-new', sessionId: newRunId, requestedAt: '2026-07-25T02:00:00.000Z' });
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
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadSelectedRunIdByThreadId = {};
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {
      [threadId]: taskExecutionSummary('card-history', [
        { sessionId: oldRunId, executions: [oldExecution] },
        { sessionId: newRunId, executions: [newExecution] },
      ]),
    };
    state.threadExecutionPresentationByThreadId = {
      [threadId]: executionPresentation(newExecution),
    };
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();

    assert.equal(state.threadSelectedRunIdByThreadId[threadId], newRunId);
    assert.equal(state.threadSelectedExecutionIdByThreadId[threadId], 'execution-new');
    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Execution 2 of 2');
    assert.equal(codexLog.querySelector('.codex-log-run-arrow--previous')?.disabled, false);
    assert.equal(codexLog.querySelector('.codex-log-run-arrow--next')?.disabled, true);

    codexLog.querySelector('.codex-log-run-arrow--previous')?.dispatchEvent(new Event('click'));
    assert.equal(state.threadSelectedRunIdByThreadId[threadId], oldRunId);
    assert.equal(state.threadSelectedExecutionIdByThreadId[threadId], 'execution-old');
    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Execution 1 of 2');
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
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});

test('Codex Log renders the settled empty state when the local task replica has no executions', async () => {
  const { codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadCodexLog } = await import('../../../../src/runtime/thread/effect/render-thread-codex-log.js');
  const threadId = 'thread-card-empty';
  try {
    state.activeLedger = {
      cards: [{ id: 'card-empty', title: 'No executions' }],
      annotations: [],
      relationships: [],
      notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.threadTaskExecutionStateByThreadId = {
      [threadId]: taskExecutionSummary('card-empty', [], []),
    };

    renderThreadCodexLog();

    assert.equal(codexLog.querySelector('.codex-log-empty')?.textContent, 'No Codex run for this thread.');
    assert.equal(codexLog.querySelector('.codex-log-waiting'), null);
  } finally {
    state.threadId = '';
    state.activeLedger = null;
    state.threadTaskExecutionStateByThreadId = {};
  }
});

test('Codex Log counts continuations as separate runs with execution-scoped metrics and events', async () => {
  const { codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadCodexLog } = await import('../../../../src/runtime/thread/effect/render-thread-codex-log.js');
  const runId = 'codex-skill-1784439000000-continuations';
  const threadId = 'thread-card-continuations';
  const executions = ['a', 'b', 'c'].map((suffix, index) => executionState({
    executionId: `execution-${suffix}`,
    sessionId: runId,
    phase: suffix === 'c' ? 'running' : 'succeeded',
    requestedAt: `2026-07-25T0${index + 1}:00:00.000Z`,
  }));
  const tool = (id: string, command: string) => ({
    id,
    kind: 'tool_call',
    title: command,
    command,
    status: 'completed',
    exitCode: '0',
    severity: 'info',
  });
  try {
    state.activeTab = 'specs';
    state.activeLedger = { cards: [{ id: 'card-continuations', title: 'Continuations', codexThreadRunId: runId, codexThreadRunIds: [runId] }], annotations: [], relationships: [], notes: { [threadId]: [] } };
    state.threadId = threadId;
    state.threadPanelOpen = true;
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadSelectedRunIdByThreadId = { [threadId]: runId };
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {
      [threadId]: taskExecutionSummary(
        'card-continuations',
        [{ sessionId: runId, executions }],
        ['execution-c'],
      ),
    };
    state.threadExecutionPresentationByThreadId = {
      [threadId]: executionPresentation(executions[2], [
        tool('tool-c1', 'third-1'),
        tool('tool-c2', 'third-2'),
        tool('tool-c3', 'third-3'),
        {
          id: 'comment-c',
          kind: 'comment',
          title: 'Codex comment',
          text: 'Keep this execution comment visible.',
          status: '',
          severity: 'info',
        },
      ]),
    };

    renderThreadCodexLog();

    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Execution 3 of 3');
    assert.equal(codexLog.querySelector('.codex-tool-call-command')?.textContent, 'third-1');
    const comment = codexLog.querySelector('.codex-log-event.is-comment');
    assert.ok(comment);
    assert.ok(comment.querySelectorAll('*').some((element) => element.textContent === 'Keep this execution comment visible.'));
    assert.ok(codexLog.querySelectorAll('dd').map((element) => element.textContent).includes('3'));

    codexLog.querySelector('.codex-log-run-arrow--previous')?.dispatchEvent(new Event('click'));
    assert.equal(state.threadSelectedExecutionIdByThreadId[threadId], 'execution-b');
    state.threadExecutionPresentationByThreadId[threadId] = executionPresentation(executions[1], [
      tool('tool-b1', 'second-1'),
      tool('tool-b2', 'second-2'),
    ]);
    renderThreadCodexLog();
    assert.equal(codexLog.querySelector('.codex-log-run-position')?.textContent, 'Execution 2 of 3');
    assert.equal(codexLog.querySelector('.codex-tool-call-command')?.textContent, 'second-1');
    assert.ok(codexLog.querySelectorAll('dd').map((element) => element.textContent).includes('2'));
  } finally {
    state.threadId = '';
    state.activeLedger = null;
    state.threadSelectedRunIdByThreadId = {};
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
  }
});

test('live Codex Log events preserve the viewport and every disclosure state', async () => {
  const { root, codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadCodexLog } = await import('../../../../src/runtime/thread/effect/render-thread-codex-log.js');
  const { renderThreadCodexLogUpdate } = await import('../../../../src/runtime/thread/effect/render-thread-codex-log-update.js');
  const threadId = 'thread-card-live-interaction';
  const execution = executionState({
    executionId: 'execution-live-interaction',
    sessionId: 'codex-skill-live-interaction',
    phase: 'running',
  });
  const prompt = {
    id: 'prompt',
    kind: 'run_status',
    title: 'User prompt',
    text: 'Inspect the current task.',
    status: 'running',
    severity: 'info',
  };
  const tool = {
    id: 'tool-one',
    kind: 'tool_call',
    title: 'Inspect',
    command: 'rg current task',
    status: 'completed',
    exitCode: '0',
    severity: 'info',
  };
  try {
    state.activeTab = 'specs';
    state.activeLedger = {
      cards: [{ id: 'card-live-interaction', title: 'Live interaction' }],
      annotations: [],
      relationships: [],
      notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.threadPanelOpen = true;
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadLogFollowBottomByThreadId = { [threadId]: false };
    state.threadTaskExecutionStateByThreadId = {
      [threadId]: taskExecutionSummary(
        'card-live-interaction',
        [{ sessionId: execution.sessionId, executions: [execution] }],
        [execution.executionId],
      ),
    };
    state.threadExecutionPresentationByThreadId = {
      [threadId]: executionPresentation(execution, [prompt, tool]),
    };

    renderThreadCodexLog();
    const promptDisclosure = codexLog.querySelector('[data-event-key="prompt"]') as FakeElement & { open: boolean };
    const toolDisclosure = codexLog.querySelector('[data-tool-event-key="tool-one"]') as FakeElement & { open: boolean };
    promptDisclosure.open = true;
    toolDisclosure.open = true;
    const viewport = root.querySelector('.thread-log-scroll') as FakeElement;
    viewport.scrollTop = 240;
    viewport.scrollHeight = 1_200;
    viewport.clientHeight = 400;

    state.threadExecutionPresentationByThreadId[threadId] = executionPresentation(execution, [
      prompt,
      tool,
      {
        id: 'message',
        kind: 'agent_message',
        title: 'Codex message',
        text: 'A new event arrived.',
        status: '',
        severity: 'info',
      },
    ]);
    renderThreadCodexLogUpdate();

    assert.equal(viewport.scrollTop, 240);
    assert.equal((codexLog.querySelector('[data-event-key="prompt"]') as FakeElement & { open: boolean }).open, true);
    assert.equal((codexLog.querySelector('[data-tool-event-key="tool-one"]') as FakeElement & { open: boolean }).open, true);
  } finally {
    state.threadId = '';
    state.activeLedger = null;
    state.threadPanelOpen = false;
    state.threadActiveTabByThreadId = {};
    state.threadLogFollowBottomByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
  }
});

test('queued thread runs expose exact cancellation and render their queue position without elapsed time', async () => {
  const previousFetch = globalThis.fetch;
  const { heading, codexLog } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const { syncThreadCodexRunControls } = await import('../../../../src/runtime/thread/effect/sync-thread-codex-run-controls.js');
  const runId = 'codex-skill-queued';
  const threadId = 'thread-card-a';
  const execution = executionState({
    executionId: 'execution-queued',
    sessionId: runId,
    phase: 'queued',
    queuePosition: 3,
  });
  const summary = taskExecutionSummary('card-a', [{ sessionId: runId, executions: [execution] }], ['execution-queued']);
  const presentation = executionPresentation(execution);
  try {
    globalThis.fetch = (async (url) => new Response(
      JSON.stringify(String(url).includes('/execution-state') ? summary : presentation),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
    state.activeTab = 'specs';
    state.activeLedger = { cards: [{ id: 'card-a', title: 'Card A', codexThreadRunId: runId }], annotations: [], relationships: [], notes: { [threadId]: [] } };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadSelectedExecutionIdByThreadId = { [threadId]: 'execution-queued' };
    state.threadTaskExecutionStateByThreadId = { [threadId]: summary };
    state.threadExecutionPresentationByThreadId = { [threadId]: presentation };
    state.telemetry = [];
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();

    assert.equal(heading.querySelector('.thread-actions')?.hidden, true);
    assert.equal(heading.dataset.codexRunning, 'true');
    assert.equal(heading.dataset.codexStatus, 'pending');
    assert.equal(codexLog.querySelector('.terminal-button__label')?.textContent, 'CANCEL');
    assert.equal(codexLog.querySelector('.codex-log-action-button')?.dataset.codexExecutionId, 'execution-queued');
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
    state.threadSelectedExecutionIdByThreadId = {};
    state.threadTaskExecutionStateByThreadId = {};
    state.threadExecutionPresentationByThreadId = {};
    state.threadActiveRunIdByThreadId = {};
    state.threadActiveRunSummaryByThreadId = {};
  }
});

test('a retained provider session cannot override a terminal execution summary', async () => {
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
      }],
      annotations: [], relationships: [], notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.renderedThreadId = '';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
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

test('a retained provider session renders its cached terminal execution without lifecycle revalidation', async () => {
  const previousFetch = globalThis.fetch;
  const { heading } = installDom();
  const { state } = await import('../../../../src/runtime/state.js');
  const { renderThreadPanel } = await import('../../../../src/runtime/thread/effect/render-thread-panel.js');
  const { bindCardSkillRunLogConsumer, unbindCardSkillRunLogConsumer, purgeCardSkillRunLog } = await import('../../../../src/runtime/codex/effect/poll-card-skill-run.js');
  const runId = 'codex-skill-terminal-cache-revalidation';
  const threadId = 'thread-card-cache-revalidation';
  const identity = {
    projectId: 'project-cache-revalidation',
    replicaNodeId: 'replica-cache-revalidation',
    ledgerId: 'specs',
    cardId: 'card-cache-revalidation',
    runId,
    consumerId: 'seed-terminal-cache',
  };
  let requestCount = 0;
  const summary = (status: 'complete' | 'pending', executionId: string) => ({
    ok: true, active: status === 'pending', runId, runKind: 'thread', status, executionId,
    queuePosition: status === 'pending' ? 2 : null, lineCount: 4, nextSince: 4, events: [], diagnostics: [], executions: [], metadata: {},
  });
  try {
    globalThis.fetch = (async (input) => {
      if (!String(input).includes(runId)) return new Response(JSON.stringify(summary('complete', 'unrelated-execution')), { status: 200, headers: { 'content-type': 'application/json' } });
      requestCount += 1;
      return new Response(JSON.stringify(summary('complete', 'execution-old')), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    let seeded = false;
    bindCardSkillRunLogConsumer({ ...identity, onSummary: () => { seeded = true; } });
    await waitFor(() => seeded);
    unbindCardSkillRunLogConsumer(identity);

    state.projectId = identity.projectId;
    state.replicaNodeId = identity.replicaNodeId;
    state.activeTab = 'specs';
    state.activeLedger = {
      cards: [{ id: identity.cardId, title: 'Cached run', codexThreadRunId: runId }],
      annotations: [], relationships: [], notes: { [threadId]: [] },
    };
    state.threadId = threadId;
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.threadPinOnRender = false;
    state.threadActiveTabByThreadId = { [threadId]: 'codex-log' };
    state.threadRunIdByThreadId = {};
    state.threadActiveRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadActiveRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
    state.voice = { recording: false, durationMs: 0, level: 0, transcriptionStatus: 'idle' };

    renderThreadPanel();
    await Promise.resolve();
    assert.equal(requestCount, 1);
    assert.equal(heading.dataset.codexRunning, 'false');
    assert.equal(heading.dataset.codexStatus, '');
  } finally {
    purgeCardSkillRunLog(identity);
    globalThis.fetch = previousFetch;
    state.threadId = '';
    state.activeLedger = null;
    state.threadActiveTabByThreadId = {};
    state.threadRunIdByThreadId = {};
    state.threadActiveRunIdByThreadId = {};
    state.threadRunSummaryByThreadId = {};
    state.threadActiveRunSummaryByThreadId = {};
    state.threadRunEventsByThreadId = {};
    state.threadCoalescedToolsByThreadId = {};
  }
});
