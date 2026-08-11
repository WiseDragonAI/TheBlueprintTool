/**
 * WHAT: Proves the global Ledgers route groups owner-local ledgers under closed native project disclosures.
 * WHY: Static renderer and stylesheet checks cannot prove the catalog, responsive boundary, keyboard behavior, and navigation work together.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
const emptyLedger = {
  cards: [],
  annotations: [],
  relationships: [],
  notes: {},
  threadFiles: {},
};

type FixtureServer = {
  process: ChildProcess;
  url: string;
};

type CatalogProject = {
  id: string;
  name: string;
  ledgers: Array<{ id: string; title: string }>;
};

type CatalogFixture = {
  workspace: string;
};

test('global Ledgers groups ledgers by collapsed project', { timeout: 45_000 }, async () => {
  const fixture = createCatalogFixture();
  let server: FixtureServer | undefined;
  let browser: Browser | undefined;
  try {
    server = await startDecisionOsServer(fixture.workspace);
    await assertAuthoritativeCatalog(server.url);
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    await exerciseGlobalLedgers(browser, server.url);
  } finally {
    // WHAT: Close Chromium whenever its launch completed, including after a browser assertion fails.
    // WHY: The focused test owns and must release every disposable browser process.
    if (browser) await browser.close();
    // WHAT: Stop only the detached fixture server process owned by this test.
    // WHY: Operator servers remain outside the isolated browser-test lifecycle.
    if (server) await stopDecisionOsServer(server.process);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

async function exerciseGlobalLedgers(browser: Browser, serverUrl: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 759, height: 844 } });
  const pageErrors = collectPageErrors(page);
  try {
    const response = await page.goto(`${serverUrl}/ledgers`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.locator('#overview-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#overview-summary').textContent(), '3 ledgers across 3 projects');
    assert.equal(await page.locator('.create-ledger-button').isHidden(), true);
    assert.equal(await page.locator('details.overview-project').count(), 3);
    assert.equal(await page.locator('details.overview-project[open]').count(), 0);

    const alpha = page.locator('details.overview-project[data-project-id="project-alpha"]');
    const beta = page.locator('details.overview-project[data-project-id="project-beta"]');
    const gamma = page.locator('details.overview-project[data-project-id="project-gamma"]');
    const alphaSummary = alpha.locator(':scope > .overview-project-summary');
    await alphaSummary.click();
    assert.equal(await alpha.evaluate((row) => (row as HTMLDetailsElement).open), true);
    assert.equal(await page.locator('.overview-ledger:visible').count(), 2);
    assert.deepEqual(await alpha.locator('.overview-ledger').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), [
      '/p/project-alpha/ledgers/tasks',
      '/p/project-alpha/ledgers/notes',
    ]);
    assert.deepEqual(await alpha.locator('.overview-ledger h2').allTextContents(), ['Tasks', 'Notes']);
    assert.equal(await beta.locator('.overview-ledger').count(), 1);
    assert.equal(await gamma.locator('.overview-ledger').count(), 0);
    assert.equal(await gamma.locator('.overview-project-empty').textContent(), 'No ledgers');
    await assertSingleNestedColumn(page);
    await assertResponsiveBounds(page);

    await page.setViewportSize({ width: 760, height: 844 });
    await page.waitForFunction(() => window.innerWidth === 760);
    await assertTwoNestedColumns(alpha);
    await assertResponsiveBounds(page);

    const betaSummary = beta.locator(':scope > .overview-project-summary');
    await betaSummary.focus();
    await page.keyboard.press('Space');
    assert.equal(await beta.evaluate((row) => (row as HTMLDetailsElement).open), true);
    assert.deepEqual(await beta.locator('.overview-ledger h2').allTextContents(), ['Tasks']);
    assert.equal(await beta.locator('.overview-ledger').getAttribute('href'), '/p/project-beta/ledgers/tasks');
    assert.doesNotMatch(await beta.textContent() ?? '', /Notes/);

    const gammaSummary = gamma.locator(':scope > .overview-project-summary');
    await gammaSummary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await gamma.evaluate((row) => (row as HTMLDetailsElement).open), true);
    assert.equal(await gamma.locator('.overview-project-empty').isVisible(), true);
    assert.equal(await gamma.locator('.overview-ledger').count(), 0);
    assert.doesNotMatch(await alpha.textContent() ?? '', /project-beta/);
    await assertResponsiveBounds(page);

    await alpha.locator('.overview-ledger').filter({ hasText: 'Tasks' }).click();
    await page.locator('#ledger-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).pathname, '/p/project-alpha/ledgers/tasks');
    assert.equal(await page.locator('#ledger-title').textContent(), 'Tasks');
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({
      browserEvidence: 'global-ledgers-project-groups',
      httpStatus: response?.status() ?? null,
      viewports: [759, 760],
      aggregateSummary: '3 ledgers across 3 projects',
      projectDisclosures: 3,
      pointerExpanded: 'project-alpha',
      keyboardExpanded: ['project-beta', 'project-gamma'],
      navigationPath: new URL(page.url()).pathname,
      pageErrors,
      horizontalOverflow: false,
    }));
  } finally {
    await page.close();
  }
}

async function assertAuthoritativeCatalog(serverUrl: string): Promise<void> {
  const response = await fetchWithDeadline(`${serverUrl}/decision-os/projects`);
  assert.equal(response.status, 200);
  const catalog = await response.json() as { projects?: CatalogProject[] };
  assert.deepEqual(catalog.projects?.map((project) => ({
    id: project.id,
    name: project.name,
    ledgerCount: project.ledgers.length,
  })), [
    { id: 'project-alpha', name: 'Alpha Project', ledgerCount: 2 },
    { id: 'project-beta', name: 'Beta Project', ledgerCount: 1 },
    { id: 'project-gamma', name: 'Gamma Project', ledgerCount: 0 },
  ]);
}

async function assertSingleNestedColumn(page: Page): Promise<void> {
  const columns = await page.locator('details.overview-project[data-project-id="project-alpha"] .overview-project-ledgers').evaluate((node) => (
    getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
  ));
  assert.equal(columns, 1);
}

async function assertTwoNestedColumns(alpha: ReturnType<Page['locator']>): Promise<void> {
  const cards = alpha.locator('.overview-ledger');
  const bounds = await cards.evaluateAll((links) => links.map((link) => {
    const rect = link.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width };
  }));
  assert.equal(bounds.length, 2);
  assert.equal(bounds[0].y, bounds[1].y);
  assert.ok(bounds[0].x < bounds[1].x, JSON.stringify(bounds));
}

async function assertResponsiveBounds(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('.overview-project-list')?.getBoundingClientRect();
    return {
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      wrapper: wrapper ? { left: wrapper.left, right: wrapper.right } : null,
      projects: [...document.querySelectorAll<HTMLElement>('details.overview-project')].map((project) => {
        const rect = project.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    };
  });
  assert.ok(layout.wrapper, JSON.stringify(layout));
  assert.ok(layout.bodyWidth <= layout.viewportWidth, JSON.stringify(layout));
  assert.ok(layout.documentWidth <= layout.viewportWidth, JSON.stringify(layout));
  // WHAT: Compare every project disclosure to the shared project-list width.
  // WHY: The Ledgers contract requires each project row to occupy the full host width at both breakpoints.
  for (const project of layout.projects) {
    assert.equal(project.left, layout.wrapper.left, JSON.stringify(layout));
    assert.equal(project.right, layout.wrapper.right, JSON.stringify(layout));
  }
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    // WHAT: Preserve the established allowance for optional missing thread-file resources.
    // WHY: The focused Ledgers route does not own thread-file creation for empty fixture ledgers.
    if (response.status() === 404 && response.url().includes('/.decision-os/thread-files/')) return;
    // WHAT: Record every other failed served-route response.
    // WHY: Browser success must include the HTTP boundary, not only rendered DOM assertions.
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    // WHAT: Ignore Chromium's resource-load shell message while preserving application console failures.
    // WHY: The established test allowance distinguishes generic resource notices from JavaScript errors.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
  });
  return errors;
}

function createCatalogFixture(): CatalogFixture {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-global-ledgers-browser-'));
  const rootDecisionOs = join(workspace, '.decision-os');
  mkdirSync(rootDecisionOs, { recursive: true });
  writeFileSync(join(rootDecisionOs, '.settings.json'), `${JSON.stringify({
    federationRelayUrl: '',
    federationId: '',
    federationNodeId: '',
    federationNodeLabel: '',
    federationNodeCredential: '',
  }, null, 2)}\n`);
  const projects = [
    { directory: 'alpha', id: 'project-alpha', name: 'Alpha Project', description: 'Owns Tasks and Notes.', color: '#38d9e8', ledgers: [{ id: 'tasks', title: 'Tasks' }, { id: 'notes', title: 'Notes' }] },
    { directory: 'beta', id: 'project-beta', name: 'Beta Project', description: 'Owns Tasks.', color: '#a78bfa', ledgers: [{ id: 'tasks', title: 'Tasks' }] },
  ];
  // WHAT: Materialize only the available fixture projects with identity-matched state and ledger files.
  // WHY: Gamma must remain unavailable so catalog startup cannot synthesize its Tasks ledger.
  for (const project of projects) {
    const decisionOsRoot = join(workspace, project.directory, '.decision-os');
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'project.json'), `${JSON.stringify({ id: project.id })}\n`);
    writeFileSync(join(decisionOsRoot, 'state.json'), `${JSON.stringify({
      ledgers: project.ledgers.map((ledger) => ({
        id: ledger.id,
        title: ledger.title,
        ledgerFile: `.decision-os/${ledger.id}.json`,
      })),
    })}\n`);
    // WHAT: Persist every ledger listed in the available project's state document.
    // WHY: The served catalog must load real Alpha and Beta ledger records before browser assertions begin.
    for (const ledger of project.ledgers) writeFileSync(join(decisionOsRoot, `${ledger.id}.json`), `${JSON.stringify(emptyLedger)}\n`);
  }
  writeFileSync(join(rootDecisionOs, 'projects.json'), `${JSON.stringify({
    version: 2,
    projects: {
      'project-alpha': registryEntry(projects[0]),
      'project-beta': registryEntry(projects[1]),
      'project-gamma': {
        id: 'project-gamma',
        relativePath: 'gamma-intentionally-unavailable',
        name: 'Gamma Project',
        description: 'Registered with no available ledgers.',
        color: '#34d399',
        registeredAt: '2026-08-12T00:00:00.000Z',
        cardId: 'project-card:project-gamma',
      },
    },
  }, null, 2)}\n`);
  return { workspace };
}

function registryEntry(project: { directory: string; id: string; name: string; description: string; color: string }): Record<string, string> {
  return {
    id: project.id,
    relativePath: project.directory,
    name: project.name,
    description: project.description,
    color: project.color,
    registeredAt: '2026-08-12T00:00:00.000Z',
    cardId: `project-card:${project.id}`,
  };
}

async function startDecisionOsServer(workspace: string): Promise<FixtureServer> {
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
      DECISION_OS_LAUNCHER_MAX_RESTARTS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => appendBoundedOutput(output, String(chunk)));
  child.stderr?.on('data', (chunk) => appendBoundedOutput(output, String(chunk)));
  try {
    await waitFor(async () => {
      assert.equal(child.exitCode, null, `decision-os fixture server exited early:\n${output.join('')}`);
      const response = await fetchWithDeadline(url, 'HEAD').catch(() => undefined);
      return Boolean(response?.ok);
    }, `Timed out waiting for the decision-os fixture server at ${url}:\n${output.join('')}`);
    return { process: child, url };
  } catch (error) {
    // WHAT: Stop a spawned fixture server when readiness fails before its handle is returned.
    // WHY: A failed startup must not retain an owned detached process group.
    await stopDecisionOsServer(child);
    throw error;
  }
}

function appendBoundedOutput(output: string[], chunk: string): void {
  const limit = 32 * 1024;
  const currentLength = output.reduce((total, entry) => total + entry.length, 0);
  const remaining = limit - currentLength;
  // WHAT: Stop retaining server output once the diagnostic cap is reached.
  // WHY: A failing fixture server must not consume unbounded test-process memory.
  if (remaining <= 0) return;
  output.push(chunk.slice(0, remaining));
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  // WHAT: Skip shutdown signaling when the fixture process already settled.
  // WHY: Re-signaling a recycled process-group id could affect an unrelated process.
  if (child.exitCode !== null || child.signalCode !== null) return;
  assert.ok(child.pid, 'The detached fixture server must expose a process id.');
  process.kill(-child.pid, 'SIGTERM');
  await waitForProcessExit(child, 2_000);
  // WHAT: Escalate only when the owned process group did not settle after SIGTERM.
  // WHY: Cleanup must finish within a bounded deadline without controlling any operator server.
  if (child.exitCode === null && child.signalCode === null) {
    process.kill(-child.pid, 'SIGKILL');
    await waitForProcessExit(child, 2_000);
  }
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'The owned fixture process must settle after bounded shutdown.');
}

async function waitForProcessExit(child: ChildProcess, timeoutMilliseconds: number): Promise<void> {
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    delay(timeoutMilliseconds),
  ]);
}

async function fetchWithDeadline(url: string, method = 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, { method, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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
  // WHAT: Poll fixture readiness only until the bounded startup deadline.
  // WHY: Browser verification must fail deterministically when its owned server cannot start.
  while (Date.now() < deadline) {
    // WHAT: Return as soon as the isolated server answers successfully.
    // WHY: No further readiness probes are needed after the fixture is available.
    if (await check()) return;
    await delay(50);
  }
  throw new Error(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
