/**
 * WHAT: Proves that one frontend reproduces the mobile application contract and expands it responsively on desktop.
 * WHY: Control Room and project workflows must not diverge into separate mobile and desktop implementations.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('The responsive application preserves the mobile Control Room and expands the same shell on desktop.', { timeout: 30_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = collectPageErrors(mobile);
    await mobile.goto(server.url, { waitUntil: 'domcontentloaded' });
    await mobile.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
    const mobileLayout = await mobile.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.ledger-nav');
      const tabs = document.querySelector<HTMLElement>('.control-tabs');
      return {
        visibleView: document.querySelector<HTMLElement>('main.content > :not([hidden])')?.id ?? '',
        navPosition: nav ? getComputedStyle(nav).position : '',
        navRight: nav?.getBoundingClientRect().right ?? 0,
        tabsPosition: tabs ? getComputedStyle(tabs).position : '',
        bodyWidth: document.body.scrollWidth,
        viewportWidth: innerWidth,
        tabCount: document.querySelectorAll('[data-control-tab]').length,
        newTaskCount: document.querySelectorAll('.new-task-button').length,
      };
    });
    assert.equal(mobileLayout.visibleView, 'control-room-view');
    assert.equal(mobileLayout.navPosition, 'fixed');
    assert.ok(mobileLayout.navRight <= 0);
    assert.equal(mobileLayout.tabsPosition, 'fixed');
    assert.equal(mobileLayout.bodyWidth, mobileLayout.viewportWidth);
    assert.equal(mobileLayout.tabCount, 3);
    assert.equal(mobileLayout.newTaskCount, 1);
    await mobile.getByRole('button', { name: 'Open navigation' }).click();
    await mobile.waitForFunction(() => document.body.classList.contains('menu-open'));
    assert.equal(await mobile.locator('.ledger-nav').getAttribute('aria-label'), 'Application navigation');
    const closeNavigation = mobile.locator('.ledger-nav').getByRole('button', { name: 'Close navigation' });
    assert.equal(await closeNavigation.isVisible(), true);
    await closeNavigation.click();
    await mobile.waitForFunction(() => !document.body.classList.contains('menu-open'));
    assert.deepEqual(mobileErrors, []);

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const desktopErrors = collectPageErrors(desktop);
    await desktop.goto(server.url, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
    const desktopLayout = await desktop.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.ledger-nav');
      const layout = document.querySelector<HTMLElement>('.layout');
      const tabs = document.querySelector<HTMLElement>('.control-tabs');
      const sticky = document.querySelector<HTMLElement>('.control-sticky');
      const navRect = nav?.getBoundingClientRect();
      return {
        visibleView: document.querySelector<HTMLElement>('main.content > :not([hidden])')?.id ?? '',
        navPosition: nav ? getComputedStyle(nav).position : '',
        navVisible: Boolean(navRect && navRect.left >= 0 && navRect.width >= 240),
        columns: layout ? getComputedStyle(layout).gridTemplateColumns : '',
        tabsPosition: tabs ? getComputedStyle(tabs).position : '',
        tabsInCommandHeader: Boolean(sticky && tabs && sticky.contains(tabs)),
        tabsBottomGap: tabs ? innerHeight - tabs.getBoundingClientRect().bottom : 0,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: innerWidth,
        mobileMenuVisible: document.querySelector<HTMLElement>('.menu-button') ? getComputedStyle(document.querySelector<HTMLElement>('.menu-button')!).display !== 'none' : true,
      };
    });
    assert.equal(desktopLayout.visibleView, 'control-room-view');
    assert.equal(desktopLayout.navPosition, 'sticky');
    assert.equal(desktopLayout.navVisible, true);
    assert.match(desktopLayout.columns, /^250px /);
    assert.equal(desktopLayout.tabsPosition, 'static');
    assert.equal(desktopLayout.tabsInCommandHeader, true);
    assert.ok(desktopLayout.tabsBottomGap > 300);
    assert.equal(desktopLayout.bodyWidth, desktopLayout.viewportWidth);
    assert.equal(desktopLayout.mobileMenuVisible, false);
    assert.deepEqual(desktopErrors, []);

    await mobile.goto(`${server.url}/projects`, { waitUntil: 'domcontentloaded' });
    await mobile.locator('#projects-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await mobile.getByRole('heading', { name: 'Projects' }).isVisible(), true);

    await desktop.locator('.ledger-nav').getByRole('link', { name: 'Projects' }).click();
    await desktop.waitForURL(`${server.url}/projects`);
    await desktop.waitForFunction(() => window.__coreState?.canvasMode === 'projects');
    assert.equal(await desktop.locator('.canvas').isVisible(), true);
    await desktop.getByRole('button', { name: 'Control Room' }).click();
    await desktop.waitForURL(`${server.url}/`);
    await desktop.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  await waitFor(async () => {
    assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
    const response = await fetch(url, { method: 'HEAD' }).catch(() => undefined);
    return Boolean(response?.ok);
  }, `Timed out waiting for decision-os server at ${url}`);
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
