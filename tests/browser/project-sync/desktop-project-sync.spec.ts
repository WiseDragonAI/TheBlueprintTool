import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('desktop Projects opens node-aware settings while zoom-out retains the projects canvas', { timeout: 30_000 }, async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  server.stdout?.on('data', (chunk) => output.push(String(chunk)));
  server.stderr?.on('data', (chunk) => output.push(String(chunk)));
  await waitFor(async () => {
    assert.equal(server.exitCode, null, output.join(''));
    return Boolean(await fetch(url, { method: 'HEAD' }).catch(() => null));
  });
  const chromiumExecutablePath = '/snap/bin/chromium';
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(`${url}/projects`, { waitUntil: 'domcontentloaded' });
    await page.locator('#projects-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.canvas').count(), 0);
    await page.locator('.project-card:not(:disabled)').first().click();
    const modal = page.locator('.project-settings-modal[open]');
    await modal.waitFor({ state: 'visible' });
    assert.equal(await modal.getByRole('button', { name: 'Synchronize project' }).isVisible(), true);
    assert.match(await modal.locator('.project-settings-owner').textContent() ?? '', /Online/);
    await modal.getByRole('button', { name: 'Cancel' }).click();

    await page.goto(`${url}/projects-canvas`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__coreState?.canvasMode === 'projects');
    assert.equal(await page.locator('.canvas').isVisible(), true);
  } finally {
    await browser?.close();
    await stop(server);
  }
});

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  server.close();
  await once(server, 'close');
  return address.port;
}

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error('Timed out waiting for the isolated Decision OS test server.');
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) process.kill(-child.pid, 'SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000))]);
  if (child.exitCode === null && child.signalCode === null && child.pid) process.kill(-child.pid, 'SIGKILL');
}

declare global {
  interface Window { __coreState?: { canvasMode?: string } }
}
