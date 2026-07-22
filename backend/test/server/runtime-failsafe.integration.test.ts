import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { createRuntimeIncidentLedger } from '@backend/business/server/helper/runtime-incident-ledger.js';
import { runtimeIncidentReviewCardId, runtimeIncidentReviewProjectId } from '@backend/business/server/helper/synchronize-runtime-incident-review-task.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';

async function waitUntil(assertion: () => boolean | Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('Timed out waiting for runtime incident review synchronization.');
}

test('periodically centralizes runtime incidents only in the Decision OS project', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incident-review-'));
  const adminDecisionOsRoot = join(home, 'admin', '.decision-os');
  const projectDecisionOsRoot = join(home, 'decision-os', '.decision-os');
  const centralDecisionOsRoot = join(home, '.decision-os');
  for (const [decisionOsRoot, projectId] of [[adminDecisionOsRoot, 'admin'], [projectDecisionOsRoot, runtimeIncidentReviewProjectId]]) {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {} }));
  }
  const incidents = createRuntimeIncidentLedger({ decisionOsRoot: centralDecisionOsRoot });
  incidents.record({
    scope: 'http-request:POST:/api/voice-upload',
    component: 'http-server',
    operation: 'handle-request',
    code: 'task_state_bootstrap_incomplete',
    error: new Error('task_state_bootstrap_incomplete'),
  });

  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {};
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: home,
      decisionOsFrontendRoot: join(repositoryRoot, 'frontend'),
      runtimeIncidentReviewIntervalMs: 20,
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const cards = async (projectId: string): Promise<Array<Record<string, unknown>>> => {
      const response = await fetch(`${baseUrl}/p/${projectId}/api/ledgers/tasks/canvas`);
      if (!response.ok) return [];
      return ((await response.json()) as { cards?: Array<Record<string, unknown>> }).cards ?? [];
    };
    await waitUntil(async () => (await cards(runtimeIncidentReviewProjectId)).some((card) => card.id === runtimeIncidentReviewCardId));
    assert.equal((await cards(runtimeIncidentReviewProjectId)).filter((card) => card.id === runtimeIncidentReviewCardId).length, 1);
    assert.equal((await cards('admin')).some((card) => card.id === runtimeIncidentReviewCardId), false);
    const contentFile = join(projectDecisionOsRoot, 'cards', 'tasks', `${runtimeIncidentReviewCardId}.md`);
    assert.match(readFileSync(contentFile, 'utf8'), /task_state_bootstrap_incomplete/);

    incidents.record({
      scope: 'background:test-worker',
      component: 'test-worker',
      operation: 'run-test-worker',
      error: new Error('second centralized failure'),
    });
    await waitUntil(() => readFileSync(contentFile, 'utf8').includes('second centralized failure'));
    assert.equal((await cards(runtimeIncidentReviewProjectId)).filter((card) => card.id === runtimeIncidentReviewCardId).length, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});

test('keeps the catalog and diagnostics online when one project has colliding retained journals', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-runtime-failsafe-'));
  const decisionOsRoot = join(home, 'project-a', '.decision-os');
  const projectId = 'project-a';
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'master', title: 'Master', labels: ['master-task'], lifecycle: { status: 'todo', changedAt: '2026-07-22T00:00:00.000Z', waitingAt: '2026-07-22T00:00:00.000Z', closedAt: null } }],
    annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));
  await migrateTaskCurrentState({ decisionOsRoot, projectId, nodeId: 'workstation', tasksLedgerFile: join(decisionOsRoot, 'tasks.json') });
  const journalDirectory = join(decisionOsRoot, 'task-state', projectId, 'journal');
  const mutation = (batchId: string, changedAt: string) => ({
    version: 3,
    mutation: {
      version: 3,
      batchId,
      projectId,
      replicaId: 'workstation',
      emittedAt: changedAt,
      dot: { replicaId: 'workstation', counter: 1 },
      context: {},
      changes: [{ entityType: 'resource', entityId: '.decision-os/threads/tasks/thread-master.md', changes: [{ path: 'head', operation: 'set', value: { type: 'thread-markdown', key: '.decision-os/threads/tasks/thread-master.md', hash: 'a'.repeat(64), bytes: 10, changedAt } }] }],
      activationTaskId: 'master',
      replication: 'active',
    },
  });
  writeFileSync(join(journalDirectory, 'a.json'), JSON.stringify(mutation('collision-a', '2026-07-22T00:00:01.000Z')));
  writeFileSync(join(journalDirectory, 'b.json'), JSON.stringify(mutation('collision-b', '2026-07-22T00:00:02.000Z')));

  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  let server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as Record<string, any>;
    assert.equal(health.ok, true);
    assert.equal(health.status, 'degraded');
    assert.equal(health.activeIncidentCount, 1);
    assert.deepEqual(health.pausedTaskProjectIds, [projectId]);

    const nodesResponse = await fetch(`${baseUrl}/api/federation/nodes`);
    assert.equal(nodesResponse.status, 200);
    const controlRoomResponse = await fetch(`${baseUrl}/api/control-room?localOnly=1`);
    assert.equal(controlRoomResponse.status, 200);
    const controlRoom = await controlRoomResponse.json() as Record<string, any>;
    assert.equal(controlRoom.queue.length, 1);
    assert.equal(controlRoom.queue[0].cardId, 'master');

    const incidents = JSON.parse(readFileSync(join(home, '.decision-os', 'runtime-incidents.json'), 'utf8')) as Record<string, any>;
    assert.equal(incidents.incidents.some((incident: Record<string, unknown>) => incident.scope === `project-task-state:${projectId}` && incident.status === 'paused'), true);
    const collisionIncident = incidents.incidents.find((incident: Record<string, unknown>) => incident.scope === `project-task-state:${projectId}`);
    assert.equal(collisionIncident.occurrences, 1);
    const secondHealth = await fetch(`${baseUrl}/api/health`);
    assert.equal(secondHealth.status, 200);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    const restartedRuntime: Record<string, unknown> = {};
    createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: restartedRuntime });
    server = restartedRuntime.server as Server;
    await once(server, 'listening');
    const restartedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const restartedHealth = await fetch(`${restartedUrl}/api/health`).then((response) => response.json()) as Record<string, any>;
    assert.deepEqual(restartedHealth.pausedTaskProjectIds, [projectId]);
    const restartedIncidents = JSON.parse(readFileSync(join(home, '.decision-os', 'runtime-incidents.json'), 'utf8')) as Record<string, any>;
    assert.equal(restartedIncidents.incidents.find((incident: Record<string, unknown>) => incident.scope === `project-task-state:${projectId}`).occurrences, 1);
  } finally {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});
