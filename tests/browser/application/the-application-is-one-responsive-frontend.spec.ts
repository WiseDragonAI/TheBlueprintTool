/**
 * WHAT: Proves that one frontend reproduces the mobile application contract and expands it responsively on desktop.
 * WHY: Control Room and project workflows must not diverge into separate mobile and desktop implementations.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('The responsive application preserves the mobile Control Room and expands the same shell on desktop.', { timeout: 60_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        ...(process.platform === 'android' ? ['--no-zygote', '--single-process'] : []),
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
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
        newTaskCount: document.querySelectorAll('.mobile-new-task-button').length,
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
      const command = document.querySelector<HTMLElement>('.control-command');
      const navRect = nav?.getBoundingClientRect();
      return {
        visibleView: document.querySelector<HTMLElement>('main.content > :not([hidden])')?.id ?? '',
        navPosition: nav ? getComputedStyle(nav).position : '',
        navVisible: Boolean(navRect && navRect.left >= 0 && navRect.width >= 240),
        columns: layout ? getComputedStyle(layout).gridTemplateColumns : '',
        tabsPosition: tabs ? getComputedStyle(tabs).position : '',
        tabsDisplay: tabs ? getComputedStyle(tabs).display : '',
        tabsInCommandHeader: Boolean(command && tabs && command.contains(tabs)),
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
    assert.equal(desktopLayout.tabsPosition, 'fixed');
    assert.equal(desktopLayout.tabsDisplay, 'none');
    assert.equal(desktopLayout.tabsInCommandHeader, true);
    assert.ok(desktopLayout.tabsBottomGap > 300);
    assert.equal(desktopLayout.bodyWidth, desktopLayout.viewportWidth);
    assert.equal(desktopLayout.mobileMenuVisible, false);
    assert.deepEqual(desktopErrors, []);

    const firstTask = desktop.locator('.control-task-summary').first();
    if (await firstTask.count()) {
      let releaseState!: () => void;
      let stateContinued!: () => void;
      const stateGate = new Promise<void>((resolveGate) => { releaseState = resolveGate; });
      const stateContinuation = new Promise<void>((resolveContinuation) => { stateContinued = resolveContinuation; });
      await desktop.route('**/decision-os/state', async (route) => {
        await stateGate;
        await route.continue();
        stateContinued();
      });
      await firstTask.click();
      await desktop.locator('#card-view:not([hidden]) .task-replica-skeleton').waitFor({ state: 'visible' });
      assert.match(new URL(desktop.url()).pathname, /\/cards\//, 'task history commits before project-state revalidation settles');
      releaseState();
      await stateContinuation;
      await desktop.unroute('**/decision-os/state');
      await desktop.locator('.task-replica-skeleton').waitFor({ state: 'hidden' });

      let releaseControlRoom!: () => void;
      let controlRoomContinued!: () => void;
      const controlRoomGate = new Promise<void>((resolveGate) => { releaseControlRoom = resolveGate; });
      const controlRoomContinuation = new Promise<void>((resolveContinuation) => { controlRoomContinued = resolveContinuation; });
      await desktop.route('**/api/control-room', async (route) => {
        await controlRoomGate;
        await route.continue();
        controlRoomContinued();
      });
      await desktop.getByRole('button', { name: 'Back', exact: true }).click();
      await desktop.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
      assert.equal(new URL(desktop.url()).pathname, '/', 'Back history and retained Control Room paint before projection revalidation settles');
      releaseControlRoom();
      await controlRoomContinuation;
      await desktop.unroute('**/api/control-room');
    }

    await mobile.goto(`${server.url}/projects`, { waitUntil: 'domcontentloaded' });
    await mobile.locator('#projects-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await mobile.getByRole('heading', { name: 'Projects' }).isVisible(), true);

    await desktop.locator('.ledger-nav').getByRole('link', { name: 'Projects' }).click();
    await desktop.waitForURL(`${server.url}/projects`);
    await desktop.locator('#projects-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await desktop.locator('.canvas').count(), 0);
    const firstProject = desktop.locator('.project-card:not(:disabled)').first();
    await firstProject.click();
    await desktop.locator('.project-settings-modal[open]').waitFor({ state: 'visible' });
    assert.equal(await desktop.getByRole('button', { name: 'Synchronize project' }).isVisible(), true);
    await desktop.getByRole('button', { name: 'Cancel' }).click();

    await desktop.goto(`${server.url}/projects-canvas`, { waitUntil: 'domcontentloaded' });
    await desktop.waitForFunction(() => window.__coreState?.canvasMode === 'projects');
    assert.equal(await desktop.locator('.canvas').isVisible(), true);
    await desktop.getByRole('button', { name: 'Control Room' }).click();
    await desktop.waitForURL(`${server.url}/`);
    await desktop.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });

    const cardRoute = await resolveResponsiveCardRoute(server.url);
    await desktop.goto(`${server.url}${cardRoute}`, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await desktop.locator('.app-shell').isVisible(), true);
    assert.equal(await desktop.locator('.canvas').count(), 0);
    assert.equal(await desktop.getByRole('button', { name: 'Back', exact: true }).isVisible(), true);
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    await desktop.locator('.mobile-thread-inspector:not([hidden])').waitFor({ state: 'visible' });
    await desktop.waitForFunction(() => {
      const inspector = document.querySelector<HTMLElement>('.mobile-thread-inspector');
      return Boolean(inspector && getComputedStyle(inspector).transform === 'none');
    });
    const desktopThreadLayout = await desktop.evaluate(() => {
      const card = document.querySelector<HTMLElement>('#card-view');
      const inspector = document.querySelector<HTMLElement>('.mobile-thread-inspector');
      const cardRect = card?.getBoundingClientRect();
      const inspectorRect = inspector?.getBoundingClientRect();
      return {
        cardVisible: Boolean(cardRect && cardRect.width > 0 && cardRect.height > 0),
        cardRight: cardRect?.right ?? 0,
        inspectorLeft: inspectorRect?.left ?? 0,
        inspectorRight: inspectorRect?.right ?? 0,
        inspectorWidth: inspectorRect?.width ?? 0,
        expectedWidth: Math.min(620, Math.max(420, innerWidth * .33)),
        shellOpen: document.body.classList.contains('card-thread-open'),
      };
    });
    assert.equal(desktopThreadLayout.cardVisible, true);
    assert.ok(desktopThreadLayout.cardRight <= desktopThreadLayout.inspectorLeft + 1, JSON.stringify(desktopThreadLayout));
    assert.equal(desktopThreadLayout.inspectorRight, 1440);
    assert.ok(Math.abs(desktopThreadLayout.inspectorWidth - desktopThreadLayout.expectedWidth) < 1);
    assert.equal(desktopThreadLayout.shellOpen, true);
    await desktop.getByRole('button', { name: 'Close thread' }).click();
    await desktop.locator('.mobile-thread-inspector').waitFor({ state: 'hidden' });
    assert.equal(await desktop.evaluate(() => document.body.classList.contains('card-thread-open')), false);

    await mobile.goto(`${server.url}${cardRoute}`, { waitUntil: 'domcontentloaded' });
    await mobile.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
    await mobile.getByRole('button', { name: 'Thread', exact: true }).click();
    await mobile.locator('.mobile-thread-inspector:not([hidden])').waitFor({ state: 'visible' });
    await mobile.waitForFunction(() => {
      const inspector = document.querySelector<HTMLElement>('.mobile-thread-inspector');
      return Boolean(inspector && getComputedStyle(inspector).transform === 'none');
    });
    const mobileThreadLayout = await mobile.locator('.mobile-thread-inspector').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });
    assert.deepEqual(mobileThreadLayout, { left: 0, top: 0, width: 390, height: 844 });

    await desktop.keyboard.press('a');
    await desktop.locator('.mobile-thread-inspector:not([hidden])').waitFor({ state: 'visible' });
    await desktop.keyboard.press('a');
    const draft = desktop.locator('.thread-draft');
    await draft.waitFor({ state: 'visible' });
    assert.equal(await draft.evaluate((element) => element === document.activeElement), true);
    await desktop.keyboard.press('x');
    assert.equal(await desktop.locator('.voice-panel').evaluate((element) => element.classList.contains('recording')), false);
    await draft.evaluate((element) => (element as HTMLElement).blur());
    await desktop.keyboard.press('x');
    await desktop.locator('.voice-panel.recording').waitFor({ state: 'visible' });
    await desktop.keyboard.press('Escape');
    await desktop.waitForFunction(() => !document.querySelector('.voice-panel')?.classList.contains('recording'));
    assert.equal(await desktop.locator('.mobile-thread-inspector').isVisible(), true);
    await desktop.keyboard.press('Escape');
    await desktop.locator('.mobile-thread-inspector').waitFor({ state: 'hidden' });

    assert.deepEqual(desktopErrors, []);
    assert.deepEqual(mobileErrors, []);
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

test('An interrupted responsive thread hydration recovers without an operator reload.', { timeout: 30_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const route = localResponsiveCardRoute();
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let threadRequestCount = 0;
    await desktop.route('**/api/ledgers/*/threads/*', async (request) => {
      threadRequestCount += 1;
      if (threadRequestCount === 1) {
        await request.abort('connectionreset');
        return;
      }
      const response = await request.fetch();
      const payload = await response.json() as { notes?: Record<string, unknown[]> };
      const threadId = decodeURIComponent(new URL(request.request().url()).pathname.split('/').at(-1) ?? '');
      payload.notes = {
        ...(payload.notes ?? {}),
        [threadId]: [{
          id: 'note-browser-thread-recovery',
          role: 'operator',
          message: 'Recovered thread note.',
          timestamp: '2026-07-26T00:00:00.000Z',
        }],
      };
      await request.fulfill({ response, contentType: 'application/json', body: JSON.stringify(payload) });
    });

    await desktop.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    await desktop.locator('.thread-note').filter({ hasText: 'Recovered thread note.' }).waitFor({ state: 'visible', timeout: 10_000 });

    assert.ok(threadRequestCount >= 2, `Expected an automatic thread retry, received ${threadRequestCount} request.`);
    assert.ok(await desktop.locator('.thread-note').count() > 0);
    assert.equal(await desktop.locator('.mobile-thread-inspector').isVisible(), true);
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

test('A hydrated responsive thread remains visible while navigation refresh is pending.', { timeout: 30_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  let releaseRefresh: (() => void) | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const route = localResponsiveCardRoute();
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const refreshGate = new Promise<void>((resolveRefresh) => { releaseRefresh = resolveRefresh; });
    let threadRequestCount = 0;
    let retainedPayload: Record<string, unknown> | null = null;
    await desktop.route('**/api/ledgers/*/threads/*', async (request) => {
      threadRequestCount += 1;
      if (!retainedPayload) {
        const response = await request.fetch();
        const payload = await response.json() as { notes?: Record<string, unknown[]> };
        const threadId = decodeURIComponent(new URL(request.request().url()).pathname.split('/').at(-1) ?? '');
        payload.notes = {
          ...(payload.notes ?? {}),
          [threadId]: [{
            id: 'note-browser-thread-navigation',
            role: 'operator',
            message: 'Retained across navigation.',
            timestamp: '2026-07-27T00:00:00.000Z',
          }],
        };
        retainedPayload = payload;
        await request.fulfill({ response, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }
      await refreshGate;
      await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(retainedPayload) });
    });

    await desktop.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    const retainedNote = desktop.locator('.thread-note').filter({ hasText: 'Retained across navigation.' });
    await retainedNote.waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Close thread' }).click();
    await desktop.locator('.mobile-thread-inspector').waitFor({ state: 'hidden' });
    await desktop.locator('.back-to-zone-button').click();
    await desktop.locator('#zone-view:not([hidden])').waitFor({ state: 'visible' });
    await desktop.goBack();
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    await retainedNote.waitFor({ state: 'visible', timeout: 1_000 });
    assert.ok(threadRequestCount >= 2, `Expected a pending scoped refresh, received ${threadRequestCount} request.`);
    releaseRefresh?.();
  } finally {
    releaseRefresh?.();
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

test('A new desktop task remains in its task view while its optimistic creation is pending.', { timeout: 60_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  let releaseCreation: (() => void) | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const project = await resolveCurrentProject(server.url);
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = collectPageErrors(desktop);
    let creationObserved!: () => void;
    const creationRequest = new Promise<void>((resolveObserved) => { creationObserved = resolveObserved; });
    const creationGate = new Promise<void>((resolveCreation) => { releaseCreation = resolveCreation; });
    let cardDetailReads = 0;
    await desktop.route('**/decision-os/tasks**', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const mutation = route.request().postDataJSON() as {
        action?: string;
        card?: Record<string, unknown>;
        annotation?: Record<string, unknown>;
      };
      if (mutation.action !== 'create-task-intake') return route.continue();
      creationObserved();
      await creationGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          ledgerId: 'tasks',
          changedCard: mutation.card,
          changedAnnotation: mutation.annotation,
        }),
      });
    });
    await desktop.route('**/api/ledgers/tasks/cards/**', async (route) => {
      cardDetailReads += 1;
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Card is not persisted yet.' }) });
    });

    await desktop.goto(server.url, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
    await desktop.locator('.desktop-new-task-button').click();
    await desktop.locator('.new-task-project-modal[open]').waitFor({ state: 'visible' });
    await desktop.locator('.new-task-project-option').filter({ hasText: project.name }).click();
    await creationRequest;
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });

    assert.match(new URL(desktop.url()).pathname, /\/ledgers\/tasks\/zones\/[^/]+\/cards\/[^/]+$/);
    assert.equal(await desktop.locator('.canvas').count(), 0);
    assert.equal(cardDetailReads, 0, 'route hydration must not read a card that is still locally owned');
    assert.deepEqual(pageErrors, []);
  } finally {
    releaseCreation?.();
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

test('Master-task completion exposes manual and configured pipeline actions at desktop and mobile widths.', { timeout: 60_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const route = await resolveMasterTaskRoute(server.url);
    const settingsPayload = JSON.stringify({
      ok: true,
      maxConcurrentCodexProcesses: 1,
      voicePipelineId: '',
      masterTaskCompletionPipelineId: 'complete-master-task',
      pipelines: [{ id: 'complete-master-task', name: 'Complete master task' }],
    });

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let pipelineRequest: Record<string, unknown> | undefined;
    await desktop.route('**/api/settings/codex-processes', (request) => request.fulfill({ status: 200, contentType: 'application/json', body: settingsPayload }));
    await desktop.route('**/api/codex/pipelines/runs', async (request) => {
      pipelineRequest = request.request().postDataJSON() as Record<string, unknown>;
      await request.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, run: { id: 'pipeline-run-browser' } }) });
    });
    await desktop.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    const desktopManual = desktop.getByRole('button', { name: 'Complete manually' });
    const desktopPipeline = desktop.getByRole('button', { name: 'Complete with pipeline' });
    await desktopPipeline.waitFor({ state: 'visible' });
    await desktop.waitForFunction(() => !(document.querySelector<HTMLButtonElement>('.complete-master-task-pipeline-button')?.disabled ?? true));
    const desktopPositions = await Promise.all([desktopManual.boundingBox(), desktopPipeline.boundingBox()]);
    assert.equal(desktopPositions[0]?.y, desktopPositions[1]?.y);
    await desktopPipeline.click();
    await desktop.waitForURL(`${server.url}/?tab=exec`);
    assert.equal(pipelineRequest?.pipelineId, 'complete-master-task');
    assert.equal(typeof pipelineRequest?.ledgerId, 'string');
    assert.equal(typeof pipelineRequest?.sourceCardId, 'string');

    const unconfigured = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await unconfigured.route('**/api/settings/codex-processes', (request) => request.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...JSON.parse(settingsPayload), masterTaskCompletionPipelineId: '' }),
    }));
    await unconfigured.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    const unconfiguredPipeline = unconfigured.getByRole('button', { name: 'Complete with pipeline' });
    await unconfiguredPipeline.waitFor({ state: 'visible' });
    assert.equal(await unconfiguredPipeline.isDisabled(), true);
    assert.equal(await unconfiguredPipeline.getAttribute('title'), 'Configure a master-task completion pipeline in Settings.');

    const rejected = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let rejectedLedgerMutation = false;
    await rejected.route('**/api/settings/codex-processes', (request) => request.fulfill({ status: 200, contentType: 'application/json', body: settingsPayload }));
    await rejected.route('**/api/codex/pipelines/runs', (request) => request.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'Pipeline admission rejected.' }),
    }));
    await rejected.route('**/decision-os/*', async (request) => {
      if (request.request().method() === 'PATCH') rejectedLedgerMutation = true;
      await request.continue();
    });
    await rejected.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    const rejectedPipeline = rejected.getByRole('button', { name: 'Complete with pipeline' });
    await rejected.waitForFunction(() => !(document.querySelector<HTMLButtonElement>('.complete-master-task-pipeline-button')?.disabled ?? true));
    await rejectedPipeline.click();
    await rejected.locator('#error-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await rejected.locator('#error-message').textContent(), 'Pipeline admission rejected.');
    assert.equal(rejectedLedgerMutation, false);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let manualRequest: Record<string, unknown> | undefined;
    let releaseManualRequest!: () => void;
    let observeManualRequest!: () => void;
    const manualRequestGate = new Promise<void>((resolveGate) => { releaseManualRequest = resolveGate; });
    const manualRequestObserved = new Promise<void>((resolveObserved) => { observeManualRequest = resolveObserved; });
    await mobile.route('**/api/settings/codex-processes', (request) => request.fulfill({ status: 200, contentType: 'application/json', body: settingsPayload }));
    await mobile.route('**/decision-os/*', async (request) => {
      if (request.request().method() !== 'PATCH') return request.continue();
      manualRequest = request.request().postDataJSON() as Record<string, unknown>;
      observeManualRequest();
      await manualRequestGate;
      await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await mobile.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    const mobileManual = mobile.getByRole('button', { name: 'Complete manually' });
    const mobilePipeline = mobile.getByRole('button', { name: 'Complete with pipeline' });
    await mobilePipeline.waitFor({ state: 'visible' });
    const mobilePositions = await Promise.all([mobileManual.boundingBox(), mobilePipeline.boundingBox()]);
    assert.ok(Number(mobilePositions[1]?.y) > Number(mobilePositions[0]?.y));
    await mobileManual.click();
    await manualRequestObserved;
    await mobile.waitForURL((url) => url.pathname === '/' && url.searchParams.get('tab') === 'queue');
    assert.deepEqual(manualRequest, { action: 'complete-master-task', masterTaskId: pipelineRequest?.sourceCardId });
    releaseManualRequest();
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function resolveResponsiveCardRoute(serverUrl: string): Promise<string> {
  const catalog = await fetch(`${serverUrl}/decision-os/projects`).then((response) => response.json()) as {
    projects?: Array<{ id: string; root: string; ledgers?: Array<{ id: string }> }>;
  };
  const project = catalog.projects?.find((candidate) => candidate.root === repoRoot);
  assert.ok(project, 'The test workspace must be registered in its project catalog.');
  for (const ledger of project.ledgers ?? []) {
    const canvas = await fetch(`${serverUrl}/p/${encodeURIComponent(project.id)}/api/ledgers/${encodeURIComponent(ledger.id)}/canvas`).then((response) => response.json()) as {
      annotations?: Array<{ id?: string; variant?: string; color?: string }>;
      cards?: Array<{ id?: string }>;
    };
    const zone = canvas.annotations?.find((candidate) => candidate.id && candidate.variant !== 'group' && typeof candidate.color === 'string');
    for (const card of canvas.cards ?? []) {
      if (!zone?.id || !card.id) continue;
      const thread = await fetch(`${serverUrl}/p/${encodeURIComponent(project.id)}/api/ledgers/${encodeURIComponent(ledger.id)}/threads/${encodeURIComponent(`thread-${card.id}`)}`);
      if (thread.ok) return `/p/${encodeURIComponent(project.id)}/ledgers/${encodeURIComponent(ledger.id)}/zones/${encodeURIComponent(zone.id)}/cards/${encodeURIComponent(card.id)}`;
    }
  }
  assert.fail('The test workspace must expose one card and one zone for responsive card routing.');
}

function localResponsiveCardRoute(): string {
  const project = JSON.parse(readFileSync(resolve(repoRoot, '.decision-os/project.json'), 'utf8')) as { id?: string };
  const registry = JSON.parse(readFileSync(resolve(repoRoot, '.decision-os/state.json'), 'utf8')) as {
    ledgers?: Array<{ id?: string; ledgerFile?: string }>;
  };
  assert.ok(project.id, 'The browser fixture must expose a project identity.');
  for (const ledgerRef of registry.ledgers ?? []) {
    if (!ledgerRef.id || !ledgerRef.ledgerFile) continue;
    const ledger = JSON.parse(readFileSync(resolve(repoRoot, ledgerRef.ledgerFile), 'utf8')) as {
      annotations?: Array<{ id?: string; variant?: string; color?: string }>;
      cards?: Array<{ id?: string }>;
      threadFiles?: Record<string, string>;
    };
    const zone = ledger.annotations?.find((candidate) => candidate.id && candidate.variant !== 'group' && typeof candidate.color === 'string');
    const card = ledger.cards?.find((candidate) => candidate.id && ledger.threadFiles?.[`thread-${candidate.id}`]);
    if (!zone?.id || !card?.id) continue;
    return `/p/${encodeURIComponent(project.id)}/ledgers/${encodeURIComponent(ledgerRef.id)}/zones/${encodeURIComponent(zone.id)}/cards/${encodeURIComponent(card.id)}`;
  }
  assert.fail('The browser fixture must expose one local card, zone, and thread.');
}

async function resolveCurrentProject(serverUrl: string): Promise<{ id: string; name: string }> {
  const catalog = await fetch(`${serverUrl}/decision-os/projects`).then((response) => response.json()) as {
    projects?: Array<{ id: string; name: string; root: string }>;
  };
  const project = catalog.projects?.find((candidate) => candidate.root === repoRoot);
  assert.ok(project, 'The test workspace must be registered in its project catalog.');
  return project;
}

async function resolveMasterTaskRoute(serverUrl: string): Promise<string> {
  const catalog = await fetch(`${serverUrl}/decision-os/projects`).then((response) => response.json()) as {
    projects?: Array<{ id: string; root: string; ledgers?: Array<{ id: string }> }>;
  };
  const project = catalog.projects?.find((candidate) => candidate.root === repoRoot);
  assert.ok(project, 'The test workspace must be registered in its project catalog.');
  for (const ledger of project.ledgers ?? []) {
    const canvas = await fetch(`${serverUrl}/p/${encodeURIComponent(project.id)}/api/ledgers/${encodeURIComponent(ledger.id)}/canvas`).then((response) => response.json()) as {
      annotations?: Array<{ id?: string; variant?: string; color?: string }>;
      cards?: Array<{ id?: string; status?: string; labels?: string[] }>;
    };
    const zone = canvas.annotations?.find((candidate) => candidate.id && candidate.variant !== 'group' && typeof candidate.color === 'string');
    const card = canvas.cards?.find((candidate) => candidate.id && candidate.status !== 'done' && candidate.labels?.includes('master-task'));
    if (zone?.id && card?.id) return `/p/${encodeURIComponent(project.id)}/ledgers/${encodeURIComponent(ledger.id)}/zones/${encodeURIComponent(zone.id)}/cards/${encodeURIComponent(card.id)}`;
  }
  assert.fail('The test workspace must expose one open master task and one zone.');
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() === 404 && response.url().includes('/.decision-os/thread-files/')) return;
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
  });
  return errors;
}

async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
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
