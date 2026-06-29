import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

async function startContentFileServer(): Promise<{ endpoint: string; eventsEndpoint: string; server: Server; workspace: string }> {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-content-file-'));
  mkdirSync(join(workspace, '.decision-os', 'cards', 'specs'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }));
  writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'Content file body.');
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/specs/card-a.md' }, x: 10, y: 20, w: 240 }],
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
    endpoint: `http://127.0.0.1:${address.port}/decision-os/specs`,
    eventsEndpoint: `http://127.0.0.1:${address.port}/api/ledger-content-events`,
    server,
    workspace,
  };
}

test('decision-os server hydrates card Markdown content files and keeps JSON lean on edit', async () => {
  const { endpoint, server, workspace } = await startContentFileServer();

  try {
    const loaded = await (await fetch(endpoint)).json() as { cards: Array<Record<string, any>> };
    assert.equal(loaded.cards[0].comment.what, 'Content file body.');

    const patchResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'card-a', description: 'Edited body.' } }),
    });
    assert.equal(patchResponse.ok, true);
    const patched = await patchResponse.json() as { cards: Array<Record<string, any>> };
    assert.equal(patched.cards[0].comment.what, 'Edited body.');

    const persisted = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<Record<string, any>> };
    assert.equal(persisted.cards[0].comment.what, undefined);
    assert.equal(persisted.cards[0].comment.contentFile, '.decision-os/cards/specs/card-a.md');
    assert.equal(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'utf8'), 'Edited body.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os server creates card and thread Markdown content files for new cards', async () => {
  const { endpoint, server, workspace } = await startContentFileServer();

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create-card',
        card: { id: 'card-new', title: 'New card', x: 30, y: 40, w: 260, h: 132 },
      }),
    });
    assert.equal(createResponse.ok, true);
    const created = await createResponse.json() as { cards: Array<Record<string, any>>; threadFiles: Record<string, string> };
    const createdCard = created.cards.find((card) => card.id === 'card-new');
    assert.equal(createdCard?.comment.contentFile, '.decision-os/cards/specs/card-new.md');
    assert.equal(created.threadFiles['thread-card-new'], '.decision-os/threads/specs/thread-card-new.md');

    const persisted = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
      cards: Array<Record<string, any>>;
      notes: Record<string, unknown>;
      threadFiles: Record<string, string>;
    };
    const persistedCard = persisted.cards.find((card) => card.id === 'card-new');
    assert.equal(persistedCard?.comment.contentFile, '.decision-os/cards/specs/card-new.md');
    assert.equal(persistedCard?.comment.what, undefined);
    assert.equal(persisted.threadFiles['thread-card-new'], '.decision-os/threads/specs/thread-card-new.md');
    assert.equal(persisted.notes['thread-card-new'], undefined);
    assert.equal(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-new.md'), 'utf8'), '');
    assert.equal(readFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-new.md'), 'utf8'), '\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os server deletes a card markdown image and its workspace asset', async () => {
  const { endpoint, server, workspace } = await startContentFileServer();
  const imageSource = '.decision-os/ui/carousel-delete.png';
  const imageFile = join(workspace, '.decision-os', 'ui', 'carousel-delete.png');

  try {
    mkdirSync(join(workspace, '.decision-os', 'ui'), { recursive: true });
    writeFileSync(imageFile, 'png');
    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), [
      'Before',
      `![Delete](${imageSource})`,
      '![Keep](.decision-os/ui/carousel-keep.png)',
      'After',
    ].join('\n'));

    const deleteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-card-image', cardId: 'card-a', imageSrc: `/${imageSource}` }),
    });
    assert.equal(deleteResponse.ok, true);
    const patched = await deleteResponse.json() as { cards: Array<Record<string, any>> };
    assert.doesNotMatch(patched.cards[0].comment.what, /carousel-delete\.png/);
    assert.match(patched.cards[0].comment.what, /carousel-keep\.png/);
    assert.equal(existsSync(imageFile), false);
    assert.doesNotMatch(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'utf8'), /carousel-delete\.png/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os server serves ledger-scoped html embed assets and rejects script html', async () => {
  const { server, workspace } = await startContentFileServer();
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    mkdirSync(join(workspace, '.decision-os', 'cards', 'specs', 'assets'), { recursive: true });
    mkdirSync(join(workspace, '.decision-os', '.scripts'), { recursive: true });
    mkdirSync(join(workspace, '.decision-os', 'cards', 'removed', 'assets'), { recursive: true });
    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'assets', 'preview.html'), '<!doctype html><title>Preview</title>');
    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'assets', 'preview.mjs'), 'export default 1;');
    writeFileSync(join(workspace, '.decision-os', '.scripts', 'tool.html'), '<!doctype html><title>Tool</title>');
    writeFileSync(join(workspace, '.decision-os', 'cards', 'removed', 'assets', 'orphan.html'), '<!doctype html><title>Removed</title>');

    const htmlResponse = await fetch(`${baseUrl}/.decision-os/cards/specs/assets/preview.html`);
    assert.equal(htmlResponse.ok, true);
    assert.equal(htmlResponse.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(await htmlResponse.text(), /Preview/);

    const moduleResponse = await fetch(`${baseUrl}/.decision-os/cards/specs/assets/preview.mjs`);
    assert.equal(moduleResponse.ok, true);
    assert.equal(moduleResponse.headers.get('content-type'), 'text/javascript; charset=utf-8');

    const scriptHtmlResponse = await fetch(`${baseUrl}/.decision-os/.scripts/tool.html`);
    assert.equal(scriptHtmlResponse.status, 404);

    const rootHtmlResponse = await fetch(`${baseUrl}/.decision-os/preview.html`);
    assert.equal(rootHtmlResponse.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os server rejects image deletion when the source is not present in markdown', async () => {
  const { endpoint, server, workspace } = await startContentFileServer();
  const imageFile = join(workspace, '.decision-os', 'ui', 'missing-from-markdown.png');

  try {
    mkdirSync(join(workspace, '.decision-os', 'ui'), { recursive: true });
    writeFileSync(imageFile, 'png');
    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), '![Keep](.decision-os/ui/keep.png)');

    const deleteResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-card-image', cardId: 'card-a', imageSrc: '.decision-os/ui/missing-from-markdown.png' }),
    });

    assert.equal(deleteResponse.status, 404);
    assert.equal(existsSync(imageFile), true);
    assert.match(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'utf8'), /keep\.png/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os server emits card content change events for direct markdown edits', async () => {
  const { eventsEndpoint, server, workspace } = await startContentFileServer();
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

    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'Direct file edit.');
    const eventText = await eventPromise;
    assert.match(eventText, /"contentFile":"\.decision-os\/cards\/specs\/card-a\.md"/);
  } finally {
    controller.abort();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});
