import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend-mobile') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const catalogResponse = await fetch(`${baseUrl}/decision-os/projects`);
    const catalog = await catalogResponse.json() as { projects: Array<{ id: string; name: string; description: string; color: string; relativePath: string; root: string }> };
    assert.deepEqual(catalog.projects.map((project) => project.relativePath), ['admin', 'dev/project-a', 'dev/project-b']);
    assert.deepEqual(catalog.projects.map((project) => project.name), ['admin', 'project-a', 'project-b']);

    const creation = await fetch(`${baseUrl}/decision-os/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Project Gamma', description: 'Created from the catalog' })
    });
    assert.equal(creation.status, 201);
    const created = await creation.json() as { project: { id: string; name: string; description: string; relativePath: string; ledgers: Array<{ id: string; title: string; ledgerFile: string }> } };
    assert.deepEqual(
      { name: created.project.name, description: created.project.description, relativePath: created.project.relativePath },
      { name: 'Project Gamma', description: 'Created from the catalog', relativePath: 'Project Gamma' },
    );
    assert.deepEqual(created.project.ledgers, [{ id: 'tasks', title: 'tasks', ledgerFile: '.decision-os/tasks.json' }]);
    assert.deepEqual(JSON.parse(readFileSync(join(home, 'Project Gamma', '.decision-os', 'state.json'), 'utf8')), {
      ledgers: [{ id: 'tasks', title: 'tasks', ledgerFile: '.decision-os/tasks.json', cardId: 'ledger-card:tasks' }],
    });
    const createdTasks = JSON.parse(readFileSync(join(home, 'Project Gamma', '.decision-os', 'tasks.json'), 'utf8')) as { modelName: string; cards: unknown[] };
    assert.equal(createdTasks.modelName, 'tasks');
    assert.deepEqual(createdTasks.cards, []);
    const refreshedCatalog = await fetch(`${baseUrl}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string }> };
    assert.ok(refreshedCatalog.projects.some((project) => project.id === created.project.id));

    const collision = await fetch(`${baseUrl}/decision-os/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Project Gamma', description: 'Duplicate' })
    });
    assert.equal(collision.status, 400);
    assert.match(await collision.text(), /already exists/);
    const unsafe = await fetch(`${baseUrl}/decision-os/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '../escape' })
    });
    assert.equal(unsafe.status, 400);
    assert.equal(existsSync(join(home, '..', 'escape')), false);

    const controlRoom = await fetch(`${baseUrl}/`);
    assert.equal(controlRoom.status, 200);
    assert.match(controlRoom.headers.get('content-type') ?? '', /text\/html/);

    const legacyPage = await fetch(`${baseUrl}/p/${catalog.projects[0].id}/projects/${catalog.projects[0].id}`, { redirect: 'manual' });
    assert.equal(legacyPage.status, 302);
    assert.equal(legacyPage.headers.get('location'), `/projects/${catalog.projects[0].id}`);

    const projectPage = await fetch(`${baseUrl}/projects/${encodeURIComponent(catalog.projects[0].id)}`);
    assert.equal(projectPage.status, 200);
    assert.match(projectPage.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await projectPage.text(), /id="project-detail-view"/);

    const projectA = catalog.projects.find((project) => project.name === 'project-a')!;
    const ledgerResponse = await fetch(`${baseUrl}/p/${projectA.id}/decision-os/specs`);
    assert.equal(ledgerResponse.headers.get('x-decision-os-ledger-revision'), '0');
    const ledger = await ledgerResponse.json() as { cards: Array<{ title: string }> };
    assert.equal(ledger.cards[0].title, 'Project A Specs');

    const invalid = await fetch(`${baseUrl}/p/invalid/decision-os/specs`);
    assert.equal(invalid.status, 404);

    const ambiguous = await fetch(`${baseUrl}/decision-os/specs`);
    assert.equal(ambiguous.status, 400);
    assert.match(await ambiguous.text(), /Project id is required in the URL/);

    const ambiguousLegacyLedger = await fetch(`${baseUrl}/specs`, { redirect: 'manual' });
    assert.equal(ambiguousLegacyLedger.status, 409);
    assert.match(await ambiguousLegacyLedger.text(), /Ambiguous legacy ledger URL/);

    const projectB = catalog.projects.find((project) => project.name === 'project-b')!;
    const isolated = await fetch(`${baseUrl}/p/${projectB.id}/decision-os/specs`).then((response) => response.json()) as { cards: Array<{ title: string }> };
    assert.equal(isolated.cards[0].title, 'Project B Specs');
    const mutatedA = await fetch(`${baseUrl}/p/${projectA.id}/decision-os/specs`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'Project A Specs-card', title: 'Mutated A' } })
    });
    assert.equal(mutatedA.ok, true);
    assert.equal(mutatedA.headers.get('x-decision-os-ledger-revision'), '1');
    const unchangedBResponse = await fetch(`${baseUrl}/p/${projectB.id}/decision-os/specs`);
    assert.equal(unchangedBResponse.headers.get('x-decision-os-ledger-revision'), '0');
    const unchangedB = await unchangedBResponse.json() as { cards: Array<{ title: string }> };
    assert.equal(unchangedB.cards[0].title, 'Project B Specs');

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
