import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

function createProject(root: string, path: string, title: string): void {
  const directory = join(root, path, '.decision-os');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title, ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(join(directory, 'specs.json'), JSON.stringify({ cards: [{ id: `${title}-card`, title }], annotations: [], relationships: [] }));
}

test('home-scoped server catalogs nested projects and isolates project ledger requests', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-master-home-'));
  createProject(home, 'admin', 'Admin Specs');
  createProject(home, 'dev/project-a', 'Project A Specs');
  createProject(home, 'dev/project-b', 'Project B Specs');
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const catalogResponse = await fetch(`${baseUrl}/decision-os/projects`);
    const catalog = await catalogResponse.json() as { projects: Array<{ id: string; name: string; relativePath: string }> };
    assert.deepEqual(catalog.projects.map((project) => project.relativePath), ['admin', 'dev/project-a', 'dev/project-b']);
    assert.deepEqual(catalog.projects.map((project) => project.name), ['admin', 'project-a', 'project-b']);

    const projectA = catalog.projects.find((project) => project.name === 'project-a')!;
    const ledgerResponse = await fetch(`${baseUrl}/decision-os/specs`, { headers: { 'x-decision-os-project': projectA.id } });
    const ledger = await ledgerResponse.json() as { cards: Array<{ title: string }> };
    assert.equal(ledger.cards[0].title, 'Project A Specs');

    const invalid = await fetch(`${baseUrl}/decision-os/specs`, { headers: { 'x-decision-os-project': 'invalid' } });
    assert.equal(invalid.status, 404);

    const color = await fetch(`${baseUrl}/decision-os/projects/${projectA.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ color: '#123456' })
    });
    assert.equal(color.ok, true);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});
