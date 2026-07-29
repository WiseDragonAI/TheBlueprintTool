/**
 * WHAT: Serves current checkout frontend assets and authored-editor modules from an isolated port.
 * WHY: A dev launcher must not inherit another checkout's frontend root.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpServer } from '../../src/business/server/application/create-decision-os-server.js';

test('isolated server exposes the current checkout content-authoring module and application asset', async () => {
  const catalogRoot = mkdtempSync(join(tmpdir(), 'decision-os-current-frontend-'));
  const decisionOsRoot = join(catalogRoot, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: catalogRoot,
      decisionOsFrontendRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../../../frontend'),
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const [moduleResponse, assetResponse] = await Promise.all([
      fetch(`${baseUrl}/src/runtime/content-authoring/controller/ledger-card-editor.js`),
      fetch(`${baseUrl}/assets/application.css`),
    ]);
    assert.equal(moduleResponse.status, 200);
    assert.match(await moduleResponse.text(), /openLedgerCardEditor/);
    assert.equal(assetResponse.status, 200);
    assert.match(await assetResponse.text(), /--control-bg-primary:/);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(catalogRoot, { recursive: true, force: true });
  }
});
