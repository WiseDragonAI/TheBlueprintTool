/**
 * WHAT: Proves that populated Control Room columns retain independent in-memory scroll positions.
 * WHY: Live refreshes and task-detail navigation remount the column nodes during one application session.
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
import { migrateTaskCurrentState } from '../../../backend/src/business/task-state/helper/task-current-state-migration.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
const columnSelector = (column: string) => `[data-control-column-list="${column}"]`;

test('column scroll survives task refresh, in-app task return, and browser back', { timeout: 60_000 }, async () => {
  const workspace = createScrollWorkspace();
  let server: Awaited<ReturnType<typeof startDecisionOsServer>> | undefined;
  let browser: Browser | undefined;
  try {
    // WHAT: Install the fixture through the same epoch-3 cutover required by server bootstrap.
    // WHY: A nonempty legacy tasks ledger is intentionally rejected as runtime authority.
    await migrateTaskCurrentState({
      decisionOsRoot: workspace.decisionOsRoot,
      projectId: workspace.projectId,
      nodeId: 'browser-test',
      tasksLedgerFile: workspace.tasksLedgerFile,
      backupRoot: join(workspace.root, '.task-state-migration-backup'),
    });
    server = await startDecisionOsServer(workspace.root);
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', ...(process.platform === 'android' ? ['--no-zygote', '--single-process'] : [])],
    });
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    await openControlRoom(page, server.url);

    const initial = await setColumnScroll(page, { queue: 210, backlog: 450 });
    assert.ok(initial.queue > 0 && initial.exec === 0 && initial.backlog > initial.queue, JSON.stringify(initial));

    const queueOnly = await setColumnScroll(page, { queue: 280 });
    assert.equal(queueOnly.exec, initial.exec);
    assert.equal(queueOnly.backlog, initial.backlog);

    await page.evaluate(() => {
      const activeTab = document.querySelector<HTMLButtonElement>('[data-control-tab="queue"]');
      activeTab?.click();
      activeTab?.click();
    });
    await assertColumnScroll(page, queueOnly);

    await page.waitForTimeout(250);
    const projectId = await page.locator(`${columnSelector('queue')} .control-task`).first().evaluate((row) => decodeURIComponent(String((row as HTMLElement).dataset.taskId).split('--')[0]));
    const rename = await fetch(`${server.url}/p/${encodeURIComponent(projectId)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'queue-17', title: 'Queue 17 refreshed' } }),
    });
    const renamePayload = await rename.json() as { ok?: boolean; changedCard?: { id?: string; title?: string; status?: string } };
    assert.equal(rename.ok, true, JSON.stringify(renamePayload));
    assert.deepEqual(renamePayload.changedCard && { id: renamePayload.changedCard.id, title: renamePayload.changedCard.title, status: renamePayload.changedCard.status }, { id: 'queue-17', title: 'Queue 17 refreshed', status: 'todo' });
    const transition = await fetch(`${server.url}/p/${encodeURIComponent(projectId)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'transition-card-lifecycle', cardId: 'queue-17', lifecycleStatus: 'backlog' }),
    });
    const transitionPayload = await transition.json() as { ok?: boolean; changedCard?: { id?: string; title?: string; status?: string } };
    assert.equal(transition.ok, true, JSON.stringify(transitionPayload));
    assert.deepEqual(transitionPayload.changedCard && { id: transitionPayload.changedCard.id, title: transitionPayload.changedCard.title, status: transitionPayload.changedCard.status }, { id: 'queue-17', title: 'Queue 17 refreshed', status: 'backlog' });
    await page.locator('.refresh-button').click();
    await page.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-control-column-list="backlog"] .control-task strong')].some((node) => node.textContent === 'Queue 17 refreshed'));
    await assertColumnScroll(page, queueOnly);

    await page.locator(`${columnSelector('queue')} .control-task-summary`).nth(8).evaluate((button) => (button as HTMLButtonElement).click());
    await page.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
    await page.locator('.back-to-zone-button').click();
    await openControlRoom(page, server.url, false);
    await assertColumnScroll(page, queueOnly);

    await page.locator(`${columnSelector('backlog')} .control-task-summary`).nth(10).evaluate((button) => (button as HTMLButtonElement).click());
    await page.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
    await page.goBack();
    await openControlRoom(page, server.url, false);
    await assertColumnScroll(page, queueOnly);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openControlRoom(page, server.url, false);
    assert.deepEqual(await readColumnScroll(page), { queue: 0, exec: 0, backlog: 0 });
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        if (server) await stopDecisionOsServer(server.process);
      } finally {
        rmSync(workspace.root, { recursive: true, force: true });
      }
    }
  }
});

async function openControlRoom(page: Page, url: string, navigate = true): Promise<void> {
  if (navigate) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
  if (navigate) await page.locator('.refresh-button').click();
  await page.waitForFunction(() => ['queue', 'backlog'].every((column) => {
    const list = document.querySelector<HTMLElement>(`[data-control-column-list="${column}"]`);
    return list && list.scrollHeight > list.clientHeight;
  }));
}

async function setColumnScroll(page: Page, positions: Partial<Record<'queue' | 'exec' | 'backlog', number>>): Promise<Record<'queue' | 'exec' | 'backlog', number>> {
  await page.evaluate((next) => {
    for (const [column, scrollTop] of Object.entries(next)) {
      const list = document.querySelector<HTMLElement>(`[data-control-column-list="${column}"]`);
      if (!list) throw new Error(`Missing ${column} column.`);
      list.scrollTop = Number(scrollTop);
      list.dispatchEvent(new Event('scroll'));
    }
  }, positions);
  return readColumnScroll(page);
}

async function readColumnScroll(page: Page): Promise<Record<'queue' | 'exec' | 'backlog', number>> {
  return page.evaluate(() => Object.fromEntries(['queue', 'exec', 'backlog'].map((column) => [column, document.querySelector<HTMLElement>(`[data-control-column-list="${column}"]`)?.scrollTop ?? -1]))) as Record<'queue' | 'exec' | 'backlog', number>;
}

async function assertColumnScroll(page: Page, expected: Record<'queue' | 'exec' | 'backlog', number>): Promise<void> {
  await page.waitForTimeout(100);
  assert.deepEqual(await readColumnScroll(page), expected);
}

function createScrollWorkspace(): { root: string; decisionOsRoot: string; projectId: string; tasksLedgerFile: string } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-scroll-browser-'));
  const decisionOsRoot = join(root, 'project-a', '.decision-os');
  const projectId = 'scroll-browser-project';
  const cardsRoot = join(decisionOsRoot, 'cards', 'tasks');
  mkdirSync(cardsRoot, { recursive: true });
  const groups = [
    { prefix: 'queue', status: 'todo' },
    { prefix: 'exec', status: 'todo' },
    { prefix: 'backlog', status: 'backlog' },
  ];
  const cards = groups.flatMap((group, groupIndex) => Array.from({ length: 18 }, (_, index) => {
    const id = `${group.prefix}-${String(index).padStart(2, '0')}`;
    writeFileSync(join(cardsRoot, `${id}.md`), `Ledger: Tasks\nWaiting since: 2026-07-17T${String(groupIndex + 1).padStart(2, '0')}:${String(index).padStart(2, '0')}:00.000Z\n\n## A. Goal\n\n1. Scroll fixture.\n`);
    return {
      id,
      title: `${group.prefix[0].toUpperCase()}${group.prefix.slice(1)} ${String(index).padStart(2, '0')}`,
      status: group.status,
      labels: ['master-task'],
      x: 40,
      y: 40,
      w: 300,
      h: 120,
      comment: { contentFile: `.decision-os/cards/tasks/${id}.md` },
    };
  }));
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
  const tasksLedgerFile = join(decisionOsRoot, 'tasks.json');
  writeFileSync(tasksLedgerFile, JSON.stringify({ cards, annotations: [{ id: 'zone-a', x: 0, y: 0, width: 1200, height: 900, color: '#38d9e8' }], relationships: [], notes: {}, threadFiles: {} }));
  return { root, decisionOsRoot, projectId, tasksLedgerFile };
}

async function startDecisionOsServer(cwd: string): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd,
    detached: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DECISION_OS_FRONTEND_ROOT: resolve(repoRoot, 'frontend'), TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  let lastProjection = 'not requested';
  try {
    await waitFor(async () => {
      assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
      return Boolean((await fetch(url, { method: 'HEAD' }).catch(() => undefined))?.ok);
    }, () => `Timed out waiting for Decision OS at ${url}.\n${output.join('')}`);
    await waitFor(async () => {
      const response = await fetch(`${url}/api/control-room`).catch(() => undefined);
      if (!response?.ok) {
        lastProjection = `HTTP ${response?.status ?? 'unavailable'}`;
        return false;
      }
      const payload = await response.json() as { queue?: unknown[]; exec?: unknown[]; backlog?: unknown[]; diagnostics?: unknown[] };
      lastProjection = JSON.stringify({ queue: payload.queue?.length, exec: payload.exec?.length, backlog: payload.backlog?.length, diagnostics: payload.diagnostics?.length });
      return payload.queue?.length === 36 && payload.exec?.length === 0 && payload.backlog?.length === 18;
    }, () => `Timed out waiting for the Control Room projection at ${url}; last projection ${lastProjection}.\n${output.join('')}`);
    return { process: child, url };
  } catch (error) {
    await stopDecisionOsServer(child);
    throw error;
  }
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) {
    signalProcessGroup(child, 'SIGTERM');
    const exited = await Promise.race([waitForExit(child).then(() => true), delay(2_000).then(() => false)]);
    if (!exited) {
      signalProcessGroup(child, 'SIGKILL');
      await Promise.race([waitForExit(child), delay(2_000)]);
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

function signalProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The detached process group may already be gone while the launcher handle is settling.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // A concurrent exit has already completed cleanup.
  }
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveExit) => child.once('exit', () => resolveExit()));
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

async function waitFor(check: () => Promise<boolean>, message: string | (() => string)): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail(typeof message === 'function' ? message() : message);
}

const delay = (milliseconds: number) => new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
