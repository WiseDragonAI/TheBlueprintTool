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
  const diagnostics = await response.json() as Record<string, unknown>;
  assert.equal(diagnostics.status, 'degraded');
  assert.equal(diagnostics.launcherEmergency, true);
  assert.equal(diagnostics.startupPaused, true);
  const incidents = diagnostics.incidents as Array<Record<string, unknown>>;
  assert.equal(incidents[0]?.scope, 'server-launcher');
  assert.equal(incidents[0]?.code, 'server_child_exited');
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 503);
  const persisted = JSON.parse(readFileSync(resolve(workspace, '.decision-os/runtime-incidents.json'), 'utf8')) as { incidents: Array<{ id: string }> };
  assert.equal(persisted.incidents[0]?.id, incidents[0]?.id);
  assert.equal(child.exitCode, null, 'the launcher must remain alive while diagnostics are serving');
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
    writeFileSync(resolve(fixtureRepository, 'backend/tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext' } }));
    writeFileSync(resolve(fixtureRepository, 'backend/src/server.ts'), 'process.exitCode = 0;\n');
    const child = spawn(process.execPath, [resolve(fixtureRepository, 'bin/decision-os-server.mjs')], {
      cwd: workspace,
      env: { ...process.env, PORT: String(await freePort()), HOST: '127.0.0.1' },
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
