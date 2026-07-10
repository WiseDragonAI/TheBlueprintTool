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
import { bindCardSkillRunWidget, resumeExternallyStartedCardSkillRun } from '../../src/runtime/codex/effect/poll-card-skill-run.js';
import { cardCodexRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
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
        status: 'running',
        startedAt: '2026-07-08T00:00:00.000Z',
        elapsedMs: 1200,
        lineCount: 8,
        nextSince: 8,
        toolCallCount: 2,
        agentMessageCount: 1,
        fileChangeCount: 0,
        thinkingCount: 1,
        persistedEventCount: 2,
        metadata: { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: { title: 'rg TODO' },
        events: []
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
    assert.deepEqual(result.metadata, { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
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
});
