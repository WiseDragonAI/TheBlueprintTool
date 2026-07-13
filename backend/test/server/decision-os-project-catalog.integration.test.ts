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
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(process.cwd(), 'frontend-mobile') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const catalogResponse = await fetch(`${baseUrl}/decision-os/projects`);
    const catalog = await catalogResponse.json() as { projects: Array<{ id: string; name: string; description: string; color: string; relativePath: string; root: string }> };
    assert.deepEqual(catalog.projects.map((project) => project.relativePath), ['admin', 'dev/project-a', 'dev/project-b']);
    assert.deepEqual(catalog.projects.map((project) => project.name), ['admin', 'project-a', 'project-b']);

    const projectPage = await fetch(`${baseUrl}/projects/${encodeURIComponent(catalog.projects[0].id)}`);
    assert.equal(projectPage.status, 200);
    assert.match(projectPage.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await projectPage.text(), /id="project-detail-view"/);

    const projectA = catalog.projects.find((project) => project.name === 'project-a')!;
    const ledgerResponse = await fetch(`${baseUrl}/decision-os/specs`, { headers: { 'x-decision-os-project': projectA.id } });
    const ledger = await ledgerResponse.json() as { cards: Array<{ title: string }> };
    assert.equal(ledger.cards[0].title, 'Project A Specs');

    const invalid = await fetch(`${baseUrl}/decision-os/specs`, { headers: { 'x-decision-os-project': 'invalid' } });
    assert.equal(invalid.status, 404);

    const staleCookie = await fetch(`${baseUrl}/decision-os/specs`, { headers: { cookie: 'decision-os-project=old-root-id' } });
    assert.equal(staleCookie.status, 200);
    assert.match(staleCookie.headers.get('set-cookie') ?? '', new RegExp(`decision-os-project=${catalog.projects[0].id}`));
    const fallbackLedger = await staleCookie.json() as { cards: Array<{ title: string }> };
    assert.equal(fallbackLedger.cards[0].title, 'Admin Specs');

    const identity = { id: projectA.id, relativePath: projectA.relativePath, root: projectA.root };
    const update = await fetch(`${baseUrl}/decision-os/projects/${projectA.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Project Alpha', description: 'Primary workspace', color: '#123456' })
    });
    assert.equal(update.ok, true);
    const updated = await update.json() as { project: typeof projectA };
    assert.deepEqual({ id: updated.project.id, relativePath: updated.project.relativePath, root: updated.project.root }, identity);
    assert.deepEqual({ name: updated.project.name, description: updated.project.description, color: updated.project.color }, { name: 'Project Alpha', description: 'Primary workspace', color: '#123456' });

    const reloaded = await fetch(`${baseUrl}/decision-os/projects`).then((response) => response.json()) as { projects: typeof catalog.projects };
    assert.deepEqual(
      reloaded.projects.find((project) => project.id === projectA.id),
      { ...projectA, name: 'Project Alpha', description: 'Primary workspace', color: '#123456' },
    );

    const rejected = await fetch(`${baseUrl}/decision-os/projects/${projectA.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '', description: 'Changed', color: '#654321' })
    });
    assert.equal(rejected.status, 400);
    const afterRejection = await fetch(`${baseUrl}/decision-os/projects`).then((response) => response.json()) as { projects: typeof catalog.projects };
    assert.deepEqual(
      afterRejection.projects.find((project) => project.id === projectA.id),
      { ...projectA, name: 'Project Alpha', description: 'Primary workspace', color: '#123456' },
    );
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});
