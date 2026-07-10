/**
 * WHAT: Browser proof that the thread launcher exposes the Codex model and effort controls.
 * WHY: Operators must be able to configure a thread-started Codex run before launching it.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('The thread launcher exposes Codex model and effort controls.', async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(`${server.url}/tasks-system`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__coreState?.activeLedger?.cards?.length));

    await page.evaluate(async () => {
      const state = window.__coreState;
      const cardId = String(state.activeLedger.cards[0].id);
      state.threadId = `thread-${cardId}`;
      state.threadPanelOpen = true;
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      renderThreadPanel();
    });

    const selectors = page.locator('.thread-codex-select');
    await assert.doesNotReject(() => selectors.nth(1).waitFor({ state: 'visible' }));
    assert.equal(await selectors.count(), 2);
    assert.equal(await selectors.nth(0).getAttribute('aria-label'), 'Model for thread Codex');
    assert.equal(await selectors.nth(1).getAttribute('aria-label'), 'Effort for thread Codex');
    assert.equal(await selectors.nth(0).inputValue(), 'gpt-5.5');
    assert.equal(await selectors.nth(1).inputValue(), 'xhigh');

    await selectors.nth(0).selectOption('gpt-5.4');
    await selectors.nth(1).selectOption('high');
    const button = page.locator('[data-action="process-thread-codex"]');
    assert.equal(await button.getAttribute('data-codex-model'), 'gpt-5.4');
    assert.equal(await button.getAttribute('data-codex-effort'), 'high');

    const launcherFitsPanel = await page.evaluate(() => {
      const panel = document.querySelector('.thread-panel')?.getBoundingClientRect();
      const controls = [...document.querySelectorAll('.thread-actions > *')].map((element) => element.getBoundingClientRect());
      return Boolean(panel) && controls.every((control) => control.left >= panel.left && control.right <= panel.right);
    });
    assert.equal(launcherFitsPanel, true);
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  await waitFor(async () => {
    assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
    const response = await fetch(`${url}/tasks-system`, { method: 'HEAD' }).catch(() => undefined);
    return Boolean(response?.ok);
  }, `Timed out waiting for decision-os server at ${url}/tasks-system`);
  return { process: child, url };
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) process.kill(-child.pid, 'SIGTERM');
  await Promise.race([new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())), delay(2000)]);
  if (child.exitCode === null && child.signalCode === null && child.pid) process.kill(-child.pid, 'SIGKILL');
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

declare global {
  interface Window {
    __coreState: any;
  }
}
