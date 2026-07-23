/**
 * WHAT: Unit test for implemented function create-http-server.
 * WHY: each generated function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { createRuntimeIncidentLedger } from '@backend/business/server/helper/runtime-incident-ledger.js';
import { scheduleCodexRuntimeTimer } from '@backend/business/codex/helper/codex-runtime-run-store.js';
import { createTaskExecutionLaunchRequest, type TaskExecutionRouter } from '@backend/business/codex/helper/task-execution-router.js';
import { createProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';

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
    cards: [{
      id: 'master',
      title: 'Local task',
      status: 'todo',
      labels: ['master-task'],
      assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 },
    }],
    annotations: [],
    relationships: [],
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
      sourceCardId: 'master',
      requestedAt: '2026-07-23T01:01:00.000Z',
    }));
    assert.equal(admitted.phase, 'queued');
    assert.equal(admitted.executorNodeId, 'workstation');
    const admittedEvents = await readExecutionRevision(2);
    assert.match(admittedEvents, /event: codex-execution-change/);
    assert.match(admittedEvents, /"phase":"preparing"/);
    assert.match(admittedEvents, /"phase":"queued"/);
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { status: string; activeIncidentCount: number };
    assert.equal(health.status, 'ready');
    assert.equal(health.activeIncidentCount, 0);
    const cancelled = await fetch(`${baseUrl}/p/project-a/api/codex/skills/runs/session-local/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'tasks', cardId: 'master', executionId: 'execution-local' }),
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
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html>');
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', decisionOsFrontendRoot: frontendRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  let fired = false;
  scheduleCodexRuntimeTimer(runtime, 'test-close', 30, 'test-close', () => { fired = true; });
  server.close();
  await once(server, 'close');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(fired, false);
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
    const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((response) => response.json()) as { incidents: Array<{ operation: string; message: string }> };
    assert.ok(incidents.incidents.some((incident) => incident.operation === 'injected-codex-background-work' && incident.message === 'injected Codex background failure'));
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
