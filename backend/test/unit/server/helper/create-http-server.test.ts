/**
 * WHAT: Unit test for implemented function create-http-server.
 * WHY: each generated function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { createRuntimeIncidentLedger } from '@backend/business/server/helper/runtime-incident-ledger.js';
import { scheduleCodexRuntimeTimer } from '@backend/business/codex/helper/codex-runtime-run-store.js';
import { createTaskExecutionLaunchRequest, type TaskExecutionRouter } from '@backend/business/codex/helper/task-execution-router.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import { readCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { mandatoryPipelinePromptNames } from '@backend/business/codex/helper/mandatory-pipeline-prompts.js';

test('create-http-server executes implemented behavior and records telemetry', async () => {
  traces.length = 0;
  const runtime_state: Record<string, unknown> = {};
  const result = await createHttpServer({
    action_payload: { ok: true, mode: 'dry-run', name: 'Implemented', color: '#5b7cfa', markdown: '# Title #label', url: '/ledgers/default' },
    runtime_state,
    data_model: { cards: [{ id: 'card-1' }], document: {} }
  });
  assert.ok(traces.length > 0);
  assert.ok(result === undefined || typeof result === 'object');
});

test('listener serves health static application and stale Control Room before project bootstrap settles', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-listener-first-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(join(decisionOsRoot, 'cache'), { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(decisionOsRoot, 'cache', 'control-room-v3.json'), JSON.stringify({
    schemaVersion: 9,
    projectorVersion: 'control-room-v18-replicated-execution',
    fingerprint: 'cached-before-bootstrap',
    allTasks: [{ cardId: 'cached-task' }],
    projectSlices: [{ projectId: 'private-slice' }],
    dependencies: [{ path: 'private-dependency' }],
  }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html><title>listener-first</title>');
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const runtimeReady = (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  let settled = false;
  void runtimeReady.then(() => { settled = true; });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    assert.equal(settled, false);
    const [health, application, controlRoom] = await Promise.all([
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/api/control-room`),
    ]);
    assert.equal(health.status, 200);
    assert.match(await application.text(), /listener-first/);
    const projection = await controlRoom.json() as Record<string, unknown>;
    assert.equal(projection.stale, true);
    assert.equal(projection.startupPhase, 'loading');
    assert.equal(Object.hasOwn(projection, 'projectSlices'), false);
    assert.equal(Object.hasOwn(projection, 'dependencies'), false);
  } finally {
    await runtimeReady;
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server installs mandatory prompts into a fresh server-owned root', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-server-mandatory-prompts-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html><title>Decision OS</title>');
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    const store = readCodexPipelineStore({ decisionOsRoot }).store;
    for (const name of mandatoryPipelinePromptNames) {
      assert.equal(readFileSync(join(decisionOsRoot, 'pipeline-prompts', `${name}.md`), 'utf8').length > 0, true);
      assert.equal(store.authoredContent.some((record) => record.id === name), true);
      assert.deepEqual(store.skillLibrary.find((record) => record.skillName === name)?.tags, ['System']);
    }
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server serves shared TypeScript modules through their browser JavaScript URL', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-shared-module-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  const sharedSchemasRoot = join(projectRoot, 'shared', 'schemas');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  mkdirSync(sharedSchemasRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(sharedSchemasRoot, 'options.ts'), "export const options: readonly string[] = ['shared'];\n");

  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    assert.equal('memoryDatabasePath' in runtime, false);
    const response = await fetch(`${baseUrl}/shared/schemas/options.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.match(await response.text(), /export const options = \['shared'\]/);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server serves System status and stateful skill application routes', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-system-status-route-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html><title>System status</title>');
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/status`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(await response.text(), /System status/);
    const skillEditor = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/skills/accessibility-excellence/edit`);
    assert.equal(skillEditor.status, 200);
    assert.equal(skillEditor.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(await skillEditor.text(), /System status/);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server acknowledges a manual restart before invoking the supervisor exit hook', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-server-restart-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  let restarted = false;
  const runtime: Record<string, unknown> = { decisionOsRoot, restartServer: () => { restarted = true; } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/server/restart`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, restarting: true });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(restarted, true);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server resolves the retained launcher incident only after listening', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-launcher-recovery-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const incidents = createRuntimeIncidentLedger({ decisionOsRoot });
  incidents.record({
    severity: 'fatal',
    scope: 'server-launcher',
    component: 'decision-os-launcher',
    operation: 'run-server-child',
    code: 'server_child_exited',
    error: new Error('injected child exit'),
  });
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    assert.deepEqual(incidents.active('server-launcher'), []);
    const retained = incidents.snapshot().incidents.find((incident) => incident.scope === 'server-launcher');
    assert.equal(retained?.status, 'resolved');
    assert.match(String(retained?.context.resolution ?? ''), /opened its HTTP listener successfully/);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server keeps health ready for unresolved evidence that owns no runtime pause', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-nonblocking-incident-health-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const incidents = createRuntimeIncidentLedger({ decisionOsRoot });
  incidents.record({
    scope: 'http-request:GET:/missing-card',
    component: 'http-server',
    operation: 'handle-request',
    code: 'task_card_not_found',
    error: new Error('task_card_not_found'),
  });
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    const health = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`)
      .then((response) => response.json()) as { status: string; activeIncidentCount: number };
    assert.equal(health.status, 'ready');
    assert.equal(health.activeIncidentCount, 1);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('create-http-server resolves retained transient task bootstrap incidents at startup', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-bootstrap-incident-recovery-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const incidents = createRuntimeIncidentLedger({ decisionOsRoot });
  incidents.record({
    severity: 'error',
    scope: 'http-request:POST:/api/voice-upload',
    component: 'http-server',
    operation: 'handle-request',
    code: 'task_state_bootstrap_incomplete',
    error: new Error('task_state_bootstrap_incomplete'),
  });
  incidents.record({
    severity: 'warning',
    scope: 'project-task-write:project-a',
    component: 'task-current-state',
    operation: 'capture-watched-task-content',
    code: 'task_state_bootstrap_incomplete',
    error: new Error('task_state_bootstrap_incomplete'),
  });
  incidents.record({
    severity: 'error',
    scope: 'background:codex-startup-project-a',
    component: 'codex-startup-project-a',
    operation: 'reconcile-codex-startup-state',
    code: 'task_state_bootstrap_incomplete',
    error: new Error('task_state_bootstrap_incomplete'),
  });
  incidents.record({
    severity: 'error',
    scope: 'background:codex-runtime:project-a',
    component: 'codex-runtime:project-a',
    operation: 'codex-execution-timeout',
    error: new Error('Codex execution exceeded 1800000ms.'),
  });
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;

  try {
    const health = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`).then((response) => response.json()) as { status: string; activeIncidentCount: number };
    assert.equal(health.status, 'ready');
    assert.equal(health.activeIncidentCount, 0);
    assert.equal(incidents.snapshot().incidents.filter((incident) => incident.code === 'task_state_bootstrap_incomplete').every((incident) => incident.status === 'resolved'), true);
    assert.equal(incidents.snapshot().incidents.find((incident) => incident.operation === 'codex-execution-timeout')?.status, 'resolved');
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('startup revalidates durable task state before clearing a retired federation-frame pause', async () => {
  const originalCwd = process.cwd();
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-frame-pause-recovery-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a', name: 'Project A' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Preserved task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: {},
  }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const durableState = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
    initialize: true,
  });
  await durableState.flush();
  const incidents = createRuntimeIncidentLedger({ decisionOsRoot });
  incidents.record({
    severity: 'error',
    scope: 'project-task-state:project-a',
    component: 'task-current-state',
    operation: 'handle-federated-state-frame',
    error: new Error('task_execution_conflict:execution-a:artifacts'),
  });
  process.chdir(projectRoot);
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const navigation = await fetch(`${baseUrl}/p/project-a/api/ledgers/tasks/navigation`);
    assert.equal(navigation.status, 200);
    assert.deepEqual(incidents.active('project-task-state:project-a'), []);
    assert.equal(
      incidents.snapshot().incidents.find((incident) => incident.operation === 'handle-federated-state-frame')?.status,
      'resolved',
    );
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('failed frame-pause revalidation preserves invalid durable bytes and keeps Tasks paused', async () => {
  const originalCwd = process.cwd();
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-frame-pause-invalid-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a', name: 'Project A' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Preserved task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: {},
  }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const durableState = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
    initialize: true,
  });
  await durableState.flush();
  const invalidEntityFile = join(decisionOsRoot, 'task-state', 'project-a', 'current', 'card', 'card-a.json');
  const invalidBytes = '{"invalid":';
  writeFileSync(invalidEntityFile, invalidBytes);
  const incidents = createRuntimeIncidentLedger({ decisionOsRoot });
  incidents.record({
    severity: 'error',
    scope: 'project-task-state:project-a',
    component: 'task-current-state',
    operation: 'handle-federated-state-frame',
    error: new Error('task_execution_conflict:execution-a:artifacts'),
  });
  process.chdir(projectRoot);
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const navigation = await fetch(`${baseUrl}/p/project-a/api/ledgers/tasks/navigation`);
    assert.equal(navigation.status, 503);
    assert.equal(readFileSync(invalidEntityFile, 'utf8'), invalidBytes);
    assert.equal(incidents.active('project-task-state:project-a').length > 0, true);
  } finally {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('server admits local assigned execution while its configured relay is unreachable', async () => {
  const originalCwd = process.cwd();
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-local-execution-relay-outage-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a', name: 'Project A' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [
      {
        id: 'master',
        title: 'Local task',
        status: 'todo',
        labels: ['master-task'],
        assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 },
      },
      {
        id: 'child',
        title: 'Local subtask',
        status: 'todo',
        labels: ['subtask'],
      },
    ],
    annotations: [],
    relationships: [{ id: 'relationship-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
    notes: {},
  }));
  const migratedState = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
    initialize: true,
  });
  await migratedState.flush();
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  process.chdir(projectRoot);
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    decisionOsSettings: {
      federationRelayUrl: 'http://127.0.0.1:1',
      federationId: 'bootstrap-test',
      federationNodeId: 'workstation',
      federationNodeCredential: 'credential',
    },
  };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const releaseCapacity = await (runtime.acquireProjectSyncCodexSlot as () => Promise<() => void>)();
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const eventAbort = new AbortController();
  const eventResponse = await fetch(`${baseUrl}/api/control-room-events`, { signal: eventAbort.signal });
  const eventReader = eventResponse.body!.getReader();
  const decoder = new TextDecoder();
  await eventReader.read();
  const readExecutionRevision = async (revision: number): Promise<string> => {
    let received = '';
    while (!received.includes(`"revision":${revision}`)) {
      const chunk = await eventReader.read();
      if (chunk.done) break;
      received += decoder.decode(chunk.value);
    }
    return received;
  };
  const readExecutionPhase = async (phase: string): Promise<string> => {
    let received = '';
    while (!received.includes(`"phase":"${phase}"`)) {
      const chunk = await eventReader.read();
      if (chunk.done) break;
      received += decoder.decode(chunk.value);
    }
    return received;
  };

  try {
    const unauthenticated = await fetch(`${baseUrl}/p/project-a/api/internal/task-executions/admit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(unauthenticated.status, 403);
    assert.equal((await unauthenticated.json() as { error: string }).error, 'federation_node_authentication_failed');
    const router = runtime.taskExecutionRouter as TaskExecutionRouter;
    assert.ok(router);
    const admitted = await router.route(createTaskExecutionLaunchRequest({
      requestId: 'request-local',
      executionId: 'execution-local',
      projectId: 'project-a',
      ledgerId: 'tasks',
      sessionId: 'session-local',
      sourceCardId: 'child',
      requestedAt: '2026-07-23T01:01:00.000Z',
    }));
    assert.equal(admitted.phase, 'queued');
    assert.equal(admitted.executorNodeId, 'workstation');
    const admittedEvents = await readExecutionRevision(2);
    assert.match(admittedEvents, /event: codex-execution-change/);
    assert.match(admittedEvents, /"taskId":"master"/);
    assert.match(admittedEvents, /"sourceCardId":"child"/);
    assert.match(admittedEvents, /"phase":"preparing"/);
    assert.match(admittedEvents, /"phase":"queued"/);
    const taskSummaryResponse = await fetch(`${baseUrl}/p/project-a/api/tasks/child/execution-state`);
    assert.equal(taskSummaryResponse.status, 200);
    const taskSummary = await taskSummaryResponse.json() as {
      taskId: string;
      activeExecutionIds: string[];
      defaultExecutionId: string;
      sessions: Array<{ sessionId: string; executions: Array<{ executionId: string; phase: string }> }>;
    };
    assert.equal(taskSummary.taskId, 'master');
    assert.deepEqual(taskSummary.activeExecutionIds, ['execution-local']);
    assert.equal(taskSummary.defaultExecutionId, 'execution-local');
    assert.deepEqual(taskSummary.sessions, [{
      sessionId: 'session-local',
      requestedAt: '2026-07-23T01:01:00.000Z',
      executions: [{
        executionId: 'execution-local',
        sessionId: 'session-local',
        sourceCardId: 'child',
        kind: 'thread',
        phase: 'queued',
        queuePosition: 1,
        requestedAt: '2026-07-23T01:01:00.000Z',
        startedAt: null,
        finishedAt: null,
        model: null,
        effort: null,
        predecessorExecutionId: null,
        executorNodeId: 'workstation',
        revision: 2,
        error: null,
        artifacts: { jsonl: false, stderr: false, telemetry: false, result: false },
      }],
    }]);
    const ordinaryCardSummaryResponse = await fetch(`${baseUrl}/p/project-a/api/tasks/ordinary-card/execution-state`);
    assert.equal(ordinaryCardSummaryResponse.status, 200);
    assert.deepEqual(await ordinaryCardSummaryResponse.json(), {
      taskId: 'ordinary-card',
      activeExecutionIds: [],
      defaultExecutionId: null,
      sessions: [],
    });
    const presentationResponse = await fetch(`${baseUrl}/p/project-a/api/task-executions/execution-local`);
    const presentationText = await presentationResponse.text();
    assert.equal(presentationResponse.status, 200, presentationText);
    assert.match(presentationText, /"executionId":"execution-local"/);
    assert.match(presentationText, /"events":\[\]/);
    assert.doesNotMatch(presentationText, /stdoutFile|stderrFile|startLine|endLine|sourceLine/);
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { status: string; activeIncidentCount: number };
    assert.equal(health.status, 'ready');
    assert.equal(health.activeIncidentCount, 0);
    const cancelled = await fetch(`${baseUrl}/p/project-a/api/codex/skills/runs/session-local/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'tasks', cardId: 'child', executionId: 'execution-local' }),
    });
    const cancelledBody = await cancelled.json() as { ok: boolean; phase: string; executorNodeId: string };
    assert.equal(cancelled.status, 202);
    assert.equal(cancelledBody.ok, true);
    assert.equal(cancelledBody.phase, 'cancelled');
    assert.equal(cancelledBody.executorNodeId, 'workstation');
    const cancellationEvents = await readExecutionPhase('cancelled');
    assert.match(cancellationEvents, /"phase":"cancelled"/);
    assert.match(cancellationEvents, /"revision":3/);
  } finally {
    eventAbort.abort();
    await eventReader.cancel().catch(() => undefined);
    releaseCapacity();
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('server close cancels project-owned Codex retry timers', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-codex-timer-cleanup-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a', name: 'Project A' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [
      { id: 'master', title: 'Queued task', labels: ['master-task'] },
      {
        id: 'disconnect-master',
        title: 'Disconnected request task',
        labels: ['master-task'],
        assignment: { nodeId: 'workstation', changedAt: '2026-07-23T12:45:00.000Z', revision: 1 },
        comment: { contentFile: '.decision-os/cards/tasks/disconnect-master.md' },
      },
    ],
    annotations: [],
    relationships: [],
    threadFiles: { 'thread-disconnect-master': '.decision-os/threads/tasks/thread-disconnect-master.md' },
  }));
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'disconnect-master.md'), '# Disconnected request task\n');
  writeFileSync(join(decisionOsRoot, 'threads', 'tasks', 'thread-disconnect-master.md'), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-disconnect","timestamp":"2026-07-23T12:46:00.000Z"} -->',
    '',
    'Run after this request is admitted.',
    '',
  ].join('\n'));
  const durableState = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
    initialize: true,
  });
  await durableState.executions.admit({
    executorNodeId: 'phone',
    metadata: {
      executionId: 'execution-retained-on-close',
      requestId: 'request-retained-on-close',
      sessionId: 'session-retained-on-close',
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'master',
      sourceCardId: 'master',
      ownerCardId: 'master',
      kind: 'thread',
      requestedAt: '2026-07-23T12:45:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  });
  await durableState.executions.transition('execution-retained-on-close', { phase: 'queued' });
  await durableState.flush();
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    decisionOsSettings: { federationNodeId: 'workstation' },
  };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  let server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const releaseCapacity = await (runtime.acquireProjectSyncCodexSlot as () => Promise<() => void>)();
  let disconnectedStatus = 0;
  let disconnectedBody = '';
  const disconnectedRequest = httpRequest({
    host: '127.0.0.1',
    port: (server.address() as AddressInfo).port,
    path: '/api/codex/threads/process',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }, (incoming) => {
    disconnectedStatus = incoming.statusCode ?? 0;
    incoming.on('data', (chunk) => { disconnectedBody += chunk.toString('utf8'); });
  });
  disconnectedRequest.on('error', () => undefined);
  disconnectedRequest.end(JSON.stringify({
    ledgerId: 'tasks',
    threadId: 'thread-disconnect-master',
    cardId: 'disconnect-master',
    requestId: 'request-disconnected',
    executionId: 'execution-disconnected',
    reservedRunId: 'session-disconnected',
  }));
  const abortDeadline = Date.now() + 2_000;
  const abortPoll = setInterval(() => {
    const admitted = (runtime.taskExecutionState as typeof durableState).executions.find('execution-disconnected');
    if (!admitted && Date.now() < abortDeadline) return;
    clearInterval(abortPoll);
    disconnectedRequest.destroy(new Error('client_disconnected'));
  }, 1);
  abortPoll.unref?.();
  const disconnectDeadline = Date.now() + 2_000;
  while ((runtime.taskExecutionState as typeof durableState)
    .executions.find('execution-disconnected')?.lifecycle.phase !== 'queued'
    && Date.now() < disconnectDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const disconnectedPhase = (runtime.taskExecutionState as typeof durableState)
    .executions.find('execution-disconnected')?.lifecycle.phase;
  releaseCapacity();
  if (disconnectedPhase !== 'queued') {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
    assert.equal(disconnectedPhase, 'queued', `status=${disconnectedStatus} body=${disconnectedBody}`);
  }
  const holdCapacityUntilClose = await (runtime.acquireProjectSyncCodexSlot as () => Promise<() => void>)();
  const pendingCapacityWait = (runtime.acquireProjectSyncCodexSlot as () => Promise<() => void>)();
  let fired = false;
  scheduleCodexRuntimeTimer(runtime, 'test-close', 30, 'test-close', () => { fired = true; });
  server.close();
  await once(server, 'close');
  await assert.rejects(pendingCapacityWait, /codex_slot_wait_cancelled/);
  holdCapacityUntilClose();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(fired, false);
  const restartedRuntime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: restartedRuntime });
  server = restartedRuntime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const recovered = (restartedRuntime.taskExecutionState as typeof durableState).executions.find('execution-retained-on-close');
  assert.equal(recovered?.lifecycle.phase, 'queued');
  server.close();
  await once(server, 'close');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('Codex background failure pauses only project Codex work and remains diagnosable over HTTP', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-codex-background-failure-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    (runtime.onCodexBackgroundError as (event: Record<string, unknown>) => void)({
      operation: 'injected-codex-background-work',
      error: new Error('injected Codex background failure'),
      context: { runId: 'run-a' },
    });
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json() as { status: string; pausedBackgroundComponents: string[] };
    assert.equal(healthBody.status, 'degraded');
    assert.ok(healthBody.pausedBackgroundComponents.some((component) => component.startsWith('codex-runtime:')));
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    const start = await fetch(`${baseUrl}/api/codex/threads/process`, { method: 'POST', body: '{}' });
    assert.equal(start.status, 503);
    const startBody = await start.json() as { error: string; scope: string };
    assert.equal(startBody.error, 'runtime-scope-paused');
    assert.match(startBody.scope, /^background:codex-runtime:/);
    const incidentResponse = await fetch(`${baseUrl}/api/diagnostics/incidents`);
    assert.equal(incidentResponse.headers.get('cache-control'), 'no-store');
    const incidents = await incidentResponse.json() as {
      observedAt: string;
      incidentHistoryVersion: number;
      historyTruncatedBefore: string;
      incidents: Array<{ operation: string; message: string; observations: string[]; legacyHistoryBefore: string }>;
    };
    assert.equal(Number.isFinite(Date.parse(incidents.observedAt)), true);
    assert.equal(incidents.incidentHistoryVersion, 2);
    assert.equal(incidents.historyTruncatedBefore, '');
    assert.ok(incidents.incidents.some((incident) => incident.operation === 'injected-codex-background-work' && incident.message === 'injected Codex background failure'));
    const injectedIncident = incidents.incidents.find((incident) => incident.operation === 'injected-codex-background-work');
    assert.equal(injectedIncident?.observations.length, 1);
    assert.equal(Number.isFinite(Date.parse(String(injectedIncident?.observations[0]))), true);
    assert.equal(injectedIncident?.legacyHistoryBefore, '');
    const component = healthBody.pausedBackgroundComponents.find((entry) => entry.startsWith('codex-runtime:'));
    assert.ok(component);
    const resume = await fetch(`${baseUrl}/api/diagnostics/runtime/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: `background:${component}`,
        resolution: 'Loaded the corrected execution settlement contract.',
      }),
    });
    assert.equal(resume.status, 200);
    const resumedHealth = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { pausedBackgroundComponents: string[] };
    assert.equal(resumedHealth.pausedBackgroundComponents.includes(component), false);
    assert.notEqual((await fetch(`${baseUrl}/api/codex/threads/process`, { method: 'POST', body: '{}' })).status, 503);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('execution timeout settles as an execution-scoped diagnostic without pausing project Codex work', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-codex-execution-timeout-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    (runtime.onCodexBackgroundError as (event: Record<string, unknown>) => void)({
      operation: 'codex-execution-timeout',
      error: new Error('Codex execution exceeded 25ms.'),
      context: { runId: 'run-a', executionId: 'execution-a' },
    });
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { status: string; pausedBackgroundComponents: string[] };
    assert.equal(health.status, 'ready');
    assert.deepEqual(health.pausedBackgroundComponents, []);
    const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((response) => response.json()) as { incidents: Array<{ operation: string; scope: string; status: string }> };
    const timeout = incidents.incidents.find((incident) => incident.operation === 'codex-execution-timeout');
    assert.equal(timeout?.status, 'resolved');
    assert.match(timeout?.scope ?? '', /^codex-execution:.*:execution-a$/);
    const persisted = JSON.parse(readFileSync(join(decisionOsRoot, 'runtime-incidents.json'), 'utf8')) as {
      incidents: Array<{ operation: string; scope: string }>;
    };
    assert.ok(persisted.incidents.some((incident) => incident.operation === 'codex-execution-timeout'
      && /execution-a$/.test(incident.scope)));
    assert.equal((await fetch(`${baseUrl}/api/federation/nodes`)).status, 200);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('retired Codex process queue is inert and byte-identical while the server remains available', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-corrupt-codex-queue-server-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  const queueFile = join(decisionOsRoot, 'codex-process-queue.json');
  const corruptBytes = '{not-json';
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(frontendRoot + '/index.html', '<!doctype html>');
  writeFileSync(queueFile, corruptBytes);
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { status: string; pausedBackgroundComponents: string[] };
    assert.equal(health.status, 'ready');
    assert.deepEqual(health.pausedBackgroundComponents, []);
    const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((response) => response.json()) as { incidents: Array<{ operation: string; code: string; message: string }> };
    assert.equal(incidents.incidents.some((incident) => incident.operation === 'recover-durable-codex-process-queue'), false);
    assert.equal(readFileSync(queueFile, 'utf8'), corruptBytes);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('corrupt project synchronization store pauses only synchronization routes', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-corrupt-project-sync-server-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const frontendRoot = join(projectRoot, 'frontend');
  const syncDirectory = join(decisionOsRoot, 'project-sync');
  const syncFile = join(syncDirectory, 'runs.json');
  const corruptBytes = '{not-json';
  mkdirSync(syncDirectory, { recursive: true });
  mkdirSync(frontendRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  writeFileSync(syncFile, corruptBytes);
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    const sync = await fetch(`${baseUrl}/api/project-sync`);
    assert.equal(sync.status, 503);
    const syncBody = await sync.json() as { error: string; scope: string };
    assert.equal(syncBody.error, 'runtime-scope-paused');
    assert.equal(syncBody.scope, 'background:project-sync-store');
    const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((response) => response.json()) as { incidents: Array<{ operation: string; message: string }> };
    assert.ok(incidents.incidents.some((incident) => incident.operation === 'read-project-sync-store' && incident.message.includes('project-sync/runs.json')));
    assert.equal(readFileSync(syncFile, 'utf8'), corruptBytes);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
