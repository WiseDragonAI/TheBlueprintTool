/**
 * WHAT: Exercises local directory selection and project initialization through the served project modal.
 * WHY: Static request assertions do not prove directory navigation, selection, submission, and filesystem results work together.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('project creation follows a catalog symlink and initializes its external target', { timeout: 45_000 }, async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-project-directory-browser-'));
  const externalWorkspace = mkdtempSync(join(tmpdir(), 'decision-os-project-directory-target-'));
  const sourceDirectory = join(externalWorkspace, 'Ardaria_57');
  const linkedDirectory = join(workspace, 'Ardaria_57');
  mkdirSync(join(sourceDirectory, 'Nested Folder'), { recursive: true });
  writeFileSync(join(sourceDirectory, 'README.md'), '# Existing source\n');
  symlinkSync(sourceDirectory, linkedDirectory);
  let server: { process: ChildProcess; url: string } | undefined;
  let browser: Browser | undefined;
  try {
    server = await startDecisionOsServer(workspace);
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${server.url}/projects`, { waitUntil: 'domcontentloaded' });
    await page.locator('#projects-view:not([hidden])').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: '+ Project', exact: true }).click();
    const modal = page.locator('.creation-modal[open]');
    await modal.waitFor({ state: 'visible' });
    assert.equal(await modal.getByRole('heading', { name: 'New project', exact: true }).isVisible(), true);
    await modal.getByRole('button', { name: 'Browse', exact: true }).click();
    const directoryBrowser = modal.getByRole('region', { name: 'Project directory browser', exact: true });
    await directoryBrowser.waitFor({ state: 'visible' });
    const sourceTreeItem = directoryBrowser.locator('.creation-directory-treeitem[data-path="Ardaria_57"]');
    await sourceTreeItem.waitFor({ state: 'visible' });
    assert.equal(await sourceTreeItem.evaluate((element) => element.tagName), 'DIV');
    assert.equal(await sourceTreeItem.locator(':scope > .creation-directory-row').evaluate((element) => getComputedStyle(element).height), '28px');
    assert.equal(await sourceTreeItem.getByLabel('Symbolic link', { exact: true }).isVisible(), true);
    await sourceTreeItem.getByRole('button', { name: 'Expand Ardaria_57', exact: true }).click();
    await directoryBrowser.locator('.creation-directory-treeitem[data-path="Ardaria_57/Nested Folder"]').waitFor({ state: 'visible' });
    assert.equal(await sourceTreeItem.getAttribute('aria-expanded'), 'true');
    await sourceTreeItem.locator(':scope > .creation-directory-row').click();
    assert.equal(await sourceTreeItem.getAttribute('aria-selected'), 'true');

    assert.equal(await modal.getByLabel('Project directory', { exact: true }).inputValue(), linkedDirectory);
    assert.equal(await modal.getByLabel('Name', { exact: true }).inputValue(), 'Ardaria_57');
    await modal.getByLabel('Description (optional)', { exact: true }).fill('Selected existing source');
    await modal.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9_-]+$/);
    await page.locator('#project-detail-view:not([hidden])').waitFor({ state: 'visible' });

    assert.equal(await page.locator('#project-detail-name').textContent(), 'Ardaria_57');
    assert.equal(readFileSync(join(sourceDirectory, 'README.md'), 'utf8'), '# Existing source\n');
    assert.equal(existsSync(join(sourceDirectory, '.git')), true);
    assert.equal(existsSync(join(sourceDirectory, '.decision-os', 'state.json')), true);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    if (server) await stopDecisionOsServer(server.process);
    rmSync(workspace, { recursive: true, force: true });
    rmSync(externalWorkspace, { recursive: true, force: true });
  }
});

async function startDecisionOsServer(workspace: string): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: workspace,
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
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  await waitFor(async () => {
    assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
    return Boolean(await fetch(url, { method: 'HEAD' }).catch(() => undefined));
  }, `Timed out waiting for decision-os server at ${url}`);
  return { process: child, url };
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) process.kill(-child.pid, 'SIGTERM');
  await Promise.race([new Promise<void>((resolveExit) => child.once('exit', resolveExit)), delay(2000)]);
  if (child.exitCode === null && child.signalCode === null && child.pid) process.kill(-child.pid, 'SIGKILL');
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolveClose) => server.close(resolveClose));
  return address.port;
}

async function waitFor(check: () => Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
