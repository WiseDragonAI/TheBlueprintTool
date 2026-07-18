/**
 * WHAT: Exercises the waiting-time-only Control Room queue on the served root route.
 * WHY: Legacy ranks and Queue gestures must never override the canonical waiting-time order.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
const queueArtifactSelector = '.queue-task-fallback, .queue-task-ghost, .queue-task-chosen, .queue-task-dragging';
const queueTaskSelector = '[data-control-column-list="queue"] > .control-task';

test('queue stays newest-first across legacy ranks, pointer, touch, refresh, and cancellation', { timeout: 60_000 }, async () => {
  const workspace = createQueueWorkspace();
  const server = await startDecisionOsServer(workspace.root);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', ...(process.platform === 'android' ? ['--no-zygote', '--single-process'] : [])],
    });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const pageErrors: string[] = [];
    const patchRequests: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => { if (request.method() === 'PATCH') patchRequests.push(request.url()); });
    await openQueue(page, server.url, pageErrors);
    await waitForOrder(page, ['Gamma', 'Beta', 'Alpha']);
    await dragWithMouse(page, 0, 2);
    await page.waitForTimeout(250);
    await waitForOrder(page, ['Gamma', 'Beta', 'Alpha']);
    assert.deepEqual(patchRequests, [], `in-Queue drag must not persist: ${JSON.stringify(pageErrors)}`);
    await assertCanonicalQueue(page, 3);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForOrder(page, ['Gamma', 'Beta', 'Alpha']);

    await beginMouseDrag(page, 0, 1);
    await page.waitForSelector('body > .queue-task-fallback');
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1, pointerType: 'mouse' })));
    await assertCanonicalQueue(page, 3);

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touchPage = await touchContext.newPage();
    await openQueue(touchPage, server.url);
    const beforeTouch = await queueOrder(touchPage);
    await dragWithTouch(touchPage, 0, 1);
    await touchPage.waitForTimeout(250);
    assert.deepEqual(await queueOrder(touchPage), beforeTouch);
    await assertCanonicalQueue(touchPage, 3);
    await touchContext.close();
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
    rmSync(workspace.root, { recursive: true, force: true });
  }
});

async function openQueue(page: Page, url: string, pageErrors: string[] = []): Promise<void> {
  await page.goto(`${url}/?tab=queue`, { waitUntil: 'domcontentloaded' });
  await page.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
  await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 3, queueTaskSelector, { timeout: 5_000 }).catch(async () => {
    const projection = await page.evaluate(() => fetch('/api/control-room').then((response) => response.json()));
    const errorText = await page.locator('#error-message').textContent().catch(() => '');
    const columns = await page.locator('.control-task-column').allTextContents();
    const filters = await page.locator('[aria-pressed="true"]').allTextContents();
    assert.fail(`Expected three Queue tasks, received ${await page.locator(queueTaskSelector).count()}; errors=${JSON.stringify(pageErrors)}; errorView=${JSON.stringify(errorText)}; columns=${JSON.stringify(columns)}; filters=${JSON.stringify(filters)}; projection=${JSON.stringify(projection.queue)}`);
  });
  await page.waitForFunction((selector) => {
    const list = document.querySelector(selector)?.parentElement;
    return Boolean(list && (globalThis as typeof globalThis & { Sortable?: { get(element: Element): unknown } }).Sortable?.get(list));
  }, queueTaskSelector);
}

async function beginMouseDrag(page: Page, from: number, to: number): Promise<void> {
  const source = await page.locator(queueTaskSelector).nth(from).boundingBox();
  const target = await page.locator(queueTaskSelector).nth(to).boundingBox();
  assert.ok(source && target);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
}

async function dragWithMouse(page: Page, from: number, to: number): Promise<void> {
  await beginMouseDrag(page, from, to);
  await page.mouse.up();
}

async function dragWithTouch(page: Page, from: number, to: number): Promise<void> {
  const source = await page.locator(queueTaskSelector).nth(from).boundingBox();
  const target = await page.locator(queueTaskSelector).nth(to).boundingBox();
  assert.ok(source && target);
  const session = await page.context().newCDPSession(page);
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
  await page.waitForTimeout(350);
  for (let step = 1; step <= 8; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 8, y: start.y + (end.y - start.y) * step / 8, id: 1 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function queueOrder(page: Page): Promise<string[]> {
  return page.locator(`${queueTaskSelector} strong`).allTextContents();
}

async function waitForOrder(page: Page, expected: string[]): Promise<void> {
  await page.waitForFunction(({ selector, order }) => JSON.stringify([...document.querySelectorAll(`${selector} strong`)].map((node) => node.textContent)) === JSON.stringify(order), { selector: queueTaskSelector, order: expected });
}

async function assertCanonicalQueue(page: Page, expectedRows: number): Promise<void> {
  await page.waitForFunction(({ artifactSelector, taskSelector, count }) => document.querySelectorAll(artifactSelector).length === 0 && document.querySelectorAll(taskSelector).length === count, { artifactSelector: queueArtifactSelector, taskSelector: queueTaskSelector, count: expectedRows });
  assert.equal(await page.locator('body > .control-task').count(), 0);
}

function createQueueWorkspace(): { root: string; cardsRoot: string } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-queue-browser-'));
  const decisionOsRoot = join(root, 'project-a', '.decision-os');
  const cardsRoot = join(decisionOsRoot, 'cards', 'tasks');
  mkdirSync(cardsRoot, { recursive: true });
  const cards = ['alpha', 'beta', 'gamma'].map((id, index) => ({
    id,
    title: id[0].toUpperCase() + id.slice(1),
    status: 'todo',
    labels: ['master-task'],
    x: 20 + index * 340,
    y: 20,
    w: 300,
    h: 200,
    comment: { contentFile: `.decision-os/cards/tasks/${id}.md` },
  }));
  for (const [index, card] of cards.entries()) {
    writeFileSync(join(cardsRoot, `${card.id}.md`), `## A. Goal\n\n1. Browser queue fixture.\n\nWaiting since: 2026-07-17T0${index + 1}:00:00.000Z\nQueue rank: ${index + 1}\n`);
  }
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  const ledgerFile = join(decisionOsRoot, 'tasks.json');
  writeFileSync(ledgerFile, JSON.stringify({ cards, annotations: [{ id: 'zone-a', x: 0, y: 0, width: 1200, height: 600, color: '#38d9e8' }], relationships: [], notes: {}, threadFiles: {} }));
  return { root, cardsRoot };
}

async function startDecisionOsServer(cwd: string): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd,
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
    return Boolean((await fetch(url, { method: 'HEAD' }).catch(() => undefined))?.ok);
  }, `Timed out waiting for Decision OS at ${url}`);
  return { process: child, url };
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) process.kill(-child.pid, 'SIGTERM');
  await Promise.race([new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())), delay(2_000)]);
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
  assert.fail(message);
}

const delay = (milliseconds: number) => new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
