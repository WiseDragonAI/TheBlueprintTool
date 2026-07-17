/**
 * WHAT: Exercises the complete Control Room queue drag lifecycle on the served root route.
 * WHY: Sortable fallback nodes and live refreshes must never leave duplicate or detached tasks.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
const queueArtifactSelector = '.queue-task-fallback, .queue-task-ghost, .queue-task-chosen, .queue-task-dragging';

test('queue reorder stays atomic across pointer, touch, refresh, cancellation, success, and rejection', { timeout: 60_000 }, async () => {
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
    await openQueue(page, server.url);
    const projectId = await page.locator('.control-task').first().evaluate((row) => decodeURIComponent(String((row as HTMLElement).dataset.taskId).split('--')[0]));

    let releasePersistence!: () => void;
    const persistenceGate = new Promise<void>((resolveGate) => { releasePersistence = resolveGate; });
    let heldMutations = 0;
    await page.route('**/decision-os/tasks', async (route) => {
      if (!isQueueRankMutation(route.request())) return route.continue();
      heldMutations += 1;
      await persistenceGate;
      await route.continue();
    });
    await dragWithMouse(page, 0, 2);
    await waitForOrder(page, ['Beta', 'Gamma', 'Alpha']);
    await waitFor(async () => heldMutations === 1, 'Timed out waiting for the held queue-rank mutation.').catch(() => {
      assert.fail(`Queue persistence did not start. PATCH requests: ${JSON.stringify(patchRequests)}. Page errors: ${JSON.stringify(pageErrors)}.`);
    });
    assert.equal(heldMutations, 1, 'optimistic order must render before the first sequential persistence request resolves');
    releasePersistence();
    await waitForPersistedRanks(workspace.cardsRoot, { alpha: 3, beta: 1, gamma: 2 });
    await page.unroute('**/decision-os/tasks');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForOrder(page, ['Beta', 'Gamma', 'Alpha']);
    await assertCanonicalQueue(page, 3);

    await page.route('**/decision-os/tasks', async (route) => {
      if (!isQueueRankMutation(route.request())) return route.continue();
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced rejection' }) });
    });
    await dragWithMouse(page, 0, 2);
    await page.locator('#error-view:not([hidden])').waitFor({ state: 'visible' });
    await waitForOrder(page, ['Beta', 'Gamma', 'Alpha']);
    await assertCanonicalQueue(page, 3);
    await page.unroute('**/decision-os/tasks');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForOrder(page, ['Beta', 'Gamma', 'Alpha']);

    await beginMouseDrag(page, 0, 1);
    await page.waitForSelector('body > .queue-task-fallback');
    const titleMutation = fetch(`${server.url}/p/${encodeURIComponent(projectId)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'gamma', title: 'Gamma refreshed' } }),
    });
    assert.equal((await titleMutation).ok, true);
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#control-task-list > .control-task').count(), 3, 'live refresh must not remount the queue during a drag');
    await page.mouse.up();
    await page.getByText('Gamma refreshed', { exact: true }).waitFor();
    await assertCanonicalQueue(page, 3);

    await beginMouseDrag(page, 0, 1);
    await page.waitForSelector('body > .queue-task-fallback');
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1, pointerType: 'mouse' })));
    await assertCanonicalQueue(page, 3);

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touchPage = await touchContext.newPage();
    await openQueue(touchPage, server.url);
    const beforeTouch = await queueOrder(touchPage);
    await dragWithTouch(touchPage, 0, 1);
    await touchPage.waitForFunction((before) => JSON.stringify([...document.querySelectorAll('.control-task strong')].map((node) => node.textContent)) !== JSON.stringify(before), beforeTouch);
    await assertCanonicalQueue(touchPage, 3);
    await touchContext.close();
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
    rmSync(workspace.root, { recursive: true, force: true });
  }
});

async function openQueue(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('.control-task').length === 3);
}

async function beginMouseDrag(page: Page, from: number, to: number): Promise<void> {
  const source = await page.locator('.control-task').nth(from).boundingBox();
  const target = await page.locator('.control-task').nth(to).boundingBox();
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
  const source = await page.locator('.control-task').nth(from).boundingBox();
  const target = await page.locator('.control-task').nth(to).boundingBox();
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
  return page.locator('.control-task strong').allTextContents();
}

async function waitForOrder(page: Page, expected: string[]): Promise<void> {
  await page.waitForFunction((order) => JSON.stringify([...document.querySelectorAll('.control-task strong')].map((node) => node.textContent)) === JSON.stringify(order), expected);
}

async function assertCanonicalQueue(page: Page, expectedRows: number): Promise<void> {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === 0 && document.querySelectorAll('#control-task-list > .control-task').length === count, { selector: queueArtifactSelector, count: expectedRows });
  assert.equal(await page.locator('body > .control-task').count(), 0);
}

function isQueueRankMutation(request: { method(): string; postDataJSON(): unknown }): boolean {
  if (request.method() !== 'PATCH') return false;
  const body = request.postDataJSON() as { action?: string; cardPatch?: { queueRank?: number } };
  return body.action === 'patch-card' && Number.isInteger(body.cardPatch?.queueRank);
}

async function waitForPersistedRanks(cardsRoot: string, expected: Record<string, number>): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (Object.entries(expected).every(([id, rank]) => new RegExp(`^Queue rank: ${rank}$`, 'm').test(readFileSync(join(cardsRoot, `${id}.md`), 'utf8')))) return;
    await delay(50);
  }
  assert.fail('Timed out waiting for persisted queue ranks.');
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
