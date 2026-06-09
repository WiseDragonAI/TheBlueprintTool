import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('blueprinttool ledger create endpoint writes a ledger and appends a tab', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-ledger-create-'));
  mkdirSync(join(workspace, '.blueprinttool'));
  writeFileSync(join(workspace, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }]
  }));
  writeFileSync(join(workspace, '.blueprinttool', 'specs.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {} }));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/blueprinttool/ledgers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Design Notes' })
    });
    assert.equal(response.status, 201);
    const body = await response.json() as { tab: { id: string; ledgerFile: string }; ledger: { cards: unknown[] } };
    assert.equal(body.tab.id, 'design-notes');
    assert.equal(body.tab.ledgerFile, '.blueprinttool/design-notes.json');
    assert.deepEqual(body.ledger.cards, []);
    assert.equal(existsSync(join(workspace, '.blueprinttool', 'design-notes.json')), true);

    const state = JSON.parse(readFileSync(join(workspace, '.blueprinttool', 'state.json'), 'utf8')) as { tabs: Array<{ id: string }> };
    assert.equal(state.tabs.some((tab) => tab.id === 'design-notes'), true);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});
