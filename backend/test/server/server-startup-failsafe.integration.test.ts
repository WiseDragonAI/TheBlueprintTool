import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const releaseSha = 'a'.repeat(40);

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

test('malformed startup settings keep an emergency diagnostics server online', async (context) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-startup-failsafe-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const settingsFile = resolve(decisionOsRoot, '.settings.json');
  writeFileSync(settingsFile, '{invalid-json');
  const port = await freePort();
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const child = spawn(process.execPath, [
    '--import', resolve(repositoryRoot, 'backend/node_modules/tsx/dist/esm/index.mjs'),
    resolve(repositoryRoot, 'backend/src/server.ts'),
  ], {
    cwd: workspace,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      TSX_TSCONFIG_PATH: resolve(repositoryRoot, 'backend/tsconfig.json'),
      DECISION_OS_REPOSITORY_SETTINGS_FILE: settingsFile,
      DECISION_OS_RELEASE_SHA: releaseSha,
      DECISION_OS_PROCESS_STARTED_AT: '2026-07-28T00:00:00.000Z',
      DECISION_OS_DELIVERY_PROTOCOL: '1',
      DECISION_OS_ACTIVE_RELEASE_POINTER: `current:${releaseSha}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  context.after(async () => {
    const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
    child.kill('SIGTERM');
    await Promise.race([
      exited,
      new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
    ]);
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
  assert.ok(response, `Emergency server did not listen. Output: ${output}`);
  assert.equal(response.status, 200);
  const diagnostics = await response.json() as Record<string, unknown>;
  assert.equal(diagnostics.status, 'degraded');
  assert.equal(diagnostics.startupPaused, true);
  assert.equal(diagnostics.releaseSha, releaseSha);
  assert.equal(diagnostics.processStartedAt, '2026-07-28T00:00:00.000Z');
  assert.equal(diagnostics.deliveryProtocol, 1);
  assert.equal(diagnostics.activeReleasePointer, `current:${releaseSha}`);
  const incidents = diagnostics.incidents as Array<Record<string, unknown>>;
  assert.equal(incidents[0]?.scope, 'server-startup');
  assert.match(String(incidents[0]?.message), /JSON/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 503);
  assert.equal(JSON.parse(readFileSync(resolve(decisionOsRoot, 'runtime-incidents.json'), 'utf8')).incidents[0].scope, 'server-startup');
});
