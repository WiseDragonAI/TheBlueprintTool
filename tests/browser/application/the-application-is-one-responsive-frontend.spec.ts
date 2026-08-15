/**
 * WHAT: Proves that one frontend reproduces the mobile application contract and expands it responsively on desktop.
 * WHY: Control Room and project workflows must not diverge into separate mobile and desktop implementations.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
let isolatedWorkspaceRoot = '';

test.after(() => {
  // WHAT: Remove only the browser suite's isolated workspace after every server has stopped.
  // WHY: Browser verification must not leave copied authored state or runtime artifacts behind.
  if (isolatedWorkspaceRoot) rmSync(isolatedWorkspaceRoot, { recursive: true, force: true });
});

function browserWorkspaceRoot(): string {
  // WHAT: Reuse one isolated authored-state copy across this file's sequential browser servers.
  // WHY: Every server must remain disconnected from production federation without recopying the large fixture per test.
  if (isolatedWorkspaceRoot) return isolatedWorkspaceRoot;
  isolatedWorkspaceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-responsive-browser-'));
  materializeCommittedDecisionOsFixture(isolatedWorkspaceRoot);
  return isolatedWorkspaceRoot;
}

function materializeCommittedDecisionOsFixture(workspaceRoot: string): void {
  const fixtureRoot = resolve(workspaceRoot, '.decision-os');
  // WHAT: Materialize the exact Decision OS child commit recorded by this feature checkout.
  // WHY: Pre-integration verification must consume the reviewed local child object before the integration tool publishes it.
  const recordedCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD:.decision-os'], { encoding: 'utf8' }).trim();
  // WHAT: Bound the in-memory archive above the committed fixture size while retaining synchronous setup ordering.
  // WHY: Node's 1 MiB default maxBuffer terminates a valid child archive before tar can receive it.
  const archive = execFileSync('git', ['-C', resolve(repoRoot, '.decision-os'), 'archive', '--format=tar', recordedCommit], {
    maxBuffer: 128 * 1024 * 1024,
  });
  mkdirSync(fixtureRoot, { recursive: true });
  const extraction = spawnSync('tar', ['-x', '-C', fixtureRoot], { input: archive, encoding: 'buffer' });
  // WHAT: Reject an incomplete authored-state extraction before starting the browser server.
  // WHY: Continuing with a partial fixture would turn a setup failure into misleading missing-card and missing-project behavior.
  if (extraction.status !== 0) {
    throw new Error(`Unable to materialize committed Decision OS browser fixture: ${String(extraction.stderr)}`);
  }
  // WHAT: Remove settings and runtime-owned paths even when an older child commit tracked them.
  // WHY: Browser verification must never inherit credentials, federation identity, caches, runs, or uploads.
  for (const relativePath of ['.settings.json', 'cache', 'runtime', 'runs', 'voice-uploads']) {
    rmSync(resolve(fixtureRoot, relativePath), { recursive: true, force: true });
  }
}

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

test('The served responsive card and both thread roles retain Markdown typography.', { timeout: 30_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const route = await resolveResponsiveCardRoute(server.url);
    const routeSegments = route.split('/');
    const cardId = decodeURIComponent(routeSegments.at(-1) ?? '');
    const ledgerId = decodeURIComponent(routeSegments[routeSegments.indexOf('ledgers') + 1] ?? '');
    const threadId = `thread-${cardId}`;
    assert.ok(cardId, 'The responsive card route must identify one card.');
    assert.ok(ledgerId, 'The responsive card route must identify one ledger.');
    const cardMarkdown = [
      'Card normal typography **Card strong typography**.',
      '# Card heading 1',
      '## Card heading 2',
      '### Card heading 3',
      '#### Card heading 4',
      '##### Card heading 5',
      '###### Card heading 6',
    ].join('\n\n');
    const operatorMarkdown = [
      'Operator normal typography **Operator strong typography**.',
      '# Operator heading 1',
      '## Operator heading 2',
      '### Operator heading 3',
      '#### Operator heading 4',
      '##### Operator heading 5',
      '###### Operator heading 6',
    ].join('\n\n');
    const agentMarkdown = [
      'Agent normal typography **Agent strong typography**.',
      '# Agent heading 1',
      '## Agent heading 2',
      '### Agent heading 3',
      '#### Agent heading 4',
      '##### Agent heading 5',
      '###### Agent heading 6',
    ].join('\n\n');
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await desktop.route(`**/api/ledgers/${encodeURIComponent(ledgerId)}/cards/${encodeURIComponent(cardId)}`, async (interceptedRoute) => {
      const response = await interceptedRoute.fetch();
      const card = await response.json() as { comment?: Record<string, unknown>; [key: string]: unknown };
      await interceptedRoute.fulfill({
        response,
        contentType: 'application/json',
        body: JSON.stringify({ ...card, comment: { ...(card.comment ?? {}), what: cardMarkdown } }),
      });
    });
    await desktop.route(`**/api/ledgers/${encodeURIComponent(ledgerId)}/threads/${encodeURIComponent(threadId)}`, async (interceptedRoute) => {
      const response = await interceptedRoute.fetch();
      const payload = await response.json() as { notes?: Record<string, unknown[]>; [key: string]: unknown };
      await interceptedRoute.fulfill({
        response,
        contentType: 'application/json',
        body: JSON.stringify({
          ...payload,
          notes: {
            ...(payload.notes ?? {}),
            [threadId]: [
              { id: 'note-browser-typography-operator', role: 'operator', message: operatorMarkdown, timestamp: '2026-08-11T00:00:00.000Z' },
              { id: 'note-browser-typography-agent', role: 'agent', message: agentMarkdown, timestamp: '2026-08-11T00:00:01.000Z' },
            ],
          },
        }),
      });
    });

    await desktop.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#card-view:not([hidden]) .ledger-card-body').filter({ hasText: 'Card normal typography' }).waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    await desktop.locator('.thread-note.is-operator .thread-note-message').filter({ hasText: 'Operator normal typography' }).waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.locator('.thread-note.is-agent .thread-note-message').filter({ hasText: 'Agent normal typography' }).waitFor({ state: 'visible', timeout: 10_000 });
    const typography = await desktop.evaluate(() => (
      [
        { reader: 'card', selector: '#card-view .card-body > .ledger-card-body' },
        { reader: 'operator', selector: '.thread-note.is-operator .thread-note-message' },
        { reader: 'agent', selector: '.thread-note.is-agent .thread-note-message' },
      ].map(({ reader: readerName, selector }) => {
        const reader = document.querySelector<HTMLElement>(selector)!;
        const normal = reader.querySelector<HTMLElement>('p')!;
        const strong = reader.querySelector<HTMLElement>('strong')!;
        return {
          reader: readerName,
          normal: {
            color: getComputedStyle(normal).color,
            fontWeight: getComputedStyle(normal).fontWeight,
          },
          strong: {
            color: getComputedStyle(strong).color,
            fontWeight: getComputedStyle(strong).fontWeight,
          },
          headings: [1, 2, 3, 4, 5, 6].map((level) => {
            const heading = reader.querySelector<HTMLElement>(`.ledger-card-heading-${level}`)!;
            return {
              fontWeight: getComputedStyle(heading).fontWeight,
              fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
            };
          }),
        };
      })
    ));

    for (const rendered of typography) {
      const { reader } = rendered;
      assert.equal(rendered.normal.color, 'rgb(184, 194, 204)', `${reader} normal text color`);
      assert.equal(rendered.normal.fontWeight, '400', `${reader} normal text weight`);
      assert.equal(rendered.strong.color, 'rgb(245, 240, 232)', `${reader} authored strong color`);
      assert.ok(Number.parseInt(rendered.strong.fontWeight, 10) > Number.parseInt(rendered.normal.fontWeight, 10), `${reader} authored strong weight`);
      assert.equal(rendered.headings.length, 6, `${reader} heading count`);
      for (const heading of rendered.headings) assert.equal(heading.fontWeight, '800', `${reader} heading weight`);
      assert.ok(rendered.headings[0].fontSize > rendered.headings[1].fontSize, `${reader} H1 exceeds H2`);
      assert.ok(rendered.headings[1].fontSize > rendered.headings[2].fontSize, `${reader} H2 exceeds H3`);
      assert.ok(rendered.headings[2].fontSize > rendered.headings[3].fontSize, `${reader} H3 exceeds H4`);
      assert.equal(rendered.headings[3].fontSize, rendered.headings[4].fontSize, `${reader} H4 equals H5`);
      assert.equal(rendered.headings[4].fontSize, rendered.headings[5].fontSize, `${reader} H5 equals H6`);
    }
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
    const route = await resolveResponsiveCardRoute(server.url);
    const expectedThreadId = `thread-${decodeURIComponent(route.split('/').at(-1) ?? '')}`;
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let threadRequestCount = 0;
    await desktop.route('**/api/ledgers/*/threads/*', async (request) => {
      const threadId = decodeURIComponent(new URL(request.request().url()).pathname.split('/').at(-1) ?? '');
      if (threadId !== expectedThreadId) {
        await request.continue();
        return;
      }
      threadRequestCount += 1;
      if (threadRequestCount === 1) {
        await request.abort('connectionreset');
        return;
      }
      const response = await request.fetch();
      const payload = await response.json() as { notes?: Record<string, unknown[]> };
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

test('A hydrated responsive thread remains visible while navigation refresh is pending.', { timeout: 60_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  let releaseRefresh: (() => void) | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const route = await resolveResponsiveCardRoute(server.url);
    const expectedThreadId = `thread-${decodeURIComponent(route.split('/').at(-1) ?? '')}`;
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const refreshGate = new Promise<void>((resolveRefresh) => { releaseRefresh = resolveRefresh; });
    let holdTargetRefresh = false;
    let observeTargetRefresh!: () => void;
    let finishTargetRefresh!: () => void;
    const targetRefreshStarted = new Promise<void>((resolveStarted) => { observeTargetRefresh = resolveStarted; });
    const targetRefreshFinished = new Promise<void>((resolveFinished) => { finishTargetRefresh = resolveFinished; });
    let retainedPayload: Record<string, unknown> | null = null;
    await desktop.route('**/api/ledgers/*/threads/*', async (request) => {
      const threadId = decodeURIComponent(new URL(request.request().url()).pathname.split('/').at(-1) ?? '');
      if (threadId !== expectedThreadId) {
        await request.continue();
        return;
      }
      if (!retainedPayload) {
        const response = await request.fetch();
        const payload = await response.json() as { notes?: Record<string, unknown[]> };
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
      if (!holdTargetRefresh) {
        await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(retainedPayload) });
        return;
      }
      observeTargetRefresh();
      await refreshGate;
      await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(retainedPayload) });
      finishTargetRefresh();
    });

    await desktop.goto(`${server.url}${route}`, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    const retainedNote = desktop.locator('.thread-note').filter({ hasText: 'Retained across navigation.' });
    await retainedNote.waitFor({ state: 'visible', timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Close thread' }).click();
    await desktop.locator('.mobile-thread-inspector').waitFor({ state: 'hidden' });
    await desktop.goto(server.url, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#control-room-view:not([hidden])').waitFor({ state: 'visible' });
    await desktop.goBack();
    await desktop.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
    await desktop.getByRole('button', { name: 'Thread', exact: true }).click();
    await retainedNote.waitFor({ state: 'visible', timeout: 1_000 });
    holdTargetRefresh = true;
    await desktop.evaluate(async () => {
      const {
        activeThreadIdentityScope,
        loadActiveThreadSlice,
      } = await import('/src/runtime/thread/effect/load-active-thread-slice.js');
      const scope = activeThreadIdentityScope();
      if (!scope) throw new Error('Active thread identity scope is unavailable.');
      (window as Window & { __pendingBrowserThreadRefresh?: Promise<boolean> }).__pendingBrowserThreadRefresh =
        loadActiveThreadSlice(scope, { allowMissingContentFile: true });
    });
    await waitForSignal(targetRefreshStarted, 'Timed out waiting for the held thread refresh request.');
    await retainedNote.waitFor({ state: 'visible', timeout: 1_000 });
    releaseRefresh?.();
    const refreshApplied = desktop.evaluate(() => (
      (window as Window & { __pendingBrowserThreadRefresh?: Promise<boolean> }).__pendingBrowserThreadRefresh
    ));
    assert.equal(await waitForSignal(refreshApplied, 'Timed out waiting for the held thread refresh to settle.'), true);
    await waitForSignal(targetRefreshFinished, 'Timed out waiting for the intercepted thread response to finish.');
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
    let createdCardId = '';
    await desktop.route('**/decision-os/tasks**', async (route) => {
      // WHAT: Pass through every task endpoint request except the intake creation mutation under test.
      // WHY: The fixture must defer only the optimistic creation transition and preserve all unrelated task traffic.
      if (route.request().method() !== 'PATCH') return route.continue();
      const mutation = route.request().postDataJSON() as {
        action?: string;
        card?: { id?: string; [key: string]: unknown };
        annotation?: Record<string, unknown>;
      };
      // WHAT: Pass through PATCH mutations that do not create the pending task intake.
      // WHY: Only create-task-intake supplies the card identity needed to classify its later hydration request.
      if (mutation.action !== 'create-task-intake') return route.continue();
      createdCardId = mutation.card?.id ?? '';
      assert.ok(createdCardId, 'The create-task-intake mutation must contain the created card id.');
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
      const request = route.request();
      const createdCardPath = `/p/${encodeURIComponent(project.id)}/api/ledgers/tasks/cards/${encodeURIComponent(createdCardId)}`;
      // WHAT: Intercept only the pending card's exact project-scoped detail GET request.
      // WHY: Descendants such as execution-state and unrelated card reads must keep their normal request behavior.
      if (request.method() !== 'GET' || new URL(request.url()).pathname !== createdCardPath) return route.continue();
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

    assert.match(new URL(desktop.url()).pathname, /\/ledgers\/tasks\/cards\/[^/]+$/);
    assert.equal(await desktop.locator('.canvas').count(), 0);
    assert.equal(cardDetailReads, 0, 'route hydration must not read a card that is still locally owned');
    assert.deepEqual(pageErrors, []);
  } finally {
    releaseCreation?.();
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

test('Process Card pipelines reconcile pending admission, replicated success, rejection, and timeout.', { timeout: 60_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  let releaseSuccessfulAdmission: (() => void) | undefined;
  let releaseRejectedAdmission: (() => void) | undefined;
  try {
    // WHAT: Exercise success, rejection, and timeout through one served responsive browser lifecycle.
    // WHY: The optimistic contract requires pre-settlement UI evidence plus authoritative reconciliation.
    browser = await chromium.launch({
      headless: true,
      // WHAT: Use the platform-authoritative Chromium binary when it is installed.
      // WHY: The Linux runbook requires /snap/bin/chromium for served interaction evidence.
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const fixture = await resolvePipelineLaunchFixture(server.url);

    const successful = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let successfulProjection = fixture.projection;
    let observeSuccessfulAdmission!: (request: Record<string, unknown>) => void;
    const successfulAdmissionObserved = new Promise<Record<string, unknown>>((resolveObserved) => { observeSuccessfulAdmission = resolveObserved; });
    const successfulAdmissionGate = new Promise<void>((resolveAdmission) => { releaseSuccessfulAdmission = resolveAdmission; });
    await installFixturePipelineCatalog(successful);
    await successful.route('**/api/control-room', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(successfulProjection) }));
    await successful.route('**/api/codex/pipelines/runs', async (route) => {
      const request = route.request().postDataJSON() as Record<string, unknown>;
      observeSuccessfulAdmission(request);
      await successfulAdmissionGate;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, receipts: [{ requestId: `server:${String(request.requestId)}` }], run: { id: 'pipeline-run-success' } }),
      });
    });
    await successful.goto(`${server.url}${fixture.route}`, { waitUntil: 'domcontentloaded' });
    await startFixturePipeline(successful);
    const successfulRequest = await waitForSignal(successfulAdmissionObserved, 'Timed out waiting for the deferred successful admission.');
    await successful.waitForURL(`${server.url}/?tab=exec`);
    await successful.locator('.process-modal').waitFor({ state: 'hidden' });
    const pendingTask = successful.locator('[data-control-column="exec"] .control-task').filter({ hasText: fixture.task.title });
    await pendingTask.getByText(/^Preparing/).waitFor({ state: 'visible' });

    successfulProjection = executionProjection(fixture.projection, fixture.task, String(successfulRequest.requestId));
    releaseSuccessfulAdmission();
    await pendingTask.getByText(/^Queued/).waitFor({ state: 'visible' });
    const successfulTelemetry = await pipelineAdmissionTelemetry(successful, String(successfulRequest.requestId));
    assert.deepEqual(successfulTelemetry.map((entry) => entry.name), [
      'optimistic-projection-installed',
      'handoff-published',
      'admission-settled',
      'admission-deadline-cleared',
      'admission-reconciled',
    ]);
    assert.equal(successfulTelemetry.find((entry) => entry.name === 'admission-settled')?.args.outcome, 'accepted');
    await successful.reload({ waitUntil: 'domcontentloaded' });
    await successful.locator('[data-control-column="exec"] .control-task').filter({ hasText: fixture.task.title }).waitFor({ state: 'visible' });

    const rejected = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let observeRejectedAdmission!: (request: Record<string, unknown>) => void;
    const rejectedAdmissionObserved = new Promise<Record<string, unknown>>((resolveObserved) => { observeRejectedAdmission = resolveObserved; });
    const rejectedAdmissionGate = new Promise<void>((resolveAdmission) => { releaseRejectedAdmission = resolveAdmission; });
    await installFixturePipelineCatalog(rejected);
    await rejected.route('**/api/control-room', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.projection) }));
    await rejected.route('**/api/codex/pipelines/runs', async (route) => {
      observeRejectedAdmission(route.request().postDataJSON() as Record<string, unknown>);
      await rejectedAdmissionGate;
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Pipeline admission rejected.' }) });
    });
    await rejected.goto(`${server.url}${fixture.route}`, { waitUntil: 'domcontentloaded' });
    await startFixturePipeline(rejected);
    const rejectedRequest = await waitForSignal(rejectedAdmissionObserved, 'Timed out waiting for the deferred rejected admission.');
    await rejected.waitForURL(`${server.url}/?tab=exec`);
    await rejected.locator('[data-control-column="exec"] .control-task').filter({ hasText: fixture.task.title }).getByText(/^Preparing/).waitFor({ state: 'visible' });
    releaseRejectedAdmission();
    const rejectedAlert = rejected.locator('#mutation-error:not([hidden])');
    await rejectedAlert.waitFor({ state: 'visible' });
    assert.equal(await rejected.locator('#mutation-error-message').textContent(), 'Pipeline admission rejected.');
    await rejected.locator(`[data-control-tab="${fixture.confirmedTab}"]`).click();
    await rejected.locator(`[data-control-column="${fixture.confirmedTab}"] .control-task`).filter({ hasText: fixture.task.title }).waitFor({ state: 'visible' });
    await rejectedAlert.waitFor({ state: 'visible' });
    assert.equal(await rejected.locator('[data-control-column="exec"] .control-task').filter({ hasText: fixture.task.title }).count(), 0);
    const rejectedTelemetry = await pipelineAdmissionTelemetry(rejected, String(rejectedRequest.requestId));
    assert.deepEqual(rejectedTelemetry.map((entry) => entry.name), [
      'optimistic-projection-installed',
      'handoff-published',
      'admission-settled',
      'admission-deadline-cleared',
      'rejection-reconciled',
    ]);
    assert.equal(rejectedTelemetry.find((entry) => entry.name === 'admission-settled')?.args.outcome, 'rejected');

    const timedOut = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let timedOutRequest: Record<string, unknown> | undefined;
    await timedOut.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      // WHAT: Accelerate only the fixed production admission deadline inside this timeout fixture.
      // WHY: The served test must exercise timeout reconciliation without waiting thirty wall-clock seconds.
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) => (
        nativeSetTimeout(handler, timeout === 30_000 ? 50 : timeout, ...arguments_)
      )) as typeof window.setTimeout;
    });
    await installFixturePipelineCatalog(timedOut);
    await timedOut.route('**/api/control-room', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.projection) }));
    await timedOut.route('**/api/codex/pipelines/runs', async (route) => {
      timedOutRequest = route.request().postDataJSON() as Record<string, unknown>;
      await delay(1_000);
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true }) }).catch(() => undefined);
    });
    await timedOut.goto(`${server.url}${fixture.route}`, { waitUntil: 'domcontentloaded' });
    await startFixturePipeline(timedOut);
    await timedOut.waitForURL(`${server.url}/?tab=exec`);
    await timedOut.locator('#mutation-error:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await timedOut.locator('#mutation-error-message').textContent(), 'Pipeline admission timed out after 30000ms.');
    await timedOut.locator(`[data-control-tab="${fixture.confirmedTab}"]`).click();
    await timedOut.locator(`[data-control-column="${fixture.confirmedTab}"] .control-task`).filter({ hasText: fixture.task.title }).waitFor({ state: 'visible' });
    await timedOut.locator('#mutation-error:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await timedOut.locator('[data-control-column="exec"] .control-task').filter({ hasText: fixture.task.title }).count(), 0);
    assert.ok(timedOutRequest?.requestId);
    const timedOutTelemetry = await pipelineAdmissionTelemetry(timedOut, String(timedOutRequest.requestId));
    assert.deepEqual(timedOutTelemetry.map((entry) => entry.name), [
      'optimistic-projection-installed',
      'handoff-published',
      'admission-settled',
      'admission-deadline-cleared',
      'rejection-reconciled',
    ]);
    assert.equal(timedOutTelemetry.find((entry) => entry.name === 'admission-settled')?.args.outcome, 'timed-out');
  } finally {
    // WHAT: Release deferred admissions and close every browser resource after each outcome.
    // WHY: A failed assertion must not leave fixture promises or Chromium processes unsettled.
    releaseSuccessfulAdmission?.();
    releaseRejectedAdmission?.();
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function pipelineAdmissionTelemetry(page: Page, requestId: string): Promise<Array<{
  name: string;
  args: Record<string, unknown>;
}>> {
  const admittedNames = new Set([
    'optimistic-projection-installed',
    'handoff-published',
    'admission-settled',
    'admission-deadline-cleared',
    'admission-reconciled',
    'rejection-reconciled',
  ]);
  return await page.evaluate(({ expectedRequestId, names }) => (
    ((window as typeof window & { __coreTelemetry?: Array<{ name: string; args: Record<string, unknown> }> }).__coreTelemetry ?? [])
      .filter((entry) => names.includes(entry.name) && String(entry.args.requestId ?? '') === expectedRequestId)
  ), { expectedRequestId: requestId, names: [...admittedNames] });
}

test('Master-task completion exposes manual and configured pipeline actions at desktop and mobile widths.', { timeout: 60_000 }, async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const project = await resolveCurrentProject(server.url);
    const masterTaskFixture = localResponsiveCardFixture(project.id);
    const route = masterTaskFixture.route;
    const settingsPayload = JSON.stringify({
      ok: true,
      maxConcurrentCodexProcesses: 1,
      voicePipelineId: '',
      masterTaskCompletionPipelineId: 'complete-master-task',
      pipelines: [{ id: 'complete-master-task', name: 'Complete master task' }],
    });

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let pipelineRequest: Record<string, unknown> | undefined;
    await installMasterTaskCardFixture(desktop, masterTaskFixture.task);
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
    await installMasterTaskCardFixture(unconfigured, masterTaskFixture.task);
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
    await installMasterTaskCardFixture(rejected, masterTaskFixture.task);
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
    await installMasterTaskCardFixture(mobile, masterTaskFixture.task);
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
  const project = catalog.projects?.find((candidate) => candidate.root === browserWorkspaceRoot());
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

type PipelineLaunchTask = {
  projectId: string;
  ledgerId: string;
  cardId: string;
  zoneId?: string;
  title: string;
  assignedNodeId?: string;
  assignedNodeLabel?: string;
  [key: string]: unknown;
};

type PipelineLaunchProjection = {
  queue: PipelineLaunchTask[];
  exec: PipelineLaunchTask[];
  backlog: PipelineLaunchTask[];
  done: PipelineLaunchTask[];
  allTasks: PipelineLaunchTask[];
  [key: string]: unknown;
};

async function resolvePipelineLaunchFixture(serverUrl: string): Promise<{
  route: string;
  task: PipelineLaunchTask;
  confirmedTab: 'queue' | 'backlog';
  projection: PipelineLaunchProjection;
}> {
  const project = await resolveCurrentProject(serverUrl);
  const authoritativeProjection = await fetch(`${serverUrl}/api/control-room`).then((response) => response.json()) as PipelineLaunchProjection;
  const fixture = localResponsiveCardFixture(project.id);
  const task = {
    ...fixture.task,
    projectId: project.id,
    projectName: project.name,
    ownerNodeId: 'browser-fixture',
    assignedNodeId: 'browser-fixture',
    assignedNodeLabel: 'Browser fixture',
    assignedNodeOnline: true,
    assignment: { nodeId: 'browser-fixture', revision: 1 },
    cardStatus: 'backlog',
    lifecycle: { status: 'backlog' },
    status: 'task-backlog',
    labels: [],
    diagnostics: [],
    masterTask: true,
    subtasks: [],
    complete: 0,
    valid: true,
  };
  // WHAT: Give the served browser one deterministic server-confirmed Backlog placement.
  // WHY: A clean worktree intentionally has no mutable tasks ledger for /api/control-room to supply.
  const projection = {
    ...authoritativeProjection,
    queue: [],
    exec: [],
    backlog: [task],
    done: [],
    allTasks: [task],
  };
  return { route: fixture.route, task, confirmedTab: 'backlog', projection };
}

async function installMasterTaskCardFixture(page: Page, task: PipelineLaunchTask): Promise<void> {
  await page.route(`**/api/ledgers/${encodeURIComponent(task.ledgerId)}/cards/${encodeURIComponent(task.cardId)}`, async (route) => {
    const response = await route.fetch();
    const card = await response.json() as Record<string, unknown>;
    await route.fulfill({
      response,
      contentType: 'application/json',
      body: JSON.stringify({
        ...card,
        status: 'todo',
        lifecycle: { status: 'todo', waitingAt: '2026-07-31T00:00:00.000Z' },
        assignment: { nodeId: 'browser-fixture', revision: 1 },
        labels: ['master-task'],
      }),
    });
  });
}

async function installFixturePipelineCatalog(page: Page): Promise<void> {
  await page.route('**/api/codex/skills', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, skills: [], availableTags: [] }),
  }));
  await page.route('**/api/codex/pipelines', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      pipelines: [{ id: 'optimistic-browser-pipeline', name: 'Optimistic browser pipeline', purpose: 'Browser admission fixture.', stepIds: [] }],
      steps: [],
      availableContent: [],
      issues: [],
    }),
  }));
}

async function startFixturePipeline(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Process card', exact: true }).click();
  await page.locator('.process-modal[open]').waitFor({ state: 'visible' });
  await page.locator('[data-process-tab="pipelines"]').click();
  await page.locator('.codex-list-item').filter({ hasText: 'Optimistic browser pipeline' }).click();
  await page.getByRole('button', { name: 'Start pipeline', exact: true }).click();
}

function executionProjection(projection: PipelineLaunchProjection, target: PipelineLaunchTask, requestId: string): PipelineLaunchProjection {
  const next = structuredClone(projection);
  const matchesTarget = (task: PipelineLaunchTask) => (
    task.projectId === target.projectId && task.ledgerId === target.ledgerId && task.cardId === target.cardId
  );
  const executingTask = {
    ...target,
    status: 'task-execution',
    executionStatus: 'queued',
    executionSince: '2026-07-31T00:00:00.000Z',
    execution: {
      executionId: 'execution-browser-success',
      requestId,
      phase: 'queued',
      phaseSince: '2026-07-31T00:00:00.000Z',
      revision: 1,
      executorNodeId: target.assignedNodeId || '',
    },
  };
  // WHAT: Replace the fixture task with its authoritative admitted execution in every projection collection.
  // WHY: Reload survival must read one canonical task identity without stale duplicate placement.
  for (const collection of ['queue', 'exec', 'backlog', 'done', 'allTasks'] as const) {
    next[collection] = next[collection].filter((task) => !matchesTarget(task));
  }
  next.exec = [executingTask, ...next.exec];
  next.allTasks = [executingTask, ...next.allTasks];
  return next;
}

function localResponsiveCardFixture(projectId?: string): { route: string; task: PipelineLaunchTask } {
  // WHAT: Resolve every authored fixture file from the same isolated workspace served by the browser server.
  // WHY: The implementation worktree's .decision-os submodule is not the fixture authority and may lack the copied project data.
  const workspaceRoot = browserWorkspaceRoot();
  const project = JSON.parse(readFileSync(resolve(workspaceRoot, '.decision-os/project.json'), 'utf8')) as { id?: string };
  const registry = JSON.parse(readFileSync(resolve(workspaceRoot, '.decision-os/state.json'), 'utf8')) as {
    ledgers?: Array<{ id?: string; ledgerFile?: string }>;
  };
  assert.ok(project.id, 'The browser fixture must expose a project identity.');
  // WHAT: Prefer the catalog-resolved project identity while retaining the local helper fallback.
  // WHY: Served worktree identities can differ from the committed project metadata used by static helpers.
  const fixtureProjectId = projectId ?? project.id;
  for (const ledgerRef of registry.ledgers ?? []) {
    // WHAT: Ignore incomplete registry entries that cannot address a card.
    // WHY: Only a concrete ledger identity and file can produce a deterministic served route.
    if (!ledgerRef.id || !ledgerRef.ledgerFile) continue;
    const ledgerFile = resolve(workspaceRoot, ledgerRef.ledgerFile);
    // WHAT: Skip runtime-owned ledgers that are intentionally absent from a clean worktree.
    // WHY: Browser fixtures must rely only on committed workspace content.
    if (!existsSync(ledgerFile)) continue;
    const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8')) as {
      annotations?: Array<{ id?: string; variant?: string; color?: string }>;
      cards?: Array<{ id?: string; title?: string }>;
      threadFiles?: Record<string, string>;
    };
    const zone = ledger.annotations?.find((candidate) => candidate.id && candidate.variant !== 'group' && typeof candidate.color === 'string');
    const card = ledger.cards?.find((candidate) => candidate.id && ledger.threadFiles?.[`thread-${candidate.id}`]);
    // WHAT: Continue until one committed zone, card, and thread form a complete route fixture.
    // WHY: The card view must hydrate normally before the mocked Control Room projection is exercised.
    if (!zone?.id || !card?.id) continue;
    return {
      route: `/p/${encodeURIComponent(fixtureProjectId)}/ledgers/${encodeURIComponent(ledgerRef.id)}/zones/${encodeURIComponent(zone.id)}/cards/${encodeURIComponent(card.id)}`,
      task: {
        projectId: fixtureProjectId,
        ledgerId: ledgerRef.id,
        cardId: card.id,
        zoneId: zone.id,
        // WHAT: Use the stable card identity when committed fixture content has no authored title.
        // WHY: Every rendered Control Room task requires a non-empty deterministic label.
        title: card.title || card.id,
      },
    };
  }
  assert.fail('The browser fixture must expose one local card, zone, and thread.');
}

async function resolveCurrentProject(serverUrl: string): Promise<{ id: string; name: string }> {
  const catalog = await fetch(`${serverUrl}/decision-os/projects`).then((response) => response.json()) as {
    projects?: Array<{ id: string; name: string; root: string }>;
  };
  const project = catalog.projects?.find((candidate) => candidate.root === browserWorkspaceRoot());
  assert.ok(project, 'The test workspace must be registered in its project catalog.');
  return project;
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
    cwd: browserWorkspaceRoot(),
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

async function waitForSignal<T>(signal: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    signal,
    delay(5_000).then(() => { throw new Error(message); }),
  ]);
}
