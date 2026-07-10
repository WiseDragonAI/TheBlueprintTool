/**
 * WHAT: Browser interaction proof for spec 9d1b7c36: The refresh system preserves canvas continuity during operator work.
 * WHY: Refresh during an active drag must not change the card id committed on release.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

type LedgerCard = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
};

type LedgerDocument = {
  cards?: LedgerCard[];
  annotations?: Array<Record<string, unknown>>;
};

type LedgerGeometryPatch = {
  cards?: Record<string, { x: number; y: number; width: number; height: number }>;
  zones?: Record<string, { x: number; y: number; width: number; height: number }>;
  groups?: Record<string, { x: number; y: number; width: number; height: number }>;
};

type PatchGeometryMutation = {
  action?: string;
  geometry?: LedgerGeometryPatch;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const targetCardId = '9d1b7c36';
const chromiumExecutablePath = '/snap/bin/chromium';

test('The refresh system preserves canvas continuity during operator work.', async () => {
  const originalLedger = readSpecsLedger();
  const targetCard = originalLedger.cards?.find((card) => String(card.id ?? '') === targetCardId);
  assert.ok(targetCard, `Expected specs ledger to contain card ${targetCardId}`);

  const viewport = viewportForCard(targetCard);
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const committedMutations: PatchGeometryMutation[] = [];

    await seedCanvasViewport(page, viewport);
    await page.route(`${server.url}/decision-os/specs`, async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const mutation = request.postDataJSON() as PatchGeometryMutation;
      if (mutation.action === 'patch-geometry') committedMutations.push(mutation);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(applyGeometryPatch(originalLedger, mutation.geometry ?? {}))
      });
    });

    await page.goto(`${server.url}/specs`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((cardId) => {
      const state = (window as Window & { __coreState?: { activeLedger?: { cards?: Array<{ id?: string }> } } }).__coreState;
      return Boolean(state?.activeLedger?.cards?.some((card) => String(card.id ?? '') === cardId));
    }, targetCardId);

    const card = page.locator(`[data-card-id="${targetCardId}"].ledger-node`);
    await card.waitFor({ state: 'visible' });
    const cardBox = await card.boundingBox();
    assert.ok(cardBox, `Expected card ${targetCardId} to have browser geometry`);

    const start = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 10);

    const refreshCountBefore = await refreshCompletionCount(page);
    await page.locator('[data-action="refresh"]').evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction((previousCount) => {
      const telemetry = ((window as Window & { __coreTelemetry?: Array<{ name?: string; args?: { source?: string } }> }).__coreTelemetry ?? []);
      return telemetry.filter((entry) => entry.name === 'merge-refresh-state' && entry.args?.source === 'refresh-button').length > previousCount;
    }, refreshCountBefore);

    await page.mouse.move(start.x + 110, start.y + 30);
    await page.mouse.up();

    await waitFor(() => committedMutations.length > 0, 'Timed out waiting for patch-geometry commit');
    const finalMutation = committedMutations.at(-1);
    assert.ok(finalMutation?.geometry, 'Expected release to commit geometry');
    assert.deepEqual(Object.keys(finalMutation.geometry.cards ?? {}), [targetCardId]);
    assert.deepEqual(Object.keys(finalMutation.geometry.zones ?? {}), []);
    assert.deepEqual(Object.keys(finalMutation.geometry.groups ?? {}), []);
    assert.equal(finalMutation.geometry.cards?.[targetCardId]?.x, Number(targetCard.x ?? 0) + 110);
    assert.equal(finalMutation.geometry.cards?.[targetCardId]?.y, Number(targetCard.y ?? 0) + 30);
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function seedCanvasViewport(page: Page, viewport: { x: number; y: number; scale: number }): Promise<void> {
  await page.addInitScript((input) => {
    localStorage.setItem('decision-os.canvas.state', JSON.stringify({
      activeTab: 'specs',
      railCollapsed: false,
      selection: { cardIds: [], zoneIds: [], groupIds: [] },
      viewport: input,
      viewports: { specs: input }
    }));
  }, viewport);
}

async function refreshCompletionCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const telemetry = ((window as Window & { __coreTelemetry?: Array<{ name?: string; args?: { source?: string } }> }).__coreTelemetry ?? []);
    return telemetry.filter((entry) => entry.name === 'merge-refresh-state' && entry.args?.source === 'refresh-button').length;
  });
}

function readSpecsLedger(): LedgerDocument {
  return JSON.parse(readFileSync(resolve(repoRoot, '.decision-os/specs.json'), 'utf8')) as LedgerDocument;
}

function viewportForCard(card: LedgerCard): { x: number; y: number; scale: number } {
  return {
    x: 420 - Number(card.x ?? 0),
    y: 240 - Number(card.y ?? 0),
    scale: 1
  };
}

function applyGeometryPatch(ledger: LedgerDocument, geometry: LedgerGeometryPatch): LedgerDocument {
  const next = JSON.parse(JSON.stringify(ledger)) as LedgerDocument;
  const cardPatches = geometry.cards ?? {};
  next.cards = (next.cards ?? []).map((card) => {
    const patch = cardPatches[String(card.id ?? '')];
    return patch ? { ...card, x: patch.x, y: patch.y, w: patch.width, h: patch.height } : card;
  });
  return next;
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
}

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
    const response = await fetch(`${url}/specs`, { method: 'HEAD' }).catch(() => undefined);
    return Boolean(response?.ok);
  }, `Timed out waiting for decision-os server at ${url}/specs`);
  return { process: child, url };
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    child.kill('SIGTERM');
  }
  const exited = await Promise.race([waitForExit(child).then(() => true), delay(2000).then(() => false)]);
  if (!exited && child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Expected an ephemeral TCP port');
  const port = address.port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail(message);
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveExit) => child.once('exit', () => resolveExit()));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
