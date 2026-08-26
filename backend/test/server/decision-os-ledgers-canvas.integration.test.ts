import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';

async function startWorkspace(): Promise<{ baseUrl: string; server: Server; workspace: string; restore: () => void }> {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-ledgers-canvas-'));
  mkdirSync(join(workspace, '.decision-os', 'cards', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'threads', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'shared'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }));
  writeFileSync(join(workspace, '.decision-os', 'shared', 'asset.png'), 'png');
  writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), '![Asset](.decision-os/shared/asset.png)');
  writeFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), '# OPERATOR\n\nThread note.');
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    modelName: 'specs',
    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/specs/card-a.md' }, x: 10, y: 20, w: 240 }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-a': '.decision-os/threads/specs/thread-card-a.md' }
  }));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  process.chdir(originalCwd);
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    workspace,
    restore: () => process.chdir(originalCwd)
  };
}

test('ledgers canvas migrates tabs to ledgers and persists overview edits', async () => {
  const { baseUrl, server, workspace, restore } = await startWorkspace();
  try {
    const response = await fetch(`${baseUrl}/decision-os/ledgers-canvas`);
    assert.equal(response.ok, true);
    const overview = await response.json() as { viewport: { scale: number }; cards: Array<Record<string, unknown>> };
    assert.equal(overview.viewport.scale, 0.42);
    assert.equal(overview.cards[0].id, 'ledger-card:specs');
    assert.equal(overview.cards[0].targetLedgerId, 'specs');

    const state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { tabs?: unknown; ledgers: Array<Record<string, unknown>> };
    assert.equal(state.tabs, undefined);
    assert.equal(state.ledgers[0].cardId, 'ledger-card:specs');

    const zoneResponse = await fetch(`${baseUrl}/decision-os/ledgers-canvas`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-zone', annotation: { id: 'zone-parent', label: 'Parent', variant: 'zone', x: 1, y: 2, width: 300, height: 200 } })
    });
    assert.equal(zoneResponse.ok, true);
    const persistedOverview = JSON.parse(readFileSync(join(workspace, '.decision-os', 'ledgers-canvas.json'), 'utf8')) as { annotations: Array<Record<string, unknown>> };
    assert.equal(persistedOverview.annotations.some((entry) => entry.id === 'zone-parent'), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restore();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('ledgers canvas card creation, rename, and hard delete own ledger lifecycle', async () => {
  const { baseUrl, server, workspace, restore } = await startWorkspace();
  try {
    const createResponse = await fetch(`${baseUrl}/decision-os/ledgers-canvas`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-card', card: { id: 'draft-card', title: 'Design Notes', x: 40, y: 50, w: 360, h: 180 } })
    });
    assert.equal(createResponse.ok, true);
    let state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { ledgers: Array<Record<string, unknown>> };
    assert.equal(state.ledgers.some((entry) => entry.id === 'design-notes' && entry.cardId === 'ledger-card:design-notes'), true);
    assert.equal(existsSync(join(workspace, '.decision-os', 'design-notes.json')), true);

    const renameResponse = await fetch(`${baseUrl}/decision-os/ledgers-canvas`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'ledger-card:specs', title: 'Renamed Specs' } })
    });
    assert.equal(renameResponse.ok, true);
    state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { ledgers: Array<Record<string, unknown>> };
    assert.equal(state.ledgers.some((entry) => entry.id === 'renamed-specs' && entry.ledgerFile === '.decision-os/renamed-specs.json'), true);
    assert.equal(existsSync(join(workspace, '.decision-os', 'renamed-specs.json')), true);
    assert.equal(existsSync(join(workspace, '.decision-os', 'cards', 'renamed-specs')), true);
    const renamedLedger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'renamed-specs.json'), 'utf8')) as { cards: Array<{ comment: { contentFile: string } }>; threadFiles: Record<string, string> };
    assert.equal(renamedLedger.cards[0].comment.contentFile, '.decision-os/cards/renamed-specs/card-a.md');
    assert.equal(renamedLedger.threadFiles['thread-card-a'], '.decision-os/threads/renamed-specs/thread-card-a.md');

    const deleteResponse = await fetch(`${baseUrl}/decision-os/ledgers-canvas`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete-card', cardId: 'ledger-card:renamed-specs' })
    });
    assert.equal(deleteResponse.ok, true);
    state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { ledgers: Array<Record<string, unknown>> };
    assert.equal(state.ledgers.some((entry) => entry.id === 'renamed-specs'), false);
    assert.equal(existsSync(join(workspace, '.decision-os', 'renamed-specs.json')), false);
    assert.equal(existsSync(join(workspace, '.decision-os', 'cards', 'renamed-specs')), false);
    assert.equal(existsSync(join(workspace, '.decision-os', 'threads', 'renamed-specs')), false);
    assert.equal(existsSync(join(workspace, '.decision-os', 'shared', 'asset.png')), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restore();
    rmSync(workspace, { recursive: true, force: true });
  }
});
