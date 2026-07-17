import test from 'node:test';
import assert from 'node:assert/strict';
import { requestFederatedLibrarySynchronization } from '../../src/runtime/codex/effect/request-federated-library-synchronization.js';

test('requests explicit federation synchronization and returns the peer count', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(url), '/api/federation/libraries/synchronize');
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ ok: true, synchronizedPeerCount: 2 }), { status: 200 });
    }) as typeof fetch;
    assert.deepEqual(await requestFederatedLibrarySynchronization(), { ok: true, synchronizedPeerCount: 2, error: undefined });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('preserves a server synchronization failure for modal recovery feedback', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Peer snapshot failed.' }), { status: 502 })) as typeof fetch;
    assert.deepEqual(await requestFederatedLibrarySynchronization(), { ok: false, synchronizedPeerCount: 0, error: 'Peer snapshot failed.' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
