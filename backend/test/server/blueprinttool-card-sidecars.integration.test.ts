import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

async function startSidecarServer(): Promise<{ endpoint: string; eventsEndpoint: string; server: Server; workspace: string }> {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-card-sidecar-'));
  mkdirSync(join(workspace, '.blueprinttool', 'cards', 'specs'), { recursive: true });
  writeFileSync(join(workspace, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }]
  }));
  writeFileSync(join(workspace, '.blueprinttool', 'cards', 'specs', 'card-a.md'), 'Sidecar body.');
  writeFileSync(join(workspace, '.blueprinttool', 'specs.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.blueprinttool/cards/specs/card-a.md' }, x: 10, y: 20, w: 240 }],
    annotations: [],
    relationships: [],
    notes: {}
  }));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  process.chdir(originalCwd);
  const address = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${address.port}/blueprinttool/specs`,
    eventsEndpoint: `http://127.0.0.1:${address.port}/api/ledger-content-events`,
    server,
    workspace,
  };
}

test('blueprinttool server hydrates card sidecar markdown and keeps JSON lean on edit', async () => {
  const { endpoint, server, workspace } = await startSidecarServer();

  try {
    const loaded = await (await fetch(endpoint)).json() as { cards: Array<Record<string, any>> };
    assert.equal(loaded.cards[0].comment.what, 'Sidecar body.');

    const patchResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'card-a', description: 'Edited body.' } }),
    });
    assert.equal(patchResponse.ok, true);
    const patched = await patchResponse.json() as { cards: Array<Record<string, any>> };
    assert.equal(patched.cards[0].comment.what, 'Edited body.');

    const persisted = JSON.parse(readFileSync(join(workspace, '.blueprinttool', 'specs.json'), 'utf8')) as { cards: Array<Record<string, any>> };
    assert.equal(persisted.cards[0].comment.what, undefined);
    assert.equal(persisted.cards[0].comment.contentFile, '.blueprinttool/cards/specs/card-a.md');
    assert.equal(readFileSync(join(workspace, '.blueprinttool', 'cards', 'specs', 'card-a.md'), 'utf8'), 'Edited body.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('blueprinttool server emits card content change events for direct markdown edits', async () => {
  const { eventsEndpoint, server, workspace } = await startSidecarServer();
  const controller = new AbortController();

  try {
    const response = await fetch(eventsEndpoint, { signal: controller.signal });
    assert.equal(response.ok, true);
    const reader = response.body?.getReader();
    assert.ok(reader);
    const decoder = new TextDecoder();
    let buffer = '';
    const eventPromise = (async () => {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) return buffer;
        buffer += decoder.decode(chunk.value, { stream: true });
        if (buffer.includes('event: card-content-change')) return buffer;
      }
    })();

    writeFileSync(join(workspace, '.blueprinttool', 'cards', 'specs', 'card-a.md'), 'Direct file edit.');
    const eventText = await eventPromise;
    assert.match(eventText, /"contentFile":"\.blueprinttool\/cards\/specs\/card-a\.md"/);
  } finally {
    controller.abort();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});
