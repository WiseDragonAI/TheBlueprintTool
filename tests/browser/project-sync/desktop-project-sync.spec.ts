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
const sourceProjectId = 'remote-only-project';
const sourceNodeId = 'mobile';

function catalogProject(name: string, originFingerprint: string) {
  return {
    id: sourceProjectId,
    name,
    description: 'A remote-only project source.',
    color: '#38d9e8',
    ledgers: [],
    available: true,
    replicaCount: 1,
    replicas: [{
      projectId: sourceProjectId,
      nodeId: sourceNodeId,
      nodeLabel: 'Mobile',
      online: true,
      local: false,
      available: true,
      originFingerprint,
    }],
  };
}

test('desktop Projects derives replica-bound Sync requests and contains stale settings clicks', { timeout: 30_000 }, async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DECISION_OS_FRONTEND_ROOT: resolve(repoRoot, 'frontend'),
      TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json'),
    },
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
    page.on('console', (message) => output.push(`browser console: ${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => output.push(`browser error: ${error.message}`));
    let catalogProjects = [catalogProject('Remote source without identity', ' ')];
    const syncRequests: Array<Record<string, unknown>> = [];
    await page.route(`${url}/decision-os/projects`, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ projects: catalogProjects }) });
    });
    await page.route(`${url}/api/project-sync`, async (route) => {
      syncRequests.push(JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          duplicate: false,
          masterCardId: '',
          ledgerId: '',
          pipelineRunId: '',
          projectId: sourceProjectId,
          run: { syncId: 'sync-remote', phase: 'requested', sourceProjectId },
        }),
      });
    });
    await page.goto(`${url}/projects`, { waitUntil: 'domcontentloaded' });
    await page.locator('#projects-view:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => ({
        path: location.pathname,
        bodyClass: document.body.className,
        projectsView: document.querySelector('#projects-view')?.outerHTML.slice(0, 500),
        errorView: document.querySelector('#error-view')?.outerHTML.slice(0, 500),
      }));
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${JSON.stringify(diagnostic)}\n${output.join('')}`);
    });
    assert.equal(await page.locator('.canvas').count(), 0);
    await page.locator('.project-card:not(:disabled)').first().click();
    const modal = page.locator('.project-settings-modal[open]');
    await modal.waitFor({ state: 'visible' });
    const sync = modal.getByRole('button', { name: 'Synchronize project' });
    assert.equal(await sync.isVisible(), true);
    assert.equal(await sync.isDisabled(), true);
    await modal.getByRole('button', { name: 'Cancel' }).click();

    catalogProjects = [catalogProject('Remote source ready', ' remote-fingerprint ')];
    await page.goto(`${url}/projects/${sourceProjectId}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#project-detail-view:not([hidden])').waitFor({ state: 'visible' });
    const settings = page.getByRole('button', { name: 'Settings', exact: true });
    assert.equal(await settings.isVisible(), true);
    await settings.click();
    await modal.waitFor({ state: 'visible' });
    assert.equal(await sync.isDisabled(), false);

    catalogProjects = [catalogProject('Remote source became unavailable', ' ')];
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
    await page.waitForFunction(() => document.querySelector('#project-detail-name')?.textContent === 'Remote source became unavailable');
    await sync.click();
    await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('.project-settings-sync')?.disabled === true);
    assert.deepEqual(syncRequests, []);
    await modal.getByRole('button', { name: 'Cancel' }).click();

    catalogProjects = [catalogProject('Remote source ready again', ' remote-fingerprint ')];
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
    await page.waitForFunction(() => document.querySelector('#project-detail-name')?.textContent === 'Remote source ready again');
    await settings.click();
    await modal.waitFor({ state: 'visible' });
    await sync.click();
    await page.waitForFunction(() => !document.querySelector<HTMLDialogElement>('.project-settings-modal')?.open);
    assert.deepEqual(syncRequests, [{
      sourceProjectId,
      sourceNodeId,
      idempotencyKey: 'mobile:remote-only-project:remote-fingerprint',
    }]);

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
