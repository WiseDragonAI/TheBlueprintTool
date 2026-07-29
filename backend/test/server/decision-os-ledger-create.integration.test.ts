import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';

test('decision-os ledger create endpoint writes a ledger and appends a tab', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-ledger-create-'));
  mkdirSync(join(workspace, '.decision-os'));
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {} }));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/decision-os/ledgers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Design Notes' })
    });
    assert.equal(response.status, 201);
    const body = await response.json() as { tab: { id: string; ledgerFile: string; cardId: string }; ledger: { cards: unknown[] }; state: { ledgers: Array<{ id: string }> } };
    assert.equal(body.tab.id, 'design-notes');
    assert.equal(body.tab.ledgerFile, '.decision-os/design-notes.json');
    assert.equal(body.tab.cardId, 'ledger-card:design-notes');
    assert.deepEqual(body.ledger.cards, []);
    assert.equal(existsSync(join(workspace, '.decision-os', 'design-notes.json')), true);

    const stateResponse = await fetch(`http://127.0.0.1:${address.port}/decision-os/state`);
    assert.equal(stateResponse.ok, true);
    const stateBody = await stateResponse.json() as { projectName: string; ledgers: Array<{ id: string }> };
    assert.equal(stateBody.projectName, workspace.split('/').at(-1));
    assert.equal(stateBody.ledgers.some((ledger) => ledger.id === 'design-notes'), true);

    const state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { tabs?: unknown; ledgers: Array<{ id: string }> };
    assert.equal(state.tabs, undefined);
    assert.equal(state.ledgers.some((ledger) => ledger.id === 'design-notes'), true);
    assert.equal(body.state.ledgers.some((ledger) => ledger.id === 'design-notes'), true);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
