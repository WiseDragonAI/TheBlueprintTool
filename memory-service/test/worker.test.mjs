import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.mjs';

function environment() {
  const calls = [];
  return {
    calls,
    env: {
      MEMORY_API_TOKEN: 'secret',
      MEMORIES: {
        prepare(sql) {
          const call = { sql, bindings: [] };
          calls.push(call);
          return {
            bind(...bindings) { call.bindings = bindings; return this; },
            async all() { return { results: [{ id: 1, title: 'Rule' }] }; },
            async run() { return { success: true }; },
            async first() { return { count: 31 }; },
          };
        },
      },
    },
  };
}

const auth = { authorization: 'Bearer secret' };

test('rejects unauthenticated requests', async () => {
  const { env } = environment();
  const response = await handleRequest(new Request('https://memory.example/health'), env);
  assert.equal(response.status, 401);
});

test('reports D1 health and row count', async () => {
  const { env } = environment();
  const response = await handleRequest(new Request('https://memory.example/health', { headers: auth }), env);
  assert.deepEqual(await response.json(), { ok: true, rows: 31 });
});

test('binds project, type, query, and bounded limit for reads', async () => {
  const { env, calls } = environment();
  const response = await handleRequest(new Request('https://memory.example/memories?project=p&type=copywriting&query=voice&limit=500', { headers: auth }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].bindings.slice(0, 4), ['p', 'p', 'copywriting', 'copywriting']);
  assert.equal(calls[0].bindings.at(-1), 100);
  assert.match(calls[0].sql, /instr\(lower\(title\)/);
});

test('upserts one lowercase-typed memory and returns it', async () => {
  const { env, calls } = environment();
  const response = await handleRequest(new Request('https://memory.example/memories', {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Rule', body: 'Evidence', tag: 'Engineering', subtag: 'Bug', projectId: 'p', type: 'Game-Dev' }),
  }), env);
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /ON CONFLICT/);
  assert.deepEqual(calls[0].bindings.slice(0, 7), ['Rule', 'Evidence', 'engineering', 'bug', 'p', 'game-dev', '']);
});
