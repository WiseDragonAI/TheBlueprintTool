/**
 * WHAT: Proves direct Markdown owner routing and Task-card authoring on an isolated local server.
 * WHY: Static checks cannot prove redirects, persistent CodeMirror gestures, optimistic saves, recovery, or history.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium, type Browser, type Page, type Route } from '@playwright/test';

const canaryUrl = process.env.DECISION_OS_URL ?? '';
const productionUrl = 'http://127.0.0.1:50150';
const relayUrl = 'http://127.0.0.1:50152';
const proofProjectId = 'e08b7f37-da8e-498b-a973-2c9206247f8b';
const proofCardId = 'card-g12-served-proof';
const proofRoot = resolve('.worktrees/g12-served-proof');
const cardFile = join(proofRoot, '.decision-os/cards/tasks/card-g12-served-proof.md');
const threadFile = join(proofRoot, '.decision-os/threads/tasks/thread-card-g12-served-proof.md');
const evidenceRoot = '/tmp/decision-os-g12-proof';
const browserArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
const canaryOnly = { skip: !canaryUrl };

function apiPath(suffix: string): string {
  return `${canaryUrl}/p/${proofProjectId}${suffix}`;
}

function directMarkdownUrl(file: string): string {
  return `${canaryUrl}/${encodeURIComponent(resolve(file))}`;
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: join(proofRoot, '.decision-os'), encoding: 'utf8' }).trim();
}

async function jsonRequest(url: string, init?: RequestInit): Promise<{ response: Response; body: Record<string, any> }> {
  const response = await fetch(url, init);
  const body = await response.json() as Record<string, any>;
  return { response, body };
}

function armOneShotReferenceFailure(): void {
  const hooks = join(proofRoot, '.decision-os/.git/g12-hooks');
  const hook = join(hooks, 'reference-transaction');
  mkdirSync(hooks, { recursive: true });
  writeFileSync(hook, [
    '#!/bin/sh',
    'if [ "$1" = "prepared" ]; then',
    '  rm -f "$0"',
    '  exit 1',
    'fi',
    'exit 0',
    '',
  ].join('\n'));
  chmodSync(hook, 0o700);
  git(['config', '--local', 'core.hooksPath', hooks]);
}

async function editor(page: Page) {
  const modal = page.locator('.ledger-card-editor-modal[open]');
  await modal.waitFor({ state: 'visible' });
  await modal.locator('.cm-content').waitFor({ state: 'visible' });
  return modal;
}

test('absolute card and thread Markdown routes resolve without exposing paths', { ...canaryOnly, timeout: 30_000 }, async () => {
  assert.match(canaryUrl, /^http:\/\/127\.0\.0\.1:\d+$/, 'DECISION_OS_URL must select an isolated local proof server.');
  assert.equal(existsSync(cardFile), true);
  assert.equal(existsSync(threadFile), true);

  for (const [file, destination] of [
    [cardFile, `/p/${proofProjectId}/ledgers/tasks/cards/${proofCardId}?editor=markdown`],
    [threadFile, `/p/${proofProjectId}/ledgers/tasks/cards/${proofCardId}?thread=open`],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(directMarkdownUrl(file), { method, redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('location'), destination);
      assert.equal((await response.text()).includes(resolve(file)), false);
    }
  }

  const missing = await fetch(`${canaryUrl}/${encodeURIComponent('/tmp/g12-unowned.md')}`, { redirect: 'manual' });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json() as Record<string, unknown>).error, 'markdown_editor_target_not_found');

  const productionProjects = await fetch(`${productionUrl}/decision-os/projects`).then((response) => response.json()) as {
    projects: Array<{ root?: string; decisionOsRoot?: string }>;
  };
  assert.equal(productionProjects.projects.some((project) => (
    String(project.root ?? '').includes('/.worktrees/dev')
    || String(project.decisionOsRoot ?? '').includes('/.worktrees/dev')
  )), false);
  assert.equal((await fetch(`${productionUrl}/api/health`)).status, 200);
  const relayHealth = await fetch(`${relayUrl}/health`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(relayHealth.status, 'ready');
  assert.equal(relayHealth.environment, 'dev');
});

test('Task Markdown editor proves gestures, optimistic persistence, conflict, recovery, and history', { ...canaryOnly, timeout: 150_000 }, async () => {
  assert.match(canaryUrl, /^http:\/\/127\.0\.0\.1:\d+$/, 'DECISION_OS_URL must select an isolated local proof server.');
  mkdirSync(evidenceRoot, { recursive: true });
  const diffProofMarker = `Unified diff addition ${Date.now()}.`;
  const diffProofBase = `${readFileSync(cardFile, 'utf8').trimEnd()}

## Unified diff proof

Stable source-positioned semantics.

Remove this internal proof line.

::questions[Unified proof](questions:?id=unified-proof)

Remove this end-of-file proof line.
`;
  writeFileSync(cardFile, diffProofBase);
  git(['add', cardFile]);
  git(['commit', '-m', 'Prepare unified editor proof base']);
  writeFileSync(cardFile, `${diffProofBase
    .replace('Remove this internal proof line.\n\n', `${diffProofMarker}\n\n`)
    .replace('\nRemove this end-of-file proof line.\n', '\n')}`);
  git(['add', cardFile]);
  git(['commit', '-m', 'Prepare unified editor proof revision']);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: '/snap/bin/chromium',
      args: browserArgs,
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const httpErrors: Array<{ status: number; url: string }> = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (entry) => {
      if (entry.type() === 'error') consoleErrors.push(entry.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() });
    });

    const firstNavigation = await page.goto(directMarkdownUrl(cardFile), { waitUntil: 'domcontentloaded' });
    assert.equal(firstNavigation?.status(), 200);
    assert.equal(page.url(), `${canaryUrl}/p/${proofProjectId}/ledgers/tasks/cards/${proofCardId}?editor=markdown`);
    let modal = await editor(page);
    const geometry = await modal.evaluate((element) => {
      return { width: element.offsetWidth, height: element.offsetHeight, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    assert.ok(Math.abs(geometry.width - Math.min(900, geometry.viewportWidth - 48)) <= 2, JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.height - geometry.viewportHeight * 0.95) <= 2, JSON.stringify(geometry));
    await modal.getByRole('button', { name: 'Find', exact: true }).click();
    const diffSearch = modal.getByRole('textbox', { name: 'Find', exact: true });
    await diffSearch.fill(diffProofMarker);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    const authoredAddition = modal.locator('.cm-authored-addition');
    const authoredDeletion = modal.locator('.cm-authored-deletion');
    try {
      await authoredAddition.waitFor({ state: 'visible' });
      await authoredDeletion.waitFor({ state: 'visible' });
    } catch (error) {
      assert.fail(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        pageErrors,
        consoleErrors,
        httpErrors,
      }));
    }
    assert.ok((await authoredAddition.count()) >= 1);
    assert.ok((await authoredDeletion.count()) >= 1);
    assert.equal(await authoredAddition.getAttribute('aria-label'), 'Added Markdown');
    assert.match(await authoredDeletion.getAttribute('aria-label') ?? '', /Removed Markdown:/);
    assert.match(await authoredDeletion.textContent() ?? '', /Remove this/);
    await page.screenshot({ path: join(evidenceRoot, 'card-editor-unified-diff.png'), fullPage: false });
    await page.screenshot({ path: join(evidenceRoot, 'card-editor-desktop.png'), fullPage: false });

    const content = modal.locator('.cm-content');
    await content.click();
    await page.keyboard.press('Control+End');
    const optimisticMarker = `Optimistic served proof ${Date.now()}.`;
    await page.keyboard.type(`\n${optimisticMarker}`);
    assert.equal(await modal.locator('.text-file-editor').getAttribute('data-dirty'), 'true');
    await modal.getByRole('button', { name: 'Find', exact: true }).click();
    await modal.locator('.cm-search').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await modal.getByRole('button', { name: 'Wrap lines', exact: true }).click();
    assert.equal(await modal.getByRole('button', { name: 'Wrap lines', exact: true }).getAttribute('aria-pressed'), 'false');
    await modal.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.doesNotMatch(await content.textContent() ?? '', new RegExp(optimisticMarker));
    await modal.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.match(await content.textContent() ?? '', new RegExp(optimisticMarker));

    let heldRoute: Route | null = null;
    let releaseHeldRoute: (() => void) | null = null;
    let observeHeldRoute: ((route: Route) => void) | null = null;
    const held = new Promise<void>((resolveHeld) => { releaseHeldRoute = resolveHeld; });
    const heldRouteArrived = new Promise<Route>((resolveRoute) => { observeHeldRoute = resolveRoute; });
    const saveResponse = page.waitForResponse((candidate) => (
      candidate.request().method() === 'PUT'
      && candidate.url().endsWith(`/cards/${proofCardId}/content`)
    ));
    await page.route(`**/p/${proofProjectId}/api/ledgers/tasks/cards/${proofCardId}/content`, async (route) => {
      heldRoute = route;
      observeHeldRoute?.(route);
      await held;
      await route.continue();
    }, { times: 1 });
    await modal.getByRole('button', { name: 'Save new revision', exact: true }).click();
    await modal.getByRole('button', { name: 'Saving…', exact: true }).waitFor({ state: 'visible' });
    await heldRouteArrived;
    assert.ok(heldRoute, 'The PUT request must be held while the optimistic draft remains visible.');
    assert.match(await content.textContent() ?? '', new RegExp(optimisticMarker));
    assert.equal(await modal.locator('.text-file-editor').getAttribute('data-dirty'), 'true');
    releaseHeldRoute?.();
    const persistedResponse = await saveResponse;
    const persistedBody = await persistedResponse.json() as Record<string, unknown>;
    assert.equal(persistedResponse.status(), 200, JSON.stringify(persistedBody));
    await modal.getByText('Saved as a focused Git revision.', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await modal.locator('.text-file-editor').getAttribute('data-dirty'), 'false');

    await page.reload({ waitUntil: 'domcontentloaded' });
    modal = await editor(page);
    await modal.getByRole('button', { name: 'Find', exact: true }).click();
    await modal.getByRole('textbox', { name: 'Find', exact: true }).fill(optimisticMarker);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert.match(await modal.locator('.cm-content').textContent() ?? '', new RegExp(optimisticMarker));

    const beforeConflict = await jsonRequest(apiPath(`/api/ledgers/tasks/cards/${proofCardId}`));
    assert.equal(beforeConflict.response.status, 200);
    const authoritativeMarker = `Authoritative concurrent proof ${Date.now()}.`;
    const authoritativeMarkdown = `${beforeConflict.body.comment.what.trimEnd()}\n\n${authoritativeMarker}\n`;
    const concurrent = await jsonRequest(apiPath(`/api/ledgers/tasks/cards/${proofCardId}/content`), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        markdown: authoritativeMarkdown,
        expectedContentRevision: beforeConflict.body.contentRevision,
      }),
    });
    assert.equal(concurrent.response.status, 200, JSON.stringify(concurrent.body));
    const draftMarker = `Preserved rejected draft ${Date.now()}.`;
    await modal.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(`\n${draftMarker}\n`);
    await modal.getByRole('button', { name: 'Save new revision', exact: true }).click();
    await modal.getByRole('button', { name: 'Reload server revision', exact: true }).waitFor({ state: 'visible' });
    assert.match(await modal.locator('.cm-content').textContent() ?? '', new RegExp(draftMarker));
    await page.screenshot({ path: join(evidenceRoot, 'card-editor-conflict-draft.png'), fullPage: false });
    await modal.getByRole('button', { name: 'Reload server revision', exact: true }).click();
    await modal.getByText('Reloaded the server-confirmed revision.', { exact: true }).waitFor({ state: 'visible' });
    assert.match(await modal.locator('.cm-content').textContent() ?? '', new RegExp(authoritativeMarker));
    assert.doesNotMatch(await modal.locator('.cm-content').textContent() ?? '', new RegExp(draftMarker));

    const beforeRecovery = await jsonRequest(apiPath(`/api/ledgers/tasks/cards/${proofCardId}`));
    const taskClockBeforeRecovery = beforeRecovery.response.headers.get('x-decision-os-task-clock');
    const headBeforeRecovery = git(['rev-parse', 'HEAD']);
    armOneShotReferenceFailure();
    const recoveryMarker = `Recovered exact bytes ${Date.now()}.`;
    await modal.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(`\n${recoveryMarker}\n`);
    await modal.getByRole('button', { name: 'Save new revision', exact: true }).click();
    await modal.getByRole('button', { name: 'Retry Git revision', exact: true }).waitFor({ state: 'visible' });
    assert.equal(git(['rev-parse', 'HEAD']), headBeforeRecovery);
    const persistedAfterFailure = await jsonRequest(apiPath(`/api/ledgers/tasks/cards/${proofCardId}`));
    assert.match(String(persistedAfterFailure.body.comment.what), new RegExp(recoveryMarker));
    const taskClockAfterFailure = persistedAfterFailure.response.headers.get('x-decision-os-task-clock');
    assert.notEqual(taskClockAfterFailure, taskClockBeforeRecovery);
    await page.screenshot({ path: join(evidenceRoot, 'card-editor-git-recovery.png'), fullPage: false });
    await modal.getByRole('button', { name: 'Retry Git revision', exact: true }).click();
    await modal.getByText('The pending Git revision was created.', { exact: true }).waitFor({ state: 'visible' });
    assert.notEqual(git(['rev-parse', 'HEAD']), headBeforeRecovery);
    assert.equal(git(['rev-list', '--count', `${headBeforeRecovery}..HEAD`]), '1');
    const persistedAfterRetry = await jsonRequest(apiPath(`/api/ledgers/tasks/cards/${proofCardId}`));
    assert.equal(persistedAfterRetry.response.headers.get('x-decision-os-task-clock'), taskClockAfterFailure);
    assert.match(String(persistedAfterRetry.body.comment.what), new RegExp(recoveryMarker));
    assert.equal(existsSync(join(proofRoot, '.decision-os/.git/g12-hooks/reference-transaction')), false);

    await modal.getByRole('button', { name: 'History', exact: true }).click();
    const historyRegion = modal.getByRole('region', { name: /full historical Markdown/ });
    await historyRegion.waitFor({ state: 'visible' });
    const diffGroup = modal.getByRole('group', { name: 'File changes. Removed lines use a minus sign and red. Added lines use a plus sign and blue.', exact: true });
    await diffGroup.waitFor({ state: 'visible' });
    const diffEvidence = await modal.evaluate(() => {
      const key = document.querySelector<HTMLElement>('.skill-revision-key');
      const addition = key?.querySelector<HTMLElement>('.is-addition');
      const removal = key?.querySelector<HTMLElement>('.is-removal');
      const group = document.querySelector<HTMLElement>('.skill-revision-pierre');
      return {
        keyLabel: key?.getAttribute('aria-label') ?? '',
        additionText: addition?.textContent ?? '',
        additionColor: addition ? getComputedStyle(addition).color : '',
        removalText: removal?.textContent ?? '',
        removalColor: removal ? getComputedStyle(removal).color : '',
        groupLabel: group?.getAttribute('aria-label') ?? '',
        tabIndex: group?.getAttribute('tabindex'),
      };
    });
    assert.match(diffEvidence.keyLabel, /minus means removed in red; plus means added in blue/);
    assert.equal(diffEvidence.additionText, '+ Added');
    assert.equal(diffEvidence.removalText, '− Removed');
    assert.match(diffEvidence.additionColor, /77, 156, 255/);
    assert.match(diffEvidence.removalColor, /255, 95, 109/);
    assert.match(diffEvidence.groupLabel, /Removed lines use a minus sign and red/);
    await page.screenshot({ path: join(evidenceRoot, 'card-editor-history-diff.png'), fullPage: false });
    const older = modal.getByRole('button', { name: 'Older', exact: true });
    if (await older.isEnabled()) await older.click();
    const newer = modal.getByRole('button', { name: 'Newer', exact: true });
    await newer.waitFor({ state: 'visible' });

    await modal.getByRole('button', { name: 'Editor', exact: true }).click();
    await modal.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    const closeDraft = `Dirty close proof ${Date.now()}.`;
    await page.keyboard.type(`\n${closeDraft}\n`);
    page.once('dialog', async (confirmation) => {
      assert.equal(confirmation.type(), 'confirm');
      await confirmation.dismiss();
    });
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    await modal.waitFor({ state: 'visible' });
    assert.match(await modal.locator('.cm-content').textContent() ?? '', new RegExp(closeDraft));
    page.once('dialog', async (confirmation) => {
      assert.equal(confirmation.type(), 'confirm');
      await confirmation.accept();
    });
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(page.url(), `${canaryUrl}/p/${proofProjectId}/ledgers/tasks/cards/${proofCardId}`);
    assert.equal(await page.locator('#card-title').evaluate((element) => element === document.activeElement), true);

    assert.deepEqual(pageErrors, []);
    assert.equal(consoleErrors.length, 2);
    assert.ok(consoleErrors.every((entry) => (
      /^Failed to load resource: the server responded with a status of (409 \(Conflict\)|503 \(Service Unavailable\))$/.test(entry)
    )));
    assert.deepEqual(httpErrors, [
      { status: 409, url: apiPath(`/api/ledgers/tasks/cards/${proofCardId}/content`) },
      { status: 503, url: apiPath(`/api/ledgers/tasks/cards/${proofCardId}/content`) },
    ]);
    writeFileSync(join(evidenceRoot, 'direct-markdown-http-errors.json'), `${JSON.stringify(httpErrors, null, 2)}\n`);
  } finally {
    await browser?.close();
  }
});
