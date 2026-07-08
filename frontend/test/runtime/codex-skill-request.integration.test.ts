import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCodexSkills } from '../../src/runtime/codex/effect/load-codex-skills.js';
import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
import { requestCardSkillRunCancel } from '../../src/runtime/codex/effect/request-card-skill-run-cancel.js';
import { requestCardSkillRunContinue } from '../../src/runtime/codex/effect/request-card-skill-run-continue.js';
import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
import { requestThreadCodexProcess } from '../../src/runtime/codex/effect/request-thread-codex-process.js';
import { cardCodexRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
import { threadCodexCardId } from '../../src/runtime/codex/helper/thread-codex-card-id.js';

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
  } finally {
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

test('requestCardSkillRunContinue posts terminal card run continuation', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd/continue');
      assert.equal(init?.method, 'POST');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), { ledgerId: 'specs', cardId: 'card-a' });
      return new Response(JSON.stringify({ ok: true, run: { id: 'codex-skill-1000-abcd', status: 'running' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillRunContinue({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd' });
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
