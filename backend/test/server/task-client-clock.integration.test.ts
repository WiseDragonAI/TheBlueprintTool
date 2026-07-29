import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';
import { createTaskCurrentStateStore } from '@backend/business/task-state/helper/task-current-state-store.js';
import { finalizeTaskCurrentEntity, taskCurrentStateVersion, type TaskCurrentEntity } from '../../../shared/task-current-state-core.js';

test('migration-sized durable clocks produce bounded task response headers without changing stored state', async (context) => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-task-client-clock-'));
  context.after(() => rmSync(home, { recursive: true, force: true }));
  const decisionOsRoot = join(home, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'card-a.md'), 'Readable target.');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Target', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: {},
  }));
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'clock-header-project' }));
  await migrateTaskCurrentState({
    decisionOsRoot,
    projectId: 'clock-header-project',
    nodeId: 'workstation',
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
  });

  const store = createTaskCurrentStateStore({ decisionOsRoot, projectId: 'clock-header-project' });
  const migrationEntities: TaskCurrentEntity[] = Array.from({ length: 3_303 }, (_value, index) => {
    const replicaId = `migration:clock-header-project:card:synthetic-${index}:presence`;
    return finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId: 'clock-header-project',
      entityType: 'card',
      entityId: `synthetic-${index}`,
      fields: {
        '$entity': {
          clock: { [replicaId]: 1 },
          candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set', value: true }],
        },
      },
    });
  });
  await store.merge({ version: taskCurrentStateVersion, projectId: 'clock-header-project', entities: migrationEntities });
  await store.flush();
  assert.equal(Object.keys(store.clock()).filter((replicaId) => replicaId.startsWith('migration:')).length, 3_303);
  assert.equal(Object.keys(store.clientClock()).some((replicaId) => replicaId.startsWith('migration:')), false);

  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {};
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${baseUrl}/api/ledgers/tasks/cards/card-a`);
    const body = await response.json() as Record<string, unknown>;
    const encodedClock = response.headers.get('x-decision-os-task-clock') ?? '';
    const clientClock = JSON.parse(Buffer.from(encodedClock, 'base64url').toString('utf8')) as Record<string, number>;
    assert.equal(response.status, 200);
    assert.equal(body.title, 'Target');
    assert.ok(Buffer.byteLength(encodedClock) < 8 * 1024);
    assert.equal(Object.keys(clientClock).some((replicaId) => replicaId.startsWith('migration:')), false);

    const mutationResponse = await fetch(`${baseUrl}/p/clock-header-project/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'patch-card',
        mutationId: 'clock-header-mutation',
        cardPatch: { id: 'card-a', title: 'Updated target' },
      }),
    });
    const mutation = await mutationResponse.json() as Record<string, any>;
    assert.equal(mutationResponse.status, 200, JSON.stringify(mutation));
    assert.equal(mutation.changedCard?.title, 'Updated target');
    assert.deepEqual(mutation.receipt?.clock, mutation.taskClock);
    assert.equal(Object.keys(mutation.taskClock).some((replicaId) => replicaId.startsWith('migration:')), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const reopened = createTaskCurrentStateStore({ decisionOsRoot, projectId: 'clock-header-project' });
  assert.equal(Object.keys(reopened.clock()).filter((replicaId) => replicaId.startsWith('migration:')).length, 3_303);
});
