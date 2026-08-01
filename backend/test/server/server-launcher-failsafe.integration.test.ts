/**
 * WHAT: Verifies the JavaScript launcher keeps diagnostics online when its TypeScript child cannot run.
 * WHY: Loader and import failures happen before the backend can establish its own fault boundary.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const releaseSha = 'a'.repeat(40);
const retainedIncidentAt = new Date(Date.now() - 60_000).toISOString();
const retainedIncidentResolvedAt = new Date(Date.now() - 30_000).toISOString();

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

test('launcher serves durable diagnostics after its server child exits', async (context) => {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const fixtureRepository = mkdtempSync(resolve(tmpdir(), 'decision-os-launcher-repository-'));
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-launcher-workspace-'));
  mkdirSync(resolve(fixtureRepository, 'bin'), { recursive: true });
  mkdirSync(resolve(fixtureRepository, 'backend/src'), { recursive: true });
  mkdirSync(resolve(workspace, '.decision-os'), { recursive: true });
  writeFileSync(resolve(workspace, '.decision-os/runtime-incidents.json'), `${JSON.stringify({
    version: 1,
    updatedAt: retainedIncidentAt,
    incidents: [{
      id: 'legacy-resolved',
      fingerprint: 'legacy-resolved-fingerprint',
      status: 'resolved',
      severity: 'error',
      scope: 'project:legacy',
      component: 'legacy-component',
      operation: 'legacy-operation',
      code: 'legacy_failure',
      message: 'Legacy resolved evidence.',
      stack: '',
      context: { projectId: 'legacy' },
      firstObservedAt: retainedIncidentAt,
      lastObservedAt: retainedIncidentAt,
      occurrences: 2,
      resolvedAt: retainedIncidentResolvedAt,
    }],
  }, null, 2)}\n`);
  const releaseRoot = resolve(workspace, '.decision-os', 'delivery');
  const releasePath = resolve(releaseRoot, 'releases', releaseSha);
  const currentPointer = resolve(releaseRoot, 'current');
  mkdirSync(releasePath, { recursive: true });
  writeFileSync(resolve(fixtureRepository, '.decision-os-release.json'), `${JSON.stringify({ protocol: 1, releaseSha })}\n`);
  writeFileSync(resolve(releasePath, '.decision-os-release.json'), `${JSON.stringify({ protocol: 1, releaseSha })}\n`);
  symlinkSync(`releases/${releaseSha}`, currentPointer);
  writeFileSync(resolve(workspace, '.decision-os', '.settings.json'), `${JSON.stringify({
    deliveryProtocol: 1,
    deliveryCurrentPointer: currentPointer,
  })}\n`);
  copyFileSync(resolve(repositoryRoot, 'bin/decision-os-server.mjs'), resolve(fixtureRepository, 'bin/decision-os-server.mjs'));
  copyFileSync(resolve(repositoryRoot, 'bin/decision-os-launcher-emergency.mjs'), resolve(fixtureRepository, 'bin/decision-os-launcher-emergency.mjs'));
  symlinkSync(resolve(repositoryRoot, 'backend/node_modules'), resolve(fixtureRepository, 'backend/node_modules'), 'dir');
  writeFileSync(resolve(fixtureRepository, 'backend/tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext' } }));
  writeFileSync(resolve(fixtureRepository, 'backend/src/server.ts'), 'process.exitCode = 17;\n');
  const port = await freePort();
  const child = spawn(process.execPath, [resolve(fixtureRepository, 'bin/decision-os-server.mjs')], {
    cwd: workspace,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  context.after(async () => {
    const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
    child.kill('SIGTERM');
    await Promise.race([exited, new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 2_000))]);
    rmSync(fixtureRepository, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/diagnostics/incidents`);
      break;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    }
  }
  assert.ok(response, `Launcher emergency server did not listen. Output: ${output}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const diagnostics = await response.json() as Record<string, unknown>;
  assert.equal(diagnostics.status, 'degraded');
  assert.equal(diagnostics.launcherEmergency, true);
  assert.equal(diagnostics.startupPaused, true);
  assert.equal(diagnostics.releaseSha, releaseSha);
  assert.equal(diagnostics.deliveryProtocol, 1);
  assert.equal(diagnostics.activeReleasePointer, `current:${releaseSha}`);
  assert.equal(Number.isFinite(Date.parse(String(diagnostics.observedAt))), true);
  assert.equal(diagnostics.incidentHistoryVersion, 2);
  assert.equal(diagnostics.historyTruncatedBefore, '');
  assert.equal(Number.isFinite(Date.parse(String(diagnostics.processStartedAt))), true);
  const incidents = diagnostics.incidents as Array<Record<string, unknown>>;
  const launcherIncident = incidents.find((entry) => entry.scope === 'server-launcher');
  assert.equal(launcherIncident?.code, 'server_child_exited');
  assert.equal((launcherIncident?.context as Record<string, unknown>)?.restartAttempts, 3);
  assert.deepEqual((launcherIncident?.context as Record<string, unknown>)?.restartDelaysMs, [100, 200, 400]);
  assert.equal((launcherIncident?.observations as string[]).length, 1);
  assert.equal(Number.isFinite(Date.parse(String((launcherIncident?.observations as string[])[0]))), true);
  const legacyIncident = incidents.find((entry) => entry.id === 'legacy-resolved');
  assert.equal(legacyIncident?.status, 'resolved');
  assert.deepEqual(legacyIncident?.observations, [retainedIncidentAt]);
  assert.equal(legacyIncident?.legacyHistoryBefore, retainedIncidentAt);
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 503);
  const persisted = JSON.parse(readFileSync(resolve(workspace, '.decision-os/runtime-incidents.json'), 'utf8')) as { version: number; incidents: Array<{ id: string }> };
  assert.equal(persisted.version, 2);
  assert.equal(persisted.incidents.find((entry) => entry.id === launcherIncident?.id)?.id, launcherIncident?.id);
  assert.equal(child.exitCode, null, 'the launcher must remain alive while diagnostics are serving');
});

test('launcher restarts one transiently failed child before opening emergency mode', async (context) => {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const fixtureRepository = mkdtempSync(resolve(tmpdir(), 'decision-os-launcher-restart-repository-'));
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-launcher-restart-workspace-'));
  mkdirSync(resolve(fixtureRepository, 'bin'), { recursive: true });
  mkdirSync(resolve(fixtureRepository, 'backend/src'), { recursive: true });
  mkdirSync(resolve(workspace, '.decision-os'), { recursive: true });
  copyFileSync(resolve(repositoryRoot, 'bin/decision-os-server.mjs'), resolve(fixtureRepository, 'bin/decision-os-server.mjs'));
  copyFileSync(resolve(repositoryRoot, 'bin/decision-os-launcher-emergency.mjs'), resolve(fixtureRepository, 'bin/decision-os-launcher-emergency.mjs'));
  symlinkSync(resolve(repositoryRoot, 'backend/node_modules'), resolve(fixtureRepository, 'backend/node_modules'), 'dir');
  writeFileSync(resolve(fixtureRepository, 'backend/tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext' } }));
  writeFileSync(
    resolve(fixtureRepository, 'backend/src/server.ts'),
    "import { readFileSync, writeFileSync } from 'node:fs';\n"
      + "import { createServer } from 'node:http';\n"
      + "import { resolve } from 'node:path';\n"
      + "const file = resolve(process.cwd(), '.decision-os', 'launcher-attempts');\n"
      + "let attempt = 0; try { attempt = Number(readFileSync(file, 'utf8')); } catch {}\n"
      + "attempt += 1; writeFileSync(file, String(attempt));\n"
      + "if (attempt === 1) process.exit(17);\n"
      + "createServer((_request, response) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ ok: true, attempt })); }).listen(Number(process.env.PORT), String(process.env.HOST));\n",
  );
  const port = await freePort();
  const child = spawn(process.execPath, [resolve(fixtureRepository, 'bin/decision-os-server.mjs')], {
    cwd: workspace,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DECISION_OS_LAUNCHER_MAX_RESTARTS: '2',
      DECISION_OS_LAUNCHER_RESTART_DELAY_MS: '10',
      DECISION_OS_LAUNCHER_STABILITY_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
      child.kill('SIGTERM');
      await Promise.race([exited, new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 2_000))]);
    }
    rmSync(fixtureRepository, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  });

  let health: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) health = await response.json() as Record<string, unknown>;
      if (health) break;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
    }
  }
  assert.deepEqual(health, { ok: true, attempt: 2 });
  assert.equal(readFileSync(resolve(workspace, '.decision-os', 'launcher-attempts'), 'utf8'), '2');
  assert.throws(() => readFileSync(resolve(workspace, '.decision-os/runtime-incidents.json'), 'utf8'));
});

test('launcher preserves an intentional zero-code server restart exit', async () => {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const fixtureRepository = mkdtempSync(resolve(tmpdir(), 'decision-os-launcher-zero-repository-'));
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-launcher-zero-workspace-'));
  try {
    mkdirSync(resolve(fixtureRepository, 'bin'), { recursive: true });
    mkdirSync(resolve(fixtureRepository, 'backend/src'), { recursive: true });
    mkdirSync(resolve(workspace, '.decision-os'), { recursive: true });
    copyFileSync(resolve(repositoryRoot, 'bin/decision-os-server.mjs'), resolve(fixtureRepository, 'bin/decision-os-server.mjs'));
    copyFileSync(resolve(repositoryRoot, 'bin/decision-os-launcher-emergency.mjs'), resolve(fixtureRepository, 'bin/decision-os-launcher-emergency.mjs'));
    symlinkSync(resolve(repositoryRoot, 'backend/node_modules'), resolve(fixtureRepository, 'backend/node_modules'), 'dir');
    writeFileSync(resolve(fixtureRepository, 'backend/tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        paths: { '@backend/*': ['./src/*'] },
      },
    }));
    writeFileSync(resolve(fixtureRepository, 'backend/src/launcher-module-owner.ts'), 'export const launcherModuleOwner = "fixture-repository";\n');
    writeFileSync(
      resolve(fixtureRepository, 'backend/src/server.ts'),
      'import { launcherModuleOwner } from "@backend/launcher-module-owner.js";\n'
        + 'if (launcherModuleOwner !== "fixture-repository") throw new Error("wrong launcher module owner");\n'
        + 'process.exitCode = 0;\n',
    );
    const child = spawn(process.execPath, [resolve(fixtureRepository, 'bin/decision-os-server.mjs')], {
      cwd: workspace,
      env: {
        ...process.env,
        PORT: String(await freePort()),
        HOST: '127.0.0.1',
        TSX_TSCONFIG_PATH: resolve(repositoryRoot, 'backend/tsconfig.json'),
      },
      stdio: 'ignore',
    });
    const [code, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolveExit) => child.once('exit', (exitCode, exitSignal) => resolveExit([exitCode, exitSignal])));
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.throws(() => readFileSync(resolve(workspace, '.decision-os/runtime-incidents.json'), 'utf8'));
  } finally {
    rmSync(fixtureRepository, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});
