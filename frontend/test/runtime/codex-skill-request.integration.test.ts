import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCodexSkills } from '../../src/runtime/codex/effect/load-codex-skills.js';
import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
import { cardCodexRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';

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
        skillName: 'analysis'
      });
      return new Response(JSON.stringify({ ok: true, run: { id: 'run-a' } }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await requestCardSkillProcess({ ledgerId: 'specs', cardId: 'card-a', skillName: 'analysis' });
    assert.equal(result.ok, true);
    assert.equal(result.run?.id, 'run-a');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('requestCardSkillRunStatus queries derived run progress', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd?ledgerId=specs&cardId=card-a&since=4');
      return new Response(JSON.stringify({
        ok: true,
        status: 'running',
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
    assert.equal(result.toolCallCount, 2);
    assert.equal(result.nextSince, 8);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('cardCodexRunId falls back to the durable output card id', () => {
  assert.equal(cardCodexRunId({
    id: 'card-codex-skill-1000-abcd',
    comment: { what: '# Finished result without run metadata' }
  }), 'codex-skill-1000-abcd');
  assert.equal(cardCodexRunId({
    id: 'card-result',
    comment: { what: 'Codex run: codex-skill-2000-efgh' }
  }), 'codex-skill-2000-efgh');
});
