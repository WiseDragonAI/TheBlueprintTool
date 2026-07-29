import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { chromium } from '@playwright/test';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';

test('Done is a one-column project-first archive sorted by completion date', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-done-view-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  const cards = [
    { id: 'old', title: 'Old completion', label: 'release', completedAt: '2026-07-18T09:00:00.000Z' },
    { id: 'middle', title: 'Middle completion', label: 'mobile', completedAt: '2026-07-19T09:00:00.000Z' },
    { id: 'new', title: 'New completion', label: 'release', completedAt: '2026-07-20T09:00:00.000Z' },
  ];
  for (const card of cards) writeFileSync(join(decisionOsRoot, 'cards', 'tasks', `${card.id}.md`), `Completed at: ${card.completedAt}\n\n## A. Result\n\n1. Done.\n`);
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: cards.map((card, index) => ({
      id: card.id,
      title: card.title,
      status: 'done',
      labels: ['master-task', card.label],
      x: 20,
      y: 20 + index * 220,
      w: 320,
      h: 180,
      comment: { contentFile: `.decision-os/cards/tasks/${card.id}.md` },
    })),
    annotations: [], relationships: [], notes: {}, threadFiles: {},
  }));

  const runtime: Record<string, unknown> = {};
  createHttpServer({
    action_payload: {
      port: 0,
      host: '127.0.0.1',
      cwd: workspace,
      decisionOsFrontendRoot: resolve(process.cwd(), 'frontend'),
    },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/snap/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const response = await page.goto(`${baseUrl}/done`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.locator('#done-task-list .control-task').first().waitFor();

    const titles = () => page.locator('#done-task-list .control-task strong').allTextContents();
    assert.deepEqual(await titles(), ['New completion', 'Middle completion', 'Old completion']);
    const firstBox = await page.locator('#done-task-list .control-task').nth(0).boundingBox();
    const secondBox = await page.locator('#done-task-list .control-task').nth(1).boundingBox();
    assert.ok(firstBox && secondBox && secondBox.y > firstBox.y, 'completed tasks must render in one vertical column');
    assert.match(await page.locator('#done-task-list .control-task').first().innerText(), /Completed .+2026/);
    assert.equal(await page.locator('#done-project-filter-group').isVisible(), true);
    assert.equal(await page.locator('#done-label-filter-group').isVisible(), false);

    await page.locator('#done-sort').selectOption('asc');
    assert.deepEqual(await titles(), ['Old completion', 'Middle completion', 'New completion']);
    await page.locator('#done-project-filters button').nth(1).click();
    assert.equal(await page.locator('#done-project-filter-group').isVisible(), false);
    assert.equal(await page.locator('#done-label-filter-group').isVisible(), true);
    await page.getByRole('button', { name: 'release', exact: true }).click();
    assert.deepEqual(await titles(), ['Old completion', 'New completion']);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(workspace, { recursive: true, force: true });
  }
});
