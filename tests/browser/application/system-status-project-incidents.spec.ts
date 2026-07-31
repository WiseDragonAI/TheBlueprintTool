/**
 * WHAT: Exercises owner-nested runtime incidents through native project disclosures on the served status route.
 * WHY: Projection and shell assertions do not prove pointer, keyboard, responsive, and ownership behavior in Chromium.
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

type IncidentDiagnostics = {
  observedAt?: string;
  historyTruncatedBefore?: string;
  incidents: Array<{ code?: string }>;
};

type CatalogFixture = {
  workspace: string;
  evidence: {
    alphaPaused: string[];
    alphaResolved: string;
    betaRecent: string[];
    systemResolved: string;
  };
};

test('System status renders collapsed rolling failure history at desktop and mobile widths', { timeout: 45_000 }, async () => {
  const fixture = createCatalogFixture();
  let server: FixtureServer | undefined;
  let browser: Browser | undefined;
  try {
    server = await startDecisionOsServer(fixture.workspace);
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    await exerciseStatusViewport(browser, server.url, { width: 1440, height: 1000 }, fixture.evidence);
    await exerciseStatusViewport(browser, server.url, { width: 390, height: 844 }, fixture.evidence);
    await proveTruncatedTotals(browser, server.url);
    await proveConditionalSystemRow(browser, server.url);
  } finally {
    // WHAT: Close Chromium whenever launch completed, including after an assertion failure.
    // WHY: The focused test must not retain a disposable browser process.
    if (browser) await browser.close();
    // WHAT: Stop only the detached fixture server process owned by this test.
    // WHY: Existing operator servers are outside the isolated browser-test boundary.
    if (server) await stopDecisionOsServer(server.process);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

async function exerciseStatusViewport(
  browser: Browser,
  serverUrl: string,
  viewport: { width: number; height: number },
  evidence: CatalogFixture['evidence'],
): Promise<void> {
  const page = await browser.newPage({ viewport });
  const pageErrors = collectPageErrors(page);
  try {
    const response = await page.goto(`${serverUrl}/status`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.locator('#runtime-status-view:not([hidden])').waitFor({ state: 'visible' });

    const alpha = page.locator('.runtime-project-row[data-project-id="project-alpha"]');
    const beta = page.locator('.runtime-project-row[data-project-id="project-beta"]');
    const gamma = page.locator('.runtime-project-row[data-project-id="project-gamma"]');
    const system = page.locator('.runtime-project-row[data-project-id="system"]');
    assert.equal(await page.locator('.runtime-project-row').count(), 4);
    assert.equal(await page.locator('.runtime-project-row[open]').count(), 0);

    assert.match(await alpha.locator(':scope > .runtime-project-summary').textContent() ?? '', /At least 4 failures · 24h/);
    assert.equal(await alpha.locator('.runtime-project-availability').textContent(), 'Paused');
    assert.match(await beta.locator(':scope > .runtime-project-summary').textContent() ?? '', /2 failures · 24h/);
    assert.equal(await beta.locator('.runtime-project-occurrences').getAttribute('data-partial'), 'false');
    assert.match(await gamma.locator(':scope > .runtime-project-summary').textContent() ?? '', /0 failures · 24h/);
    assert.match(await system.locator(':scope > .runtime-project-summary').textContent() ?? '', /1 failure · 24h/);
    assert.equal(await system.locator('.runtime-project-availability').textContent(), 'History');
    assert.equal(await system.getAttribute('data-status'), 'available');

    const alphaSummary = alpha.locator(':scope > .runtime-project-summary');
    assert.equal(await alphaSummary.count(), 1);
    await alphaSummary.click();
    assert.equal(await alpha.evaluate((row) => (row as HTMLDetailsElement).open), true);
    assert.equal(await alpha.locator('.runtime-history-lower-bound').isVisible(), true);
    assert.match(await alpha.locator('.runtime-history-lower-bound').textContent() ?? '', /earlier owner history is unavailable/);
    assert.equal(await alpha.locator('.runtime-incident-card').count(), 2);
    const alphaShared = alpha.locator('.runtime-incident-card').filter({ hasText: 'shared_outage' });
    assert.equal(await alphaShared.count(), 1);
    assert.match(await alphaShared.textContent() ?? '', /3 occurrences · 24h/);
    assert.deepEqual(await alphaShared.locator('.runtime-incident-message').allTextContents(), [
      'Resolved alpha runtime message.',
      'Alpha worker message.',
      'Alpha worker message.',
    ]);
    assert.deepEqual(await alphaShared.locator('time').evaluateAll((times) => times.map((time) => time.getAttribute('datetime'))), [
      evidence.alphaResolved,
      ...[...evidence.alphaPaused].reverse(),
    ]);
    const alphaSources = await alphaShared.locator('.runtime-incident-source').allTextContents();
    assert.match(alphaSources.join(' '), /Componentalpha-runtimeScopeproject-runtime:project-alphaContextprojectId=project-alpha · outcome=recovered/);
    assert.match(alphaSources.join(' '), /alpha-worker/);
    assert.equal(await alphaShared.locator('[data-kind="severity"]').textContent(), 'fatal');
    assert.equal(await alphaShared.locator('[data-kind="interruption"]').textContent(), 'Interruption');
    const alphaLegacy = alpha.locator('.runtime-incident-card').filter({ hasText: 'legacy_failure' });
    assert.equal(await alphaLegacy.count(), 1);
    assert.match(await alphaLegacy.textContent() ?? '', /At least 1 occurrence · 24h/);
    assert.equal(await page.getByText('Expired alpha history.', { exact: true }).count(), 0);

    assert.equal(await beta.locator('.runtime-incident-card').count(), 1);
    assert.equal(await gamma.locator('.runtime-incident-card').count(), 0);
    assert.equal(await system.locator('.runtime-incident-card').count(), 1);
    assert.equal(
      await page.locator('.runtime-incident-card').filter({ hasText: 'shared_outage' }).count(),
      2,
      'identical codes must remain separate across owners',
    );

    const betaSummary = beta.locator(':scope > .runtime-project-summary');
    assert.equal(await betaSummary.count(), 1);
    await betaSummary.focus();
    await page.keyboard.press('Space');
    assert.equal(await beta.evaluate((row) => (row as HTMLDetailsElement).open), true);
    assert.match(await beta.textContent() ?? '', /beta-pipeline · 2 occurrences · 24h · last /);
    assert.equal(await beta.locator('[data-kind="severity"]').textContent(), 'error');
    assert.equal(await beta.locator('[data-kind="interruption"]').textContent(), 'Active');
    assert.deepEqual(await beta.locator('time').evaluateAll((times) => times.map((time) => time.getAttribute('datetime'))), [
      ...[...evidence.betaRecent].reverse(),
    ]);
    assert.match(await beta.locator('.runtime-incident-source').allTextContents().then((values) => values.join(' ')), /pipeline:project-beta:run-1/);
    assert.doesNotMatch(await beta.textContent() ?? '', /Alpha worker message|Resolved alpha runtime message/);

    const systemSummary = system.locator(':scope > .runtime-project-summary');
    assert.equal(await systemSummary.count(), 1);
    await systemSummary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await system.evaluate((row) => (row as HTMLDetailsElement).open), true);
    assert.match(await system.textContent() ?? '', /catalog_unowned/);
    assert.match(await system.textContent() ?? '', /Resolved unowned catalog evidence\./);
    assert.equal(await system.locator('[data-kind="severity"]').textContent(), 'warning');
    assert.equal(await system.locator('[data-kind="interruption"]').textContent(), 'Resolved');
    assert.equal(await system.locator('time').getAttribute('datetime'), evidence.systemResolved);
    assert.doesNotMatch(await alpha.textContent() ?? '', /catalog_unowned/);
    assert.doesNotMatch(await beta.textContent() ?? '', /catalog_unowned/);

    const layout = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      rowBounds: [...document.querySelectorAll<HTMLElement>('.runtime-project-row')].map((row) => {
        const bounds = row.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      }),
    }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, JSON.stringify(layout));
    assert.ok(layout.documentWidth <= layout.viewportWidth, JSON.stringify(layout));
    // WHAT: Validate every rendered owner row against the active viewport boundary.
    // WHY: One overflowing row is sufficient to break the responsive status surface.
    for (const bounds of layout.rowBounds) {
      assert.ok(bounds.left >= 0, JSON.stringify(layout));
      assert.ok(bounds.right <= layout.viewportWidth, JSON.stringify(layout));
    }
    const alphaBounds = await alpha.boundingBox();
    const alphaIncidentBounds = await alphaShared.boundingBox();
    assert.ok(alphaBounds && alphaIncidentBounds);
    assert.ok(alphaIncidentBounds.x >= alphaBounds.x);
    assert.ok(alphaIncidentBounds.x + alphaIncidentBounds.width <= alphaBounds.x + alphaBounds.width);
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({
      browserEvidence: 'project-failure-history',
      httpStatus: response?.status() ?? null,
      viewport,
      initiallyOpen: 0,
      pointerExpanded: 'project-alpha',
      keyboardExpanded: ['project-beta', 'system'],
      pageErrors,
      horizontalOverflow: false,
    }));
  } finally {
    await page.close();
  }
}

async function proveTruncatedTotals(browser: Browser, serverUrl: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const pageErrors = collectPageErrors(page);
  try {
    await page.route('**/api/diagnostics/incidents', async (route) => {
      const response = await route.fetch();
      const diagnostics = await response.json() as IncidentDiagnostics;
      diagnostics.historyTruncatedBefore = diagnostics.observedAt ?? new Date().toISOString();
      await route.fulfill({ response, json: diagnostics });
    });
    const response = await page.goto(`${serverUrl}/status`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.locator('#runtime-status-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.runtime-project-occurrences[data-partial="true"]').count(), 4);
    assert.equal(await page.locator('.runtime-project-occurrences[data-partial="false"]').count(), 0);
    const alpha = page.locator('.runtime-project-row[data-project-id="project-alpha"]');
    const alphaSummary = alpha.locator(':scope > .runtime-project-summary');
    assert.equal(await alphaSummary.count(), 1);
    await alphaSummary.click();
    assert.equal(await alpha.locator('.runtime-history-lower-bound').isVisible(), true);
    assert.match(await alpha.locator('.runtime-history-lower-bound').textContent() ?? '', /retained system history was truncated/);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
}

async function proveConditionalSystemRow(browser: Browser, serverUrl: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const pageErrors = collectPageErrors(page);
  try {
    await page.route('**/api/diagnostics/incidents', async (route) => {
      const response = await route.fetch();
      const diagnostics = await response.json() as IncidentDiagnostics;
      // WHAT: Remove the fixture's only unowned recent incident from this isolated response.
      // WHY: The System disclosure must disappear when every retained failure has a catalog owner.
      diagnostics.incidents = diagnostics.incidents.filter((incident) => incident.code !== 'catalog_unowned');
      await route.fulfill({ response, json: diagnostics });
    });
    const response = await page.goto(`${serverUrl}/status`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.locator('#runtime-status-view:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.runtime-project-row[data-project-id="system"]').count(), 0);
    assert.equal(await page.locator('.runtime-project-row').count(), 3);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

function createCatalogFixture(): CatalogFixture {
  const fixtureClock = Date.now();
  const at = (offsetMilliseconds: number): string => new Date(fixtureClock + offsetMilliseconds).toISOString();
  const evidence: CatalogFixture['evidence'] = {
    alphaPaused: [at(-4 * 60 * 60 * 1_000), at(-2 * 60 * 60 * 1_000)],
    alphaResolved: at(-60 * 60 * 1_000),
    betaRecent: [at(-45 * 60 * 1_000), at(-15 * 60 * 1_000)],
    systemResolved: at(-20 * 60 * 1_000),
  };
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-system-status-browser-'));
  const rootDecisionOs = join(workspace, '.decision-os');
  mkdirSync(rootDecisionOs, { recursive: true });
  writeFileSync(join(rootDecisionOs, '.settings.json'), JSON.stringify({
    federationRelayUrl: '',
    federationId: '',
    federationNodeId: '',
    federationNodeLabel: '',
    federationNodeCredential: '',
  }));
  writeFileSync(join(rootDecisionOs, 'projects.json'), JSON.stringify({
    projects: {
      'project-alpha': { name: 'Alpha Project', description: 'Owns mixed-severity incidents.', color: '#38d9e8' },
      'project-beta': { name: 'Beta Project', description: 'Owns an identical incident independently.', color: '#a78bfa' },
      'project-gamma': { name: 'Gamma Project', description: 'Has no active incidents.', color: '#34d399' },
    },
  }));
  // WHAT: Create each stable catalog project with the smallest valid Tasks ledger.
  // WHY: The browser scenario must exercise real catalog discovery without repository-owned fixtures.
  for (const project of [
    { directory: 'alpha', id: 'project-alpha' },
    { directory: 'beta', id: 'project-beta' },
    { directory: 'gamma', id: 'project-gamma' },
  ]) {
    const decisionOsRoot = join(workspace, project.directory, '.decision-os');
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: project.id }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify(emptyLedger));
  }
  writeFileSync(join(rootDecisionOs, 'runtime-incidents.json'), JSON.stringify({
    version: 2,
    updatedAt: at(-5 * 60 * 1_000),
    historyTruncatedBefore: at(-25 * 60 * 60 * 1_000),
    incidents: [
      {
        id: 'incident-alpha-paused',
        fingerprint: 'fixture-alpha-paused',
        status: 'paused',
        severity: 'warning',
        scope: 'project-runtime:project-alpha',
        component: 'alpha-worker',
        operation: 'read-alpha-ledger',
        code: 'shared_outage',
        message: 'Alpha worker message.',
        stack: '',
        context: { projectId: 'project-alpha', queue: 'runtime' },
        firstObservedAt: evidence.alphaPaused[0],
        lastObservedAt: evidence.alphaPaused[1],
        occurrences: 2,
        resolvedAt: '',
        observations: evidence.alphaPaused,
        legacyHistoryBefore: '',
      },
      {
        id: 'incident-alpha-resolved',
        fingerprint: 'fixture-alpha-resolved',
        status: 'resolved',
        severity: 'fatal',
        scope: 'project-runtime:project-alpha',
        component: 'alpha-runtime',
        operation: 'run-alpha-runtime',
        code: 'shared_outage',
        message: 'Resolved alpha runtime message.',
        stack: '',
        context: { projectId: 'project-alpha', outcome: 'recovered' },
        firstObservedAt: evidence.alphaResolved,
        lastObservedAt: evidence.alphaResolved,
        occurrences: 1,
        resolvedAt: at(-50 * 60 * 1_000),
        observations: [evidence.alphaResolved],
        legacyHistoryBefore: '',
      },
      {
        id: 'incident-alpha-legacy',
        fingerprint: 'fixture-alpha-legacy',
        status: 'resolved',
        severity: 'error',
        scope: 'project-runtime:project-alpha',
        component: 'alpha-legacy',
        operation: 'run-alpha-legacy',
        code: 'legacy_failure',
        message: 'Legacy alpha evidence.',
        stack: '',
        context: { projectId: 'project-alpha', source: 'version-1' },
        firstObservedAt: at(-90 * 60 * 1_000),
        lastObservedAt: at(-90 * 60 * 1_000),
        occurrences: 5,
        resolvedAt: at(-80 * 60 * 1_000),
        observations: [at(-90 * 60 * 1_000)],
        legacyHistoryBefore: at(-90 * 60 * 1_000),
      },
      {
        id: 'incident-beta',
        fingerprint: 'fixture-beta',
        status: 'paused',
        severity: 'error',
        scope: 'pipeline:project-beta:run-1',
        component: 'beta-pipeline',
        operation: 'run-beta-pipeline',
        code: 'shared_outage',
        message: 'Shared worker outage.',
        stack: '',
        context: { projectId: 'project-beta' },
        firstObservedAt: evidence.betaRecent[0],
        lastObservedAt: evidence.betaRecent[1],
        occurrences: 2,
        resolvedAt: '',
        observations: evidence.betaRecent,
        legacyHistoryBefore: '',
      },
      {
        id: 'incident-system',
        fingerprint: 'fixture-system',
        status: 'resolved',
        severity: 'warning',
        scope: 'background:catalog-scanner',
        component: 'catalog-scanner',
        operation: 'scan-catalog',
        code: 'catalog_unowned',
        message: 'Resolved unowned catalog evidence.',
        stack: '',
        context: { projectId: 'unknown-project' },
        firstObservedAt: evidence.systemResolved,
        lastObservedAt: evidence.systemResolved,
        occurrences: 1,
        resolvedAt: at(-10 * 60 * 1_000),
        observations: [evidence.systemResolved],
        legacyHistoryBefore: '',
      },
      {
        id: 'incident-expired',
        fingerprint: 'fixture-expired',
        status: 'resolved',
        severity: 'fatal',
        scope: 'project-runtime:project-alpha',
        component: 'alpha-history',
        operation: 'run-alpha-history',
        code: 'expired_history',
        message: 'Expired alpha history.',
        stack: '',
        context: { projectId: 'project-alpha' },
        firstObservedAt: at(-25 * 60 * 60 * 1_000),
        lastObservedAt: at(-25 * 60 * 60 * 1_000),
        occurrences: 1,
        resolvedAt: at(-24 * 60 * 60 * 1_000),
        observations: [at(-25 * 60 * 60 * 1_000)],
        legacyHistoryBefore: '',
      },
    ],
  }));
  return { workspace, evidence };
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
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  try {
    await waitFor(async () => {
      assert.equal(child.exitCode, null, `decision-os fixture server exited early:\n${output.join('')}`);
      const response = await fetch(url, { method: 'HEAD' }).catch(() => undefined);
      return Boolean(response?.ok);
    }, `Timed out waiting for the decision-os fixture server at ${url}:\n${output.join('')}`);
    return { process: child, url };
  } catch (error) {
    // WHAT: Stop a spawned fixture server when readiness fails before returning ownership to the test.
    // WHY: Startup errors must not leak a detached process outside the test's finalizer.
    await stopDecisionOsServer(child);
    throw error;
  }
}

async function stopDecisionOsServer(child: ChildProcess): Promise<void> {
  // WHAT: Skip shutdown signaling when the fixture process already settled.
  // WHY: Re-signaling a recycled process-group id could affect an unrelated process.
  if (child.exitCode !== null || child.signalCode !== null) return;
  assert.ok(child.pid, 'The detached fixture server must expose a process id.');
  process.kill(-child.pid, 'SIGTERM');
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    delay(2_000),
  ]);
  // WHAT: Escalate only when the fixture process group did not settle after SIGTERM.
  // WHY: The test must guarantee cleanup without extending control to any existing server.
  if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGKILL');
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
