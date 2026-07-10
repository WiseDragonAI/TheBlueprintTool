/**
 * WHAT: Integration coverage for frontend Codex skill start, poll, continue, and cancellation requests.
 * WHY: Widget request routing must preserve run identity while lifecycle notes arrive independently.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCodexSkills } from '../../src/runtime/codex/effect/load-codex-skills.js';
import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
import { requestCardSkillRunCancel } from '../../src/runtime/codex/effect/request-card-skill-run-cancel.js';
import { requestCardSkillRunContinue } from '../../src/runtime/codex/effect/request-card-skill-run-continue.js';
import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
import { requestThreadCodexProcess } from '../../src/runtime/codex/effect/request-thread-codex-process.js';
import { bindCardSkillRunLogConsumer, bindCardSkillRunWidget, resumeExternallyStartedCardSkillRun } from '../../src/runtime/codex/effect/poll-card-skill-run.js';
import type { CardSkillRunEvent, CardSkillRunStatus, CardSkillRunSummary } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
import { cardCodexRunId, cardCodexThreadRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
import { groupSequentialToolCalls, mergeThreadRunEvents } from '../../src/runtime/codex/helper/thread-run-log.js';
import { threadCodexCardId } from '../../src/runtime/codex/helper/thread-codex-card-id.js';
import { state } from '../../src/runtime/state.js';

type FakeNode = {
  dataset: Record<string, string>;
  disabled: boolean;
  hidden: boolean;
  onclick?: (event: Event) => void;
  setAttribute: () => void;
  textContent: string;
  value: string;
};

function fakeNode(): FakeNode {
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    setAttribute() {},
    textContent: '',
    value: ''
  };
}

function fakeCodexRunWidget(): HTMLElement & { nodes: Record<string, FakeNode> } {
  const selectors = [
    '[data-codex-run-cancel]',
    '[data-codex-run-continue]',
    '[data-codex-run-effort]',
    '[data-codex-run-files]',
    '[data-codex-run-latest]',
    '[data-codex-run-messages]',
    '[data-codex-run-metadata]',
    '[data-codex-run-model]',
    '[data-codex-run-new-session]',
    '[data-codex-run-source]',
    '[data-codex-run-status]',
    '[data-codex-run-timer]',
    '[data-codex-run-tools]'
  ];
  const nodes = Object.fromEntries(selectors.map((selector) => [selector, fakeNode()])) as Record<string, FakeNode>;
  return {
    dataset: {},
    nodes,
    querySelector(selector: string) {
      return nodes[selector] ?? null;
    }
  } as unknown as HTMLElement & { nodes: Record<string, FakeNode> };
}

function runEvent(input: Partial<CardSkillRunEvent> & { line: number; kind: string }): CardSkillRunEvent {
  return {
    runId: input.runId ?? 'codex-skill-5000-log',
    line: input.line,
    source: input.source ?? 'jsonl',
    sourceLine: input.sourceLine ?? input.line,
    type: input.type ?? 'item.completed',
    kind: input.kind,
    title: input.title ?? input.tool ?? input.kind,
    text: input.text ?? '',
    status: input.status ?? '',
    itemId: input.itemId ?? '',
    tool: input.tool ?? '',
    output: input.output ?? '',
    exitCode: input.exitCode ?? '',
    severity: input.severity ?? 'info',
    persist: input.persist ?? false,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for condition.');
}

test('loadCodexSkills returns server skill summaries', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, '/api/codex/skills');
      return new Response(JSON.stringify({ ok: true, skills: [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const skills = await loadCodexSkills();
    assert.deepEqual(skills, [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillProcess posts active card skill payload', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/process');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
        ledgerId: 'specs',
        cardId: 'card-a',
        skillName: 'analysis',
        codexModel: 'gpt-5.5',
        codexEffort: 'xhigh'
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'run-a' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillProcess({ ledgerId: 'specs', cardId: 'card-a', skillName: 'analysis', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
    assert.equal(result.ok, true);
    assert.equal(result.run?.id, 'run-a');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestThreadCodexProcess posts active thread payload', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/threads/process');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
        ledgerId: 'specs',
        threadId: 'thread-card-a',
        cardId: 'card-a',
        codexModel: 'gpt-5.5',
        codexEffort: 'high'
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-1000-abcd', outputCardId: 'card-a' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestThreadCodexProcess({ ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a', codexModel: 'gpt-5.5', codexEffort: 'high' });
    assert.equal(result.ok, true);
    assert.equal(result.run?.outputCardId, 'card-a');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('threadCodexCardId only resolves card-backed threads', () => {
  const ledger = { cards: [{ id: 'card-a' }] };
  assert.equal(threadCodexCardId(ledger, 'thread-card-a'), 'card-a');
  assert.equal(threadCodexCardId(ledger, 'thread-zone-a'), '');
  assert.equal(threadCodexCardId(null, 'thread-card-a'), '');
});

test('requestCardSkillRunStatus queries derived run progress', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd?ledgerId=specs&cardId=card-a&since=4');
      return new Response(JSON.stringify({
        ok: true,
        runId: 'codex-skill-1000-abcd',
        runKind: 'thread',
        status: 'running',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 1200,
        lineCount: 8,
        nextSince: 8,
        toolCallCount: 2,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 1,
        warningCount: 1,
        errorCount: 2,
        transportStatus: 'degraded',
        persistedEventCount: 2,
        metadata: { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { line: 8, source: 'jsonl', sourceLine: 8, kind: 'tool_call', title: 'rg TODO', output: 'match', severity: 'info' },
        events: [{ line: 8, source: 'jsonl', sourceLine: 8, kind: 'tool_call', title: 'rg TODO', output: 'match', severity: 'info' }],
        diagnostics: [{ line: 2, source: 'stderr', sourceLine: 2, kind: 'transport', title: 'Transport degraded', text: 'connection lost', severity: 'warning' }]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunStatus({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd', since: 4 });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'running');
    assert.equal(result.startedAt, '2026-07-08T00:00:00.000Z');
    assert.equal(result.toolCallCount, 2);
    assert.equal(result.nextSince, 8);
    assert.equal(result.runKind, 'thread');
    assert.equal(result.warningCount, 1);
    assert.equal(result.errorCount, 2);
    assert.equal(result.transportStatus, 'degraded');
    assert.equal(result.events[0].runId, 'codex-skill-1000-abcd');
    assert.equal(result.events[0].output, 'match');
    assert.equal(result.diagnostics[0].source, 'stderr');
    assert.deepEqual(result.metadata, { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('thread run reducer coalesces tool lifecycles, deduplicates diagnostics, and preserves group keys', () => {
  const tool = (itemId: string, line: number, status: string, output = '') => runEvent({
    line,
    kind: 'tool_call',
    itemId,
    type: status === 'started' ? 'item.started' : 'item.completed',
    status: status === 'started' ? 'in_progress' : status,
    tool: `rg ${itemId}`,
    output,
  });
  const lifecycle: CardSkillRunEvent[] = [];
  for (let index = 1; index <= 4; index += 1) {
    lifecycle.push(tool(`tool-${index}`, index * 2 - 1, 'started'));
    lifecycle.push(tool(`tool-${index}`, index * 2, 'completed', `output-${index}`));
  }
  lifecycle.push(runEvent({ line: 9, kind: 'thinking', itemId: 'thought-1', title: 'Codex thinking', text: 'Check the result.' }));
  for (let index = 5; index <= 6; index += 1) {
    lifecycle.push(tool(`tool-${index}`, index * 2, 'started'));
    lifecycle.push(tool(`tool-${index}`, index * 2 + 1, 'completed', `output-${index}`));
  }
  const diagnostic = runEvent({ line: 1, source: 'stderr', sourceLine: 1, kind: 'transport', title: 'Transport degraded', text: 'connection lost', severity: 'warning' });
  const first = mergeThreadRunEvents([], [...lifecycle, diagnostic], 'codex-skill-5000-log');
  assert.equal(first.events.filter((event) => event.kind === 'tool_call').length, 6);
  assert.equal(Object.keys(first.tools).length, 6);
  assert.equal(first.events[0].line, 1);
  assert.equal(first.events[0].status, 'completed');
  assert.equal(first.events[0].output, 'output-1');
  const firstGroups = groupSequentialToolCalls(first.events).filter((block) => block.kind === 'tool-group');
  assert.deepEqual(firstGroups.map((group) => group.tools.length), [4, 2]);

  const replay = mergeThreadRunEvents(first.events, [lifecycle[1], diagnostic], 'codex-skill-5000-log');
  assert.equal(replay.changedEventKeys.length, 0);
  assert.deepEqual(replay.events, first.events);
  assert.deepEqual(
    groupSequentialToolCalls(replay.events).filter((block) => block.kind === 'tool-group').map((group) => group.key),
    firstGroups.map((group) => group.key)
  );

  const missingIds = mergeThreadRunEvents([], [
    runEvent({ line: 30, kind: 'tool_call', type: 'item.started', status: 'in_progress', tool: 'one' }),
    runEvent({ line: 31, kind: 'tool_call', type: 'item.completed', status: 'completed', tool: 'two' }),
  ], 'codex-skill-5000-log');
  assert.equal(Object.keys(missingIds.tools).length, 2);
  assert.notEqual(missingIds.events[0].eventKey, missingIds.events[1].eventKey);
});

test('thread log consumer shares one advancing poller across rerenders and stops on every terminal state', async () => {
  const previousFetch = globalThis.fetch;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  let timerId = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const requests: string[] = [];
  const received: string[] = [];
  let responseStatuses: CardSkillRunStatus[] = ['running', 'complete'];
  let responseIndex = 0;
  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };
  const runNextTimer = async (delay: number) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `Expected a scheduled ${delay} ms timer.`);
    timers.delete(entry[0]);
    entry[1].callback();
    await flush();
  };
  try {
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      constructor(_name: string, public detail: unknown = undefined) {}
    };
    globalThis.setTimeout = ((callback: () => void, delay = 0) => {
      const id = ++timerId;
      timers.set(id, { callback, delay: Number(delay) });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(Number(id));
    }) as typeof clearTimeout;
    globalThis.fetch = (async (url: string) => {
      requests.push(url);
      const status = responseStatuses[Math.min(responseIndex, responseStatuses.length - 1)];
      responseIndex += 1;
      const lineCount = responseIndex * 2;
      return new Response(JSON.stringify({
        ok: true,
        runId: 'codex-skill-6000-shared',
        runKind: 'thread',
        status,
        lineCount,
        nextSince: lineCount,
        events: [runEvent({ runId: 'codex-skill-6000-shared', line: lineCount, kind: 'run_status', status })],
        diagnostics: [],
        metadata: {}
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const input = { ledgerId: 'specs', cardId: 'card-shared', runId: 'codex-skill-6000-shared', consumerId: 'thread-log:thread-card-shared' };
    bindCardSkillRunLogConsumer({ ...input, onSummary: (summary) => received.push(`stale:${summary.status}`) });
    bindCardSkillRunLogConsumer({ ...input, onSummary: (summary) => received.push(`current:${summary.status}`) });
    assert.deepEqual([...timers.values()].map((timer) => timer.delay), [0]);
    await runNextTimer(0);
    assert.deepEqual(received, ['current:running']);
    assert.equal(requests[0], '/api/codex/skills/runs/codex-skill-6000-shared?ledgerId=specs&cardId=card-shared&since=0');
    assert.deepEqual([...timers.values()].map((timer) => timer.delay), [1000]);
    await runNextTimer(1000);
    assert.deepEqual(received, ['current:running', 'current:complete']);
    assert.equal(requests[1], '/api/codex/skills/runs/codex-skill-6000-shared?ledgerId=specs&cardId=card-shared&since=2');
    assert.equal(timers.size, 0);

    for (const status of ['failed', 'cancelled'] as CardSkillRunStatus[]) {
      responseStatuses = [status];
      responseIndex = 0;
      const runId = `codex-skill-6001-${status}`;
      bindCardSkillRunLogConsumer({
        ledgerId: 'specs', cardId: `card-${status}`, runId, consumerId: `thread-log:${status}`,
        onSummary: (summary) => received.push(`${status}:${summary.status}`)
      });
      await runNextTimer(0);
      assert.equal(received.at(-1), `${status}:${status}`);
      assert.equal(timers.size, 0);
    }
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('thread log consumer delivers unavailable state before stopping its timer', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Run unavailable.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    })) as typeof fetch;
    let summary: CardSkillRunSummary | undefined;
    bindCardSkillRunLogConsumer({
      ledgerId: 'specs', cardId: 'card-unavailable', runId: 'codex-skill-7000-unavailable', consumerId: 'thread-log:unavailable',
      onSummary: (value) => { summary = value; }
    });
    await waitFor(() => Boolean(summary));
    assert.equal(summary?.ok, false);
    assert.equal(summary?.status, 'unknown');
    assert.equal(summary?.error, 'Run unavailable.');
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(summary?.status, 'unknown');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('status polling updates only the run widget and never queues a ledger refresh', async () => {
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  const requests: Array<{ url: string; method: string }> = [];
  const activeLedger = {
    cards: [{ id: 'card-poll', title: 'Unchanged' }],
    annotations: [], relationships: [], notes: {}
  };
  try {
    (globalThis as unknown as { document: unknown }).document = { contains: () => true };
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      detail: unknown;
      constructor(_name: string, init?: { detail?: unknown }) { this.detail = init?.detail; }
    };
    state.activeLedger = activeLedger;
    state.ledgerContentRefresh = { inFlight: false, ledgerReasons: [], changedContentFiles: [], threadReasons: [], threadScope: null };
    state.pendingLedgerContentRefresh = false;
    state.pendingThreadContentRefresh = false;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, method: String(init?.method ?? 'GET') });
      return new Response(JSON.stringify({
        ok: true,
        status: 'complete',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 2500,
        lineCount: 5,
        nextSince: 5,
        toolCallCount: 1,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 0,
        persistedEventCount: 1,
        metadata: { sourceCardTitle: 'Polling proof', sourceThreadId: 'thread-card-poll', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { title: 'Turn completed' },
        events: []
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const widget = fakeCodexRunWidget();
    bindCardSkillRunWidget({ ledgerId: 'specs', cardId: 'card-poll', runId: 'codex-skill-4000-poll-only', element: widget });
    await waitFor(() => widget.nodes['[data-codex-run-status]'].textContent === 'COMPLETE');

    assert.deepEqual(requests, [{
      url: '/api/codex/skills/runs/codex-skill-4000-poll-only?ledgerId=specs&cardId=card-poll&since=0',
      method: 'GET'
    }]);
    assert.equal(state.activeLedger, activeLedger);
    assert.equal(state.pendingLedgerContentRefresh, false);
    assert.equal(state.pendingThreadContentRefresh, false);
    assert.deepEqual(state.ledgerContentRefresh, {
      inFlight: false,
      ledgerReasons: [],
      changedContentFiles: [],
      threadReasons: [],
      threadScope: null
    });
    assert.equal(widget.nodes['[data-codex-run-latest]'].textContent, 'Turn Completed in 00:02');
  } finally {
    (globalThis as unknown as { document?: unknown }).document = previousDocument;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
    globalThis.fetch = previousFetch;
  }
});

test('externally started Codex runs clear terminal widget cache and restart polling', async () => {
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousFetch = globalThis.fetch;
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousCustomEvent = (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent;
  const requests: string[] = [];
  const continuationBodies: Array<Record<string, unknown>> = [];
  try {
    (globalThis as unknown as { document: unknown }).document = { contains: () => true };
    (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
      detail: unknown;
      constructor(_name: string, init?: { detail?: unknown }) {
        this.detail = init?.detail;
      }
    };
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.endsWith('/continue')) {
        continuationBodies.push(JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>);
        return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-3000-cache', status: 'running' } }), {
          status: 202,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (init?.method === 'POST') return new Response('', { status: 204 });
      requests.push(url);
      return new Response(JSON.stringify({
        ok: true,
        status: 'complete',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 1000,
        lineCount: requests.length === 1 ? 8 : 12,
        nextSince: requests.length === 1 ? 8 : 12,
        toolCallCount: 0,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 0,
        persistedEventCount: 1,
        metadata: { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { title: 'Turn completed' },
        events: []
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const firstWidget = fakeCodexRunWidget();
    bindCardSkillRunWidget({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache', element: firstWidget });
    await waitFor(() => requests.length === 1);
    await waitFor(() => firstWidget.nodes['[data-codex-run-status]'].textContent === 'COMPLETE');
    assert.equal(firstWidget.nodes['[data-codex-run-model]'].value, 'gpt-5.5');
    assert.equal(firstWidget.nodes['[data-codex-run-effort]'].value, 'xhigh');
    assert.equal(firstWidget.nodes['[data-codex-run-model]'].disabled, false);
    assert.equal(firstWidget.nodes['[data-codex-run-effort]'].disabled, false);
    assert.equal(firstWidget.nodes['[data-codex-run-new-session]'].hidden, false);

    const cachedWidget = fakeCodexRunWidget();
    bindCardSkillRunWidget({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache', element: cachedWidget });
    assert.equal(cachedWidget.nodes['[data-codex-run-status]'].textContent, 'COMPLETE');

    const resumed = resumeExternallyStartedCardSkillRun({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-3000-cache' });
    assert.equal(resumed, true);
    assert.equal(cachedWidget.nodes['[data-codex-run-status]'].textContent, 'RUNNING');
    assert.equal(cachedWidget.nodes['[data-codex-run-latest]'].textContent, 'Continuing session');
    assert.equal(cachedWidget.nodes['[data-codex-run-cancel]'].hidden, false);
    assert.equal(cachedWidget.nodes['[data-codex-run-continue]'].hidden, true);
    assert.equal(cachedWidget.nodes['[data-codex-run-new-session]'].hidden, true);
    assert.equal(cachedWidget.nodes['[data-codex-run-model]'].disabled, true);
    assert.equal(cachedWidget.nodes['[data-codex-run-effort]'].disabled, true);
    await waitFor(() => requests.length === 2);
    assert.equal(requests[1], '/api/codex/skills/runs/codex-skill-3000-cache?ledgerId=specs&cardId=card-a&since=0');
    await waitFor(() => cachedWidget.nodes['[data-codex-run-status]'].textContent === 'COMPLETE');
    cachedWidget.nodes['[data-codex-run-tools]'].textContent = '7';
    cachedWidget.nodes['[data-codex-run-messages]'].textContent = '2';
    cachedWidget.nodes['[data-codex-run-files]'].textContent = '1';
    cachedWidget.nodes['[data-codex-run-new-session]'].onclick?.(new Event('click'));
    assert.equal(cachedWidget.nodes['[data-codex-run-status]'].textContent, 'RUNNING');
    assert.equal(cachedWidget.nodes['[data-codex-run-latest]'].textContent, 'Starting new session');
    assert.equal(cachedWidget.nodes['[data-codex-run-tools]'].textContent, '0');
    assert.equal(cachedWidget.nodes['[data-codex-run-messages]'].textContent, '0');
    assert.equal(cachedWidget.nodes['[data-codex-run-files]'].textContent, '0');
    await waitFor(() => continuationBodies.length === 1);
    assert.equal(continuationBodies[0].newSession, true);
    assert.equal(continuationBodies[0].codexModel, 'gpt-5.5');
    assert.equal(continuationBodies[0].codexEffort, 'xhigh');
  } finally {
    (globalThis as unknown as { document?: unknown }).document = previousDocument;
    (globalThis as unknown as { window?: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent = previousCustomEvent;
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillRunCancel posts active card run cancellation', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd/cancel');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), { ledgerId: 'specs', cardId: 'card-a' });
      return new Response(JSON.stringify({ ok: true, status: 'cancelled' }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunCancel({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd' });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'cancelled');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillRunContinue can start a new session with the selected model and effort', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd/continue');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
        ledgerId: 'specs',
        cardId: 'card-a',
        codexModel: 'gpt-5.4',
        codexEffort: 'high',
        newSession: true
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-1000-abcd', status: 'running' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunContinue({
      ledgerId: 'specs',
      cardId: 'card-a',
      runId: 'codex-skill-1000-abcd',
      codexModel: 'gpt-5.4',
      codexEffort: 'high',
      newSession: true
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'running');
    assert.equal(result.run?.id, 'codex-skill-1000-abcd');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('cardCodexRunId falls back to the durable output card id', () => {
  assert.equal(cardCodexRunId({
    id: 'card-a',
    codexThreadRunId: 'codex-skill-9999-thread'
  }), 'codex-skill-9999-thread');
  assert.equal(cardCodexRunId({
    id: 'card-codex-skill-1000-abcd',
    comment: { what: '# Finished result without run metadata' }
  }), 'codex-skill-1000-abcd');
  assert.equal(cardCodexRunId({
    id: 'card-result',
    comment: { what: 'Codex run: codex-skill-2000-efgh' }
  }), 'codex-skill-2000-efgh');
  assert.equal(cardCodexThreadRunId({ codexThreadRunId: 'codex-skill-9999-thread' }), 'codex-skill-9999-thread');
  assert.equal(cardCodexThreadRunId({ codexRunId: 'codex-skill-9999-card' }), '');
});
