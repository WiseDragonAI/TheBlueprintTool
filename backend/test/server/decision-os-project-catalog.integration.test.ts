import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function createProject(root: string, path: string, title: string): void {
  const directory = join(root, path, '.decision-os');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title, ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(join(directory, 'specs.json'), JSON.stringify({ cards: [{ id: `${title}-card`, title }], annotations: [], relationships: [] }));
}

test('home-scoped server catalogs nested projects and isolates project ledger requests', async () => {
  const previousMaxConcurrentProcesses = process.env.CODEX_MAX_CONCURRENT_PROCESSES;
  const previousRepositorySettingsFile = process.env.DECISION_OS_REPOSITORY_SETTINGS_FILE;
  delete process.env.CODEX_MAX_CONCURRENT_PROCESSES;
  delete process.env.DECISION_OS_REPOSITORY_SETTINGS_FILE;
  const home = mkdtempSync(join(tmpdir(), 'decision-os-master-home-'));
  createProject(home, 'admin', 'Admin Specs');
  createProject(home, 'dev/project-a', 'Project A Specs');
  createProject(home, 'dev/project-b', 'Project B Specs');
  mkdirSync(join(home, '.decision-os'), { recursive: true });
  writeFileSync(join(home, '.decision-os', 'codex-pipelines.json'), JSON.stringify({
    version: 1,
    pipelines: [{ id: 'pipeline-complete', name: 'Complete master task', purpose: '', stepIds: [] }],
    steps: [],
    runs: [],
  }));
  mkdirSync(join(home, 'source-existing'));
  writeFileSync(join(home, 'source-existing', 'README.md'), '# Existing source\n');
  const runtime: Record<string, unknown> = {};
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  let server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const catalogResponse = await fetch(`${baseUrl}/decision-os/projects`);
    const catalog = await catalogResponse.json() as { projects: Array<{ id: string; name: string; description: string; color: string; relativePath: string; root: string }> };
    assert.deepEqual(catalog.projects.map((project) => project.relativePath), ['admin', 'dev/project-a', 'dev/project-b']);
    assert.deepEqual(catalog.projects.map((project) => project.name), ['admin', 'project-a', 'project-b']);
    assert.equal(existsSync(join(home, '.git')), false);
    for (const decisionOsRoot of [
      join(home, '.decision-os'),
      ...catalog.projects.map((project) => join(project.root, '.decision-os')),
    ]) {
      assert.equal(existsSync(join(decisionOsRoot, '.git')), true, decisionOsRoot);
      assert.equal(git(decisionOsRoot, ['rev-list', '--count', 'HEAD']), '1', decisionOsRoot);
    }

    const rootListingResponse = await fetch(`${baseUrl}/decision-os/directories?path=.`);
    assert.equal(rootListingResponse.status, 200);
    const rootListing = await rootListingResponse.json() as { listing: { directories: Array<{ name: string; path: string }> } };
    assert.deepEqual(rootListing.listing.directories.map((directory) => directory.name), ['admin', 'dev', 'source-existing']);
    const traversalListing = await fetch(`${baseUrl}/decision-os/directories?path=..`);
    assert.equal(traversalListing.status, 400);

    const existingSourceCreation = await fetch(`${baseUrl}/decision-os/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Existing Source', description: 'Selected from disk', directory: 'source-existing' }),
    });
    assert.equal(existingSourceCreation.status, 201);
    const existingSource = await existingSourceCreation.json() as { project: { name: string; relativePath: string } };
    assert.equal(existingSource.project.name, 'Existing Source');
    assert.equal(existingSource.project.relativePath, 'source-existing');
    assert.equal(readFileSync(join(home, 'source-existing', 'README.md'), 'utf8'), '# Existing source\n');
    assert.equal(existsSync(join(home, 'source-existing', '.git')), true);
    assert.equal(existsSync(join(home, 'source-existing', '.decision-os', '.git')), true);
    assert.equal(existsSync(join(home, 'source-existing', '.decision-os', 'state.json')), true);

    const creation = await fetch(`${baseUrl}/decision-os/projects`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Project Gamma', description: 'Created from the catalog' })
    });
    assert.equal(creation.status, 201);
    const created = await creation.json() as { project: { id: string; name: string; description: string; relativePath: string; ledgers: Array<{ id: string; title: string; ledgerFile: string }> } };
    assert.deepEqual(
      { name: created.project.name, description: created.project.description, relativePath: created.project.relativePath },
      { name: 'Project Gamma', description: 'Created from the catalog', relativePath: 'Project Gamma' },
    );
    assert.deepEqual(created.project.ledgers, [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }]);
    assert.deepEqual(JSON.parse(readFileSync(join(home, 'Project Gamma', '.decision-os', 'state.json'), 'utf8')), {
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json', cardId: 'ledger-card:tasks' }],
    });
    const createdTasks = JSON.parse(readFileSync(join(home, 'Project Gamma', '.decision-os', 'tasks.json'), 'utf8')) as { modelName: string; cards: unknown[] };
    assert.equal(createdTasks.modelName, 'tasks');
    assert.deepEqual(createdTasks.cards, []);
    assert.equal(existsSync(join(home, 'Project Gamma', '.decision-os', '.git')), true);
    assert.equal(git(join(home, 'Project Gamma', '.decision-os'), ['rev-list', '--count', 'HEAD']), '1');
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

    const initialCodexSettings = await fetch(`${baseUrl}/api/settings/codex-processes`).then((response) => response.json()) as {
      maxConcurrentCodexProcesses: number;
      masterTaskCompletionPipelineId: string;
      pipelines: Array<{ id: string; name: string }>;
    };
    assert.equal(initialCodexSettings.maxConcurrentCodexProcesses, 1);
    assert.equal(initialCodexSettings.masterTaskCompletionPipelineId, '');
    assert.deepEqual(
      initialCodexSettings.pipelines.find((pipeline) => pipeline.id === 'pipeline-complete'),
      { id: 'pipeline-complete', name: 'Complete master task' },
    );
    const savedCodexSettings = await fetch(`${baseUrl}/api/settings/codex-processes`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        maxConcurrentCodexProcesses: 3,
        masterTaskCompletionPipelineId: 'pipeline-complete',
      })
    });
    assert.equal(savedCodexSettings.ok, true);
    const savedCodexSettingsPayload = await savedCodexSettings.json() as {
      maxConcurrentCodexProcesses: number;
      masterTaskCompletionPipelineId: string;
    };
    assert.equal(savedCodexSettingsPayload.maxConcurrentCodexProcesses, 3);
    assert.equal(savedCodexSettingsPayload.masterTaskCompletionPipelineId, 'pipeline-complete');
    assert.equal(JSON.parse(readFileSync(join(home, '.decision-os', '.settings.json'), 'utf8')).maxConcurrentCodexProcesses, 3);
    assert.equal(JSON.parse(readFileSync(join(home, '.decision-os', '.settings.json'), 'utf8')).masterTaskCompletionPipelineId, 'pipeline-complete');
    const staleCompletionPipeline = await fetch(`${baseUrl}/api/settings/codex-processes`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        maxConcurrentCodexProcesses: 3,
        masterTaskCompletionPipelineId: 'missing-pipeline',
      })
    });
    assert.equal(staleCompletionPipeline.status, 400);
    assert.match(await staleCompletionPipeline.text(), /masterTaskCompletionPipelineId must identify an available pipeline/);
    assert.equal(JSON.parse(readFileSync(join(home, '.decision-os', '.settings.json'), 'utf8')).masterTaskCompletionPipelineId, 'pipeline-complete');

    const legacyPage = await fetch(`${baseUrl}/p/${catalog.projects[0].id}/projects/${catalog.projects[0].id}`, { redirect: 'manual' });
    assert.equal(legacyPage.status, 302);
    assert.equal(legacyPage.headers.get('location'), `/projects/${catalog.projects[0].id}`);

    const projectPage = await fetch(`${baseUrl}/projects/${encodeURIComponent(catalog.projects[0].id)}`);
    assert.equal(projectPage.status, 200);
    assert.match(projectPage.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await projectPage.text(), /src\/runtime\/surface-runtime\.ts/);

    const settingsPage = await fetch(`${baseUrl}/settings`);
    assert.equal(settingsPage.status, 200);
    assert.match(settingsPage.headers.get('content-type') ?? '', /text\/html/);

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

    const decisionOsRoots = [
      join(home, '.decision-os'),
      join(home, 'admin', '.decision-os'),
      join(home, 'dev', 'project-a', '.decision-os'),
      join(home, 'dev', 'project-b', '.decision-os'),
      join(home, 'source-existing', '.decision-os'),
      join(home, 'Project Gamma', '.decision-os'),
    ];
    const headsBeforeRestart = new Map(decisionOsRoots.map((decisionOsRoot) => [
      decisionOsRoot,
      git(decisionOsRoot, ['rev-parse', 'HEAD']),
    ]));
    server.close();
    await once(server, 'close');
    const restartedRuntime: Record<string, unknown> = {};
    createHttpServer({
      action_payload: {
        port: 0,
        host: '127.0.0.1',
        cwd: home,
        decisionOsFrontendRoot: join(repositoryRoot, 'frontend'),
      },
      runtime_state: restartedRuntime,
    });
    server = restartedRuntime.server as Server;
    await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
    for (const [decisionOsRoot, head] of headsBeforeRestart) {
      assert.equal(git(decisionOsRoot, ['rev-parse', 'HEAD']), head, decisionOsRoot);
    }
  } finally {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    }
    if (previousMaxConcurrentProcesses === undefined) delete process.env.CODEX_MAX_CONCURRENT_PROCESSES;
    else process.env.CODEX_MAX_CONCURRENT_PROCESSES = previousMaxConcurrentProcesses;
    if (previousRepositorySettingsFile === undefined) delete process.env.DECISION_OS_REPOSITORY_SETTINGS_FILE;
    else process.env.DECISION_OS_REPOSITORY_SETTINGS_FILE = previousRepositorySettingsFile;
    rmSync(home, { recursive: true, force: true });
  }
});
