/**
 * WHAT: Integration coverage for scoped content-file events and per-ledger revision ordering.
 * WHY: Backend ownership and revision contracts must remain deterministic across multiple ledgers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { TaskContentMaterializationError } from '@backend/business/federation/helper/materialize-task-mutation-inputs.js';

type ContentChangeEvent = {
  contentFile: string;
  file: string;
  kind: 'card-content' | 'thread-content';
  ledgerId: string;
  threadId?: string;
  invalidationRevision: number;
};

async function readNextContentChange(response: Response): Promise<ContentChangeEvent> {
  const reader = response.body?.getReader();
  assert.ok(reader);
  const decoder = new TextDecoder();
  let buffer = '';
  let timeout: NodeJS.Timeout | undefined;
  const event = (async () => {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) assert.fail('SSE connection closed before a card content event arrived.');
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n?/g, '\n');
      for (;;) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary < 0) break;
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split('\n');
        if (!lines.includes('event: card-content-change')) continue;
        const data = lines.filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');
        return JSON.parse(data) as ContentChangeEvent;
      }
    }
  })();
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out waiting for card-content-change SSE. Frames: ${buffer}`)), 3000);
  });
  try {
    return await Promise.race([event, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
    reader.releaseLock();
  }
}

async function collectContentChangesUntilAbort(response: Response): Promise<ContentChangeEvent[]> {
  const reader = response.body?.getReader();
  assert.ok(reader);
  const decoder = new TextDecoder();
  const events: ContentChangeEvent[] = [];
  let buffer = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return events;
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n?/g, '\n');
      for (;;) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary < 0) break;
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split('\n');
        if (!lines.includes('event: card-content-change')) continue;
        const data = lines.filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');
        events.push(JSON.parse(data) as ContentChangeEvent);
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return events;
    throw error;
  }
}

function ledgerRevision(response: Response): number {
  const value = response.headers.get('x-decision-os-ledger-revision');
  assert.match(String(value), /^\d+$/);
  return Number(value);
}

async function startContentFileServer(): Promise<{ endpoint: string; archiveEndpoint: string; eventsEndpoint: string; server: Server; workspace: string }> {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-content-file-'));
  mkdirSync(join(workspace, '.decision-os', 'cards', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'cards', 'archive'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'threads', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'threads', 'archive'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    tabs: [
      { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
      { id: 'archive', title: 'Archive', ledgerFile: '.decision-os/archive.json' },
    ]
  }));
  writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'Content file body.');
  writeFileSync(join(workspace, '.decision-os', 'cards', 'archive', 'card-z.md'), 'Archived card body.');
  writeFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), '\n');
  writeFileSync(join(workspace, '.decision-os', 'threads', 'archive', 'thread-card-z.md'), 'Archived thread body.');
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/specs/card-a.md' }, x: 10, y: 20, w: 240 }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-a': '.decision-os/threads/specs/thread-card-a.md' }
  }));
  writeFileSync(join(workspace, '.decision-os', 'archive.json'), JSON.stringify({
    cards: [{ id: 'card-z', title: 'Card Z', comment: { contentFile: '.decision-os/cards/archive/card-z.md' }, x: 10, y: 20, w: 240 }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-z': '.decision-os/threads/archive/thread-card-z.md' }
  }));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  process.chdir(originalCwd);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    endpoint: `${baseUrl}/decision-os/specs`,
    archiveEndpoint: `${baseUrl}/decision-os/archive`,
    eventsEndpoint: `${baseUrl}/api/ledger-content-events`,
    server,
    workspace,
  };
}

async function startTaskContentFileServer(): Promise<{ endpoint: string; eventsEndpoint: string; server: Server; workspace: string }> {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-task-content-file-'));
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(workspace, '.decision-os', 'tasks.json'), JSON.stringify({
    cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));
  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  process.chdir(originalCwd);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    endpoint: `${baseUrl}/decision-os/tasks`,
    eventsEndpoint: `${baseUrl}/api/ledger-content-events`,
    server,
    workspace,
  };
}

async function restartTaskContentFileServer(workspace: string): Promise<{ endpoint: string; eventsEndpoint: string; runtime: Record<string, unknown>; server: Server }> {
  const originalCwd = process.cwd();
  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  process.chdir(originalCwd);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { endpoint: `${baseUrl}/decision-os/tasks`, eventsEndpoint: `${baseUrl}/api/ledger-content-events`, runtime, server };
}

test('decision-os server orders ledger GET and mutation responses with monotonic revisions', async () => {
  const { endpoint, server, workspace } = await startContentFileServer();

  try {
    const initialResponse = await fetch(endpoint);
    assert.equal(initialResponse.ok, true);
    const initialRevision = ledgerRevision(initialResponse);
    await initialResponse.json();

    const mutationResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-viewport', viewport: { x: 12, y: 34, scale: 1.25 } }),
    });
    assert.equal(mutationResponse.ok, true);
    const mutationRevision = ledgerRevision(mutationResponse);
    await mutationResponse.json();
    assert.ok(mutationRevision > initialRevision);

    const laterResponse = await fetch(endpoint);
    assert.equal(laterResponse.ok, true);
    assert.equal(ledgerRevision(laterResponse), mutationRevision);
    await laterResponse.json();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

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
    const patched = await patchResponse.json() as { changedCard: Record<string, any> };
    assert.equal(patched.changedCard.comment.what, 'Edited body.');

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
    const created = await createResponse.json() as { changedCard: Record<string, any>; changedThread: { threadId: string; contentFile: string } };
    const createdCard = created.changedCard;
    assert.equal(createdCard?.comment.contentFile, '.decision-os/cards/specs/card-new.md');
    assert.equal(created.changedThread.threadId, 'thread-card-new');
    assert.equal(created.changedThread.contentFile, '.decision-os/threads/specs/thread-card-new.md');

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
    const patched = await deleteResponse.json() as { changedCard: Record<string, any> };
    assert.doesNotMatch(patched.changedCard.comment.what, /carousel-delete\.png/);
    assert.match(patched.changedCard.comment.what, /carousel-keep\.png/);
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
    const eventPromise = readNextContentChange(response);

    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'Direct file edit.');
    const event = await eventPromise;
    assert.equal(event.kind, 'card-content');
    assert.equal(event.ledgerId, 'specs');
    assert.equal(event.threadId, undefined);
    assert.equal(event.contentFile, '.decision-os/cards/specs/card-a.md');
    assert.ok(event.invalidationRevision > 0);
  } finally {
    controller.abort();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('direct task Markdown edit commits before SSE and survives a fresh HTTP reload exactly', async () => {
  const started = await startTaskContentFileServer();
  let { endpoint, eventsEndpoint, server } = started;
  let activeRuntime: Record<string, unknown> = {};
  const { workspace } = started;
  const controller = new AbortController();

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-card', card: { id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 132 } }),
    });
    assert.equal(createResponse.ok, true);
    await createResponse.json();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    ({ endpoint, eventsEndpoint, runtime: activeRuntime, server } = await restartTaskContentFileServer(workspace));
    assert.equal((await fetch(endpoint)).ok, true);
    assert.equal(await Promise.resolve(activeRuntime.taskContentReady), true);
    const taskState = activeRuntime.taskExecutionState as { store: { contentHeads: (key: string) => Array<{ hash: string }> } };
    const initialHash = taskState.store.contentHeads('.decision-os/cards/tasks/card-a.md')[0]?.hash;
    const initialFlush = activeRuntime.flushTaskContentFile;
    eventsEndpoint = new URL(`/p/${encodeURIComponent(String(activeRuntime.projectId))}/api/ledger-content-events`, endpoint).toString();
    const eventsResponse = await fetch(eventsEndpoint, { signal: controller.signal });
    assert.equal(eventsResponse.ok, true);
    const eventPromise = readNextContentChange(eventsResponse);
    const edited = 'Exact external task edit.\n';

    writeFileSync(join(workspace, '.decision-os', 'cards', 'tasks', 'card-a.md'), edited);
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    const observedHash = taskState.store.contentHeads('.decision-os/cards/tasks/card-a.md')[0]?.hash;
    assert.notEqual(observedHash, initialHash, `head remained ${String(initialHash)}`);
    assert.equal(activeRuntime.flushTaskContentFile, initialFlush, 'project content runtime was replaced');
    const event = await eventPromise;
    assert.equal(event.ledgerId, 'tasks');
    assert.equal(event.contentFile, '.decision-os/cards/tasks/card-a.md');
    const reloaded = await (await fetch(endpoint)).json() as { cards: Array<Record<string, any>> };
    assert.equal(reloaded.cards.find((card) => card.id === 'card-a')?.comment.what, edited);
  } finally {
    controller.abort();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('direct thread edit followed immediately by HTTP append preserves both notes', async () => {
  const started = await startTaskContentFileServer();
  let { endpoint, server } = started;
  const { workspace } = started;

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-card', card: { id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 132 } }),
    });
    assert.equal(createResponse.ok, true);
    await createResponse.json();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    ({ endpoint, server } = await restartTaskContentFileServer(workspace));
    const threadFile = join(workspace, '.decision-os', 'threads', 'tasks', 'thread-card-a.md');
    const external = '# OPERATOR\n<!-- decision-os:note {"id":"note-external"} -->\n\nExternal question.\n';
    writeFileSync(threadFile, external);

    const appendResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'append-note',
        note: { id: 'note-http', threadId: 'thread-card-a', role: 'agent', body: 'HTTP answer.' },
      }),
    });
    assert.equal(appendResponse.ok, true, await appendResponse.text());
    const finalBody = readFileSync(threadFile, 'utf8');
    assert.match(finalBody, /External question\./);
    assert.match(finalBody, /HTTP answer\./);
    const threadEndpoint = new URL('/api/ledgers/tasks/threads/thread-card-a', endpoint);
    const reloaded = await (await fetch(threadEndpoint)).json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.deepEqual(
      reloaded.notes['thread-card-a'].map((note) => note.id),
      ['note-external', 'note-http'],
      finalBody,
    );
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('pre-start thread edit reconciles before the first task append', async () => {
  const started = await startTaskContentFileServer();
  let { endpoint, server } = started;
  const { workspace } = started;

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-card', card: { id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 132 } }),
    });
    assert.equal(createResponse.ok, true);
    await createResponse.json();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    const threadFile = join(workspace, '.decision-os', 'threads', 'tasks', 'thread-card-a.md');
    writeFileSync(threadFile, '# OPERATOR\n<!-- decision-os:note {"id":"note-offline"} -->\n\nOffline edit.\n');
    ({ endpoint, server } = await restartTaskContentFileServer(workspace));

    const appendResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'append-note',
        note: { id: 'note-first-write', threadId: 'thread-card-a', role: 'agent', body: 'First online write.' },
      }),
    });
    assert.equal(appendResponse.ok, true, await appendResponse.text());
    const finalBody = readFileSync(threadFile, 'utf8');
    assert.match(finalBody, /Offline edit\./);
    assert.match(finalBody, /First online write\./);
    const threadEndpoint = new URL('/api/ledgers/tasks/threads/thread-card-a', endpoint);
    const reloaded = await (await fetch(threadEndpoint)).json() as { notes: Record<string, Array<Record<string, unknown>>> };
    assert.deepEqual(reloaded.notes['thread-card-a'].map((note) => note.id), ['note-offline', 'note-first-write']);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('one canonical task HTTP mutation emits exactly one committed content event', async () => {
  const started = await startTaskContentFileServer();
  let { endpoint, server } = started;
  let runtime: Record<string, unknown> = {};
  const { workspace } = started;
  const controller = new AbortController();

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-card', card: { id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 132 } }),
    });
    assert.equal(createResponse.ok, true);
    await createResponse.json();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    ({ endpoint, runtime, server } = await restartTaskContentFileServer(workspace));
    assert.equal((await fetch(endpoint)).ok, true);
    assert.equal(await Promise.resolve(runtime.taskContentReady), true);
    const eventsEndpoint = new URL(`/p/${encodeURIComponent(String(runtime.projectId))}/api/ledger-content-events`, endpoint);
    const eventsResponse = await fetch(eventsEndpoint, { signal: controller.signal });
    const collecting = collectContentChangesUntilAbort(eventsResponse);

    const appendResponse = await fetch(endpoint, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note: { id: 'note-http', threadId: 'thread-card-a', role: 'agent', body: 'One mutation.' } }),
    });
    assert.equal(appendResponse.ok, true, await appendResponse.text());
    await new Promise((resolveWait) => setTimeout(resolveWait, 800));
    controller.abort();
    const events = await collecting;
    assert.equal(events.length, 1);
    assert.equal(events[0].ledgerId, 'tasks');
    assert.equal(events[0].contentFile, '.decision-os/threads/tasks/thread-card-a.md');
  } finally {
    controller.abort();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('local mismatch without an observed pending watcher edit remains a 409', async () => {
  const started = await startTaskContentFileServer();
  let { endpoint, server } = started;
  let runtime: Record<string, unknown> = {};
  let serverClosed = false;
  const { workspace } = started;

  try {
    const createResponse = await fetch(endpoint, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-card', card: { id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 132 } }),
    });
    assert.equal(createResponse.ok, true);
    await createResponse.json();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    ({ endpoint, runtime, server } = await restartTaskContentFileServer(workspace));
    assert.equal((await fetch(endpoint)).ok, true);
    assert.equal(await Promise.resolve(runtime.taskContentReady), true);
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    serverClosed = true;
    const threadFile = join(workspace, '.decision-os', 'threads', 'tasks', 'thread-card-a.md');
    const stale = '# OPERATOR\n<!-- decision-os:note {"id":"note-stale"} -->\n\nUnobserved edit.\n';
    writeFileSync(threadFile, stale);
    const persist = runtime.persistTaskLedgerMutation as (mutation: Record<string, unknown>) => Promise<unknown>;

    await assert.rejects(persist({
      action: 'append-note',
      note: { id: 'note-rejected', threadId: 'thread-card-a', role: 'agent', body: 'Must not append.' },
    }), (error: unknown) => (
      error instanceof TaskContentMaterializationError
      && error.statusCode === 409
      && error.code === 'task_content_local_mismatch'
    ));
    assert.equal(readFileSync(threadFile, 'utf8'), stale);
  } finally {
    // WHAT: Close only the server instance that the proof did not already stop to remove watcher ownership.
    // WHY: The mismatch setup requires a settled closed watcher before invoking the retained runtime directly.
    if (!serverClosed) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os server scopes inactive-ledger thread events and advances only their ledger revision', async () => {
  const { endpoint, archiveEndpoint, eventsEndpoint, server, workspace } = await startContentFileServer();
  const controller = new AbortController();

  try {
    const initialActiveResponse = await fetch(endpoint);
    assert.equal(initialActiveResponse.ok, true);
    const initialActiveRevision = ledgerRevision(initialActiveResponse);
    await initialActiveResponse.json();
    const initialArchiveResponse = await fetch(archiveEndpoint);
    assert.equal(initialArchiveResponse.ok, true);
    const initialArchiveRevision = ledgerRevision(initialArchiveResponse);
    await initialArchiveResponse.json();

    const eventsResponse = await fetch(eventsEndpoint, { signal: controller.signal });
    assert.equal(eventsResponse.ok, true);
    const eventPromise = readNextContentChange(eventsResponse);
    writeFileSync(join(workspace, '.decision-os', 'threads', 'archive', 'thread-card-z.md'), 'Inactive ledger thread edit.');

    const event = await eventPromise;
    assert.equal(event.kind, 'thread-content');
    assert.equal(event.ledgerId, 'archive');
    assert.equal(event.threadId, 'thread-card-z');
    assert.equal(event.contentFile, '.decision-os/threads/archive/thread-card-z.md');
    assert.ok(event.invalidationRevision > initialArchiveRevision);

    const laterArchiveResponse = await fetch(archiveEndpoint);
    assert.equal(laterArchiveResponse.ok, true);
    assert.equal(ledgerRevision(laterArchiveResponse), event.invalidationRevision);
    await laterArchiveResponse.json();
    const laterActiveResponse = await fetch(endpoint);
    assert.equal(laterActiveResponse.ok, true);
    assert.equal(ledgerRevision(laterActiveResponse), initialActiveRevision);
    await laterActiveResponse.json();
  } finally {
    controller.abort();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(workspace, { recursive: true, force: true });
  }
});
