/**
 * WHAT: Covers release health, runtime incident containment, and diagnostic availability.
 * WHY: One failing project or background scope must preserve server health and actionable incident evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { createRuntimeIncidentLedger } from '@backend/business/server/helper/runtime-incident-ledger.js';
import { runtimeIncidentReviewCardId, runtimeIncidentReviewProjectId } from '@backend/business/server/helper/synchronize-runtime-incident-review-task.js';
import { migrateTaskCurrentState } from '@backend/business/task-state/helper/task-current-state-migration.js';
import { createTaskExecutionLaunchRequest, type TaskExecutionRouter } from '@backend/business/codex/helper/task-execution-router.js';

test('normal health reports the active release identity', async (context) => {
  const previousDeliveryProtocol = process.env.DECISION_OS_DELIVERY_PROTOCOL;
  context.after(() => {
    // WHAT: Restore the caller's delivery-protocol environment after the release fixture.
    // WHY: Process-wide delivery discovery must not leak the fixture protocol into later tests.
    if (previousDeliveryProtocol === undefined) delete process.env.DECISION_OS_DELIVERY_PROTOCOL;
    else process.env.DECISION_OS_DELIVERY_PROTOCOL = previousDeliveryProtocol;
  });
  const home = mkdtempSync(join(tmpdir(), 'decision-os-release-health-'));
  const decisionOsRoot = join(home, '.decision-os');
  const releaseSha = 'a'.repeat(40);
  const releaseRoot = join(decisionOsRoot, 'delivery');
  const releasePath = join(releaseRoot, 'releases', releaseSha);
  const currentPointer = join(releaseRoot, 'current');
  mkdirSync(releasePath, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'release-health' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));
  writeFileSync(join(releasePath, '.decision-os-release.json'), JSON.stringify({
    protocol: 1,
    releaseSha,
    launcher: 'bin/decision-os-server.mjs',
  }));
  symlinkSync(`releases/${releaseSha}`, currentPointer);

  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  process.env.DECISION_OS_DELIVERY_PROTOCOL = '1';
  const runtime: Record<string, unknown> = {
    // WHAT: Install release identity before constructing the server.
    // WHY: Health initialization snapshots delivery settings during construction.
    decisionOsSettings: {
      deliveryProtocol: 1,
      deliveryReleaseRoot: releaseRoot,
      deliveryCurrentPointer: currentPointer,
    },
  };
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: home,
      decisionOsFrontendRoot: join(repositoryRoot, 'frontend'),
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  try {
    const health = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`)
      .then((response) => response.json()) as Record<string, unknown>;
    assert.equal(health.status, 'ready');
    assert.equal(health.releaseSha, releaseSha);
    assert.equal(health.deliveryProtocol, 1);
    assert.equal(health.activeReleasePointer, `current:${releaseSha}`);
    assert.equal(Number.isFinite(Date.parse(String(health.processStartedAt))), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});

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
  const healthyDecisionOsRoot = join(home, '.decision-os');
  const decisionOsRoot = join(home, 'project-a', '.decision-os');
  const projectId = 'project-a';
  mkdirSync(healthyDecisionOsRoot, { recursive: true });
  writeFileSync(join(healthyDecisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-b' }));
  writeFileSync(join(healthyDecisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(healthyDecisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'healthy-master', title: 'Healthy master', labels: ['master-task'] }],
    annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));
  await migrateTaskCurrentState({
    decisionOsRoot: healthyDecisionOsRoot,
    projectId: 'project-b',
    nodeId: 'local',
    tasksLedgerFile: join(healthyDecisionOsRoot, 'tasks.json'),
  });
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
  const journalABytes = readFileSync(join(journalDirectory, 'a.json'), 'utf8');
  const journalBBytes = readFileSync(join(journalDirectory, 'b.json'), 'utf8');

  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {
    decisionOsSettings: { federationNodeId: 'workstation' },
  };
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
    const unrelated = await (runtime.taskExecutionRouter as TaskExecutionRouter).route(createTaskExecutionLaunchRequest({
      requestId: 'request-unrelated-project',
      executionId: 'execution-unrelated-project',
      projectId: 'project-b',
      ledgerId: 'tasks',
      sessionId: 'session-unrelated-project',
      sourceCardId: 'healthy-master',
      requestedAt: '2026-07-23T13:00:00.000Z',
    }));
    assert.equal(unrelated.executionId, 'execution-unrelated-project');
    assert.equal(unrelated.phase, 'queued');
    assert.equal(readFileSync(join(journalDirectory, 'a.json'), 'utf8'), journalABytes);
    assert.equal(readFileSync(join(journalDirectory, 'b.json'), 'utf8'), journalBBytes);

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
    assert.equal(readFileSync(join(journalDirectory, 'a.json'), 'utf8'), journalABytes);
    assert.equal(readFileSync(join(journalDirectory, 'b.json'), 'utf8'), journalBBytes);
  } finally {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  }
});

test('task-state journal write failure preserves invalid bytes and pauses only its project', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-runtime-write-failure-'));
  const healthyRoot = join(home, '.decision-os');
  const failingRoot = join(home, 'project-a', '.decision-os');
  const initializeProject = async (decisionOsRoot: string, projectId: string, cardId: string) => {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
      cards: [{ id: cardId, title: cardId, labels: ['master-task'] }],
      annotations: [],
      relationships: [],
      notes: {},
      threadFiles: {},
    }));
    await migrateTaskCurrentState({
      decisionOsRoot,
      projectId,
      nodeId: 'workstation',
      tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
    });
  };
  await initializeProject(healthyRoot, 'project-b', 'healthy-master');
  await initializeProject(failingRoot, 'project-a', 'failing-master');
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = {
    decisionOsSettings: { federationNodeId: 'workstation' },
  };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const failingJournal = join(failingRoot, 'task-state', 'project-a', 'journal');
  const invalidBytes = '{invalid-journal-boundary';
  rmSync(failingJournal, { recursive: true, force: true });
  writeFileSync(failingJournal, invalidBytes);

  try {
    const failedWrite = await fetch(`${baseUrl}/p/project-a/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'failing-master', title: 'must-not-persist' } }),
    });
    assert.ok(failedWrite.status >= 500);
    await waitUntil(async () => {
      const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { pausedTaskProjectIds: string[] };
      return health.pausedTaskProjectIds.includes('project-a');
    });
    assert.equal(readFileSync(failingJournal, 'utf8'), invalidBytes);
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as {
      pausedTaskProjectIds: string[];
    };
    assert.deepEqual(health.pausedTaskProjectIds, ['project-a']);
    assert.equal((await fetch(`${baseUrl}/api/diagnostics/incidents`)).status, 200);

    const unrelated = await (runtime.taskExecutionRouter as TaskExecutionRouter).route(createTaskExecutionLaunchRequest({
      requestId: 'request-after-write-failure',
      executionId: 'execution-after-write-failure',
      projectId: 'project-b',
      ledgerId: 'tasks',
      sessionId: 'session-after-write-failure',
      sourceCardId: 'healthy-master',
      requestedAt: '2026-07-23T13:15:00.000Z',
    }));
    assert.equal(unrelated.phase, 'queued');
    assert.equal(unrelated.executionId, 'execution-after-write-failure');
    assert.equal(readFileSync(failingJournal, 'utf8'), invalidBytes);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

test('invalid project pipeline store pauses only its Codex runtime while global scheduling stays available', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-store-scheduler-containment-'));
  const frontendRoot = join(home, 'frontend');
  const projectRoots = [
    { root: join(home, 'healthy'), projectId: 'healthy-project' },
    { root: join(home, 'invalid'), projectId: 'invalid-project' },
  ];
  mkdirSync(join(home, '.decision-os'), { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  for (const project of projectRoots) {
    const decisionOsRoot = join(project.root, '.decision-os');
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: project.projectId }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
      cards: [],
      annotations: [],
      relationships: [],
      notes: {},
      threadFiles: {},
    }));
    writeFileSync(join(decisionOsRoot, 'codex-pipelines.json'), JSON.stringify({
      version: 1,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [],
      authoredContent: [],
      activeWorkspaceRun: null,
    }));
  }

  const runtime: Record<string, unknown> = {};
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: home,
      decisionOsFrontendRoot: frontendRoot,
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const invalidStore = join(projectRoots[1].root, '.decision-os', 'codex-pipelines.json');

  try {
    writeFileSync(invalidStore, JSON.stringify({
      version: 1,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [],
      authoredContent: [{ kind: 'skill', id: 'invalid id', name: 'Invalid' }],
      activeWorkspaceRun: null,
    }));
    await waitUntil(async () => {
      const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as {
        pausedBackgroundComponents: string[];
      };
      return health.pausedBackgroundComponents.includes('codex-runtime:invalid-project');
    });

    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as {
      status: string;
      pausedBackgroundComponents: string[];
    };
    assert.equal(health.status, 'degraded');
    assert.equal(health.pausedBackgroundComponents.includes('codex-process-scheduler'), false);
    assert.equal(health.pausedBackgroundComponents.includes('codex-runtime:healthy-project'), false);
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/federation/nodes`)).status, 200);

    const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`)
      .then((response) => response.json()) as {
        incidents: Array<{ scope: string; operation: string; context: Record<string, unknown> }>;
      };
    const contained = incidents.incidents.find((incident) => (
      incident.scope === 'background:codex-runtime:invalid-project'
      && incident.operation === 'inspect-project-codex-queue'
    ));
    assert.equal(contained?.context.projectId, 'invalid-project');
    assert.equal(contained?.context.decisionOsRoot, join(projectRoots[1].root, '.decision-os'));
    assert.equal(
      contained?.context.upstreamScope,
      `codex-pipeline-store:${join(projectRoots[1].root, '.decision-os', 'codex-pipelines.json')}`,
    );

    writeFileSync(invalidStore, JSON.stringify({
      version: 1,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [],
      authoredContent: [],
      activeWorkspaceRun: null,
    }));
    const resume = await fetch(`${baseUrl}/api/diagnostics/runtime/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: 'background:codex-runtime:invalid-project',
        resolution: 'Pipeline store corrected and revalidated.',
      }),
    });
    assert.equal(resume.status, 200);
    const resumed = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as {
      pausedBackgroundComponents: string[];
    };
    assert.equal(resumed.pausedBackgroundComponents.includes('codex-runtime:invalid-project'), false);
    assert.equal(resumed.pausedBackgroundComponents.includes('codex-process-scheduler'), false);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

test('keeps diagnostics online and pauses task admission for an interrupted epoch-4 transaction', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-runtime-migration-admission-'));
  const decisionOsRoot = join(home, '.decision-os');
  const projectId = 'project-a';
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {} }));
  await migrateTaskCurrentState({ decisionOsRoot, projectId, nodeId: 'workstation', tasksLedgerFile: join(decisionOsRoot, 'tasks.json') });
  mkdirSync(join(decisionOsRoot, 'runtime'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'runtime', 'epoch-4-migration-admission.json'), JSON.stringify({
    version: 1,
    runId: 'interrupted-run',
    phase: 'committing',
    backupRoot: join(home, 'rollback'),
    projectIds: [projectId],
    updatedAt: '2026-07-24T00:00:00.000Z',
  }));

  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = { decisionOsSettings: { federationNodeId: 'workstation' } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { status: string; pausedTaskProjectIds: string[] };
    assert.equal(health.status, 'degraded');
    assert.deepEqual(health.pausedTaskProjectIds, [projectId]);
    assert.equal((await fetch(`${baseUrl}/api/diagnostics/incidents`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    const incidents = JSON.parse(readFileSync(join(decisionOsRoot, 'runtime-incidents.json'), 'utf8')) as { incidents: Array<{ scope: string; code: string }> };
    assert.equal(incidents.incidents.some((incident) => incident.scope === `project-task-state:${projectId}` && incident.code === 'task_migration_transaction_incomplete'), true);

    const eventResponse = await fetch(`${baseUrl}/p/${projectId}/api/ledger-content-events`);
    assert.equal(eventResponse.status, 200);
    const reader = eventResponse.body!.getReader();
    const connected = await reader.read();
    assert.match(Buffer.from(connected.value ?? []).toString('utf8'), /connected/);
    writeFileSync(join(decisionOsRoot, 'runtime', 'epoch-4-migration-admission.json'), JSON.stringify({
      version: 1,
      runId: 'interrupted-run',
      phase: 'verified',
      backupRoot: join(home, 'rollback'),
      projectIds: [projectId],
      updatedAt: '2026-07-24T00:01:00.000Z',
    }));
    const resume = await fetch(`${baseUrl}/api/diagnostics/runtime/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: `project-task-state:${projectId}`, resolution: 'Transaction evidence revalidated.' }),
    });
    assert.equal(resume.status, 200, await resume.clone().text());
    const settled = await reader.read();
    assert.equal(settled.done, true);
    const recoveredHealth = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as {
      status: string;
      pausedTaskProjectIds: string[];
    };
    assert.equal(recoveredHealth.status, 'ready');
    assert.deepEqual(recoveredHealth.pausedTaskProjectIds, []);
    assert.equal((await fetch(`${baseUrl}/p/${projectId}/api/ledgers/tasks/navigation`)).status, 200);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

test('recovers compatible hosted task state automatically without restarting the server', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-runtime-automatic-migration-'));
  const decisionOsRoot = join(home, '.decision-os');
  const projectId = 'automatic-project';
  const stateRoot = join(decisionOsRoot, 'task-state', projectId);
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  const ledger = {
    cards: [{ id: 'card-a', title: 'Recovered card' }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: {},
  };
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify(ledger));
  writeFileSync(join(stateRoot, 'projection.json'), JSON.stringify({
    version: 3,
    projectId,
    ledger,
    conflicts: [],
  }));
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  const runtime: Record<string, unknown> = { decisionOsSettings: { federationNodeId: 'workstation' } };
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: home,
      decisionOsFrontendRoot: join(repositoryRoot, 'frontend'),
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await waitUntil(async () => {
      const response = await fetch(`${baseUrl}/api/task-state/projection?projectId=${projectId}`);
      if (!response.ok) return false;
      const body = await response.json() as { ledger?: { cards?: Array<{ id: string }> } };
      return body.ledger?.cards?.some((card) => card.id === 'card-a') === true;
    }, 5_000);
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as {
      status: string;
      pausedTaskProjectIds: string[];
    };
    assert.equal(health.status, 'ready');
    assert.deepEqual(health.pausedTaskProjectIds, []);
    assert.equal(JSON.parse(readFileSync(join(stateRoot, 'format.json'), 'utf8')).stateSchema, 4);
    const admission = JSON.parse(readFileSync(join(decisionOsRoot, 'runtime', 'epoch-4-migration-admission.json'), 'utf8')) as {
      phase: string;
      projectIds: string[];
    };
    assert.equal(admission.phase, 'verified');
    assert.deepEqual(admission.projectIds, [projectId]);
    assert.equal(server.address() && (server.address() as AddressInfo).port, address.port);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
    rmSync(join(home, '.decision-os-task-state-recovery'), { recursive: true, force: true });
  }
});
