/**
 * WHAT: Exercises the served responsive master-task subtask accordion at mobile and desktop widths.
 * WHY: Disclosure semantics, route-local state, motion, and live execution decoration require browser-level proof.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  assertFixtureRepositoryStatusUnchanged,
  cleanupMasterTaskSubtaskAccordionFixture,
  createMasterTaskSubtaskAccordionFixture,
  settleAccordionExecutions,
  startMasterTaskSubtaskAccordionServer,
  stopMasterTaskSubtaskAccordionServer,
  updateAccordionMasterContent,
  type StartedAccordionServer,
} from './fixtures/master-task-subtask-accordion-fixture.js';

const chromiumExecutablePath = '/snap/bin/chromium';

test('master-task subtasks retain one accessible, animated, route-local disclosure lifecycle', { timeout: 120_000 }, async () => {
  const fixture = await createMasterTaskSubtaskAccordionFixture();
  let server: StartedAccordionServer | undefined;
  let browser: Browser | undefined;
  // WHAT: Own every browser, server, and temporary-workspace resource for the complete scenario.
  // WHY: Any assertion failure must still enter the nested cleanup boundaries below.
  try {
    server = await startMasterTaskSubtaskAccordionServer(fixture);
    assert.equal(existsSync(chromiumExecutablePath), true, `Linux Chromium is required at ${chromiumExecutablePath}.`);
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    mobile.on('pageerror', (error) => pageErrors.push(error.message));
    await assertViewportLifecycle(mobile, server.url, fixture, 'mobile');
    await assertExecutionDecoration(mobile, fixture.runningChildId, fixture.queuedChildId);
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    desktop.on('pageerror', (error) => pageErrors.push(error.message));
    await assertViewportLifecycle(desktop, server.url, fixture, 'desktop');
    await assertExecutionDecoration(desktop, fixture.runningChildId, fixture.queuedChildId);
    await settleAccordionExecutions(fixture);
    await stopMasterTaskSubtaskAccordionServer(server);
    server = await startMasterTaskSubtaskAccordionServer(fixture);
    // WHAT: Verify terminal cleanup and reduced motion on both admitted responsive viewports.
    // WHY: Mobile success cannot substitute for the desktop interaction and accessibility boundary.
    for (const page of [mobile, desktop]) {
      await openMasterCard(page, server.url, fixture.projectId, fixture.masterCardId);
      await assertExecutionCleanup(page, fixture.runningChildId, fixture.queuedChildId);
      await assertReducedMotion(page);
    }
    assert.deepEqual(pageErrors, [], JSON.stringify(pageErrors));
    await desktop.close();
    await mobile.close();
  } finally {
    // WHAT: Continue server and workspace cleanup even when browser shutdown rejects.
    // WHY: One client cleanup failure must not leak the independently owned fixture process.
    try {
      await browser?.close();
    } finally {
      // WHAT: Continue workspace cleanup even when bounded server shutdown rejects.
      // WHY: The exact temporary fixture remains independently removable after process cleanup failure.
      try {
        // WHAT: Stop only a fixture server that completed its bounded startup transaction.
        // WHY: Startup rejection already settles its owned process before propagating the failure.
        if (server) await stopMasterTaskSubtaskAccordionServer(server);
      } finally {
        cleanupMasterTaskSubtaskAccordionFixture(fixture);
        assertFixtureRepositoryStatusUnchanged(fixture);
      }
    }
  }
});

async function assertViewportLifecycle(
  page: Page,
  baseUrl: string,
  fixture: Awaited<ReturnType<typeof createMasterTaskSubtaskAccordionFixture>>,
  viewportName: string,
): Promise<void> {
  await openMasterCard(page, baseUrl, fixture.projectId, fixture.masterCardId);
  await assertDisclosureContract(page, fixture.masterCardId);
  await assertCollapsed(page);
  await assertMotionContract(page);
  await toggleWithPointer(page, true);
  await assertExpanded(page);
  updateAccordionMasterContent(fixture, viewportName);
  await page.getByText(`Same-card refresh ${viewportName}.`).waitFor({ state: 'visible' });
  await waitForDisclosure(page);
  await assertExpanded(page);
  await toggleWithKeyboard(page, 'Enter', false);
  await assertCollapsed(page);
  await toggleWithKeyboard(page, ' ', true);
  await assertExpanded(page);
  await toggleWithPointer(page, false);
  await assertCollapsed(page);
  await toggleWithPointer(page, true);
  await page.locator('.subtask-row').first().click();
  await page.waitForURL(new RegExp(`/cards/${fixture.runningChildId}$`));
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await waitForDisclosure(page);
  await assertCollapsed(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForDisclosure(page);
  await assertCollapsed(page);
}

async function openMasterCard(page: Page, baseUrl: string, projectId: string, cardId: string): Promise<void> {
  await page.goto(`${baseUrl}/p/${encodeURIComponent(projectId)}/ledgers/tasks/cards/${encodeURIComponent(cardId)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#card-view:not([hidden])').waitFor({ state: 'visible' });
  await waitForDisclosure(page);
}

async function waitForDisclosure(page: Page): Promise<void> {
  await page.locator('.master-subtask-disclosure').waitFor({ state: 'visible' });
}

async function assertDisclosureContract(page: Page, cardId: string): Promise<void> {
  const heading = page.locator('h2.master-subtask-disclosure-heading');
  const toggle = heading.locator(':scope > button.master-subtask-disclosure-toggle');
  const panel = page.locator('.master-subtask-disclosure-panel');
  assert.equal(await heading.locator(':scope > *').count(), 1);
  assert.equal(await toggle.count(), 1);
  assert.equal(await panel.getAttribute('role'), 'region');
  assert.equal(await toggle.getAttribute('id'), `master-subtask-disclosure-toggle-${encodeURIComponent(cardId)}`);
  assert.equal(await panel.getAttribute('id'), `master-subtask-disclosure-panel-${encodeURIComponent(cardId)}`);
  assert.equal(await toggle.getAttribute('aria-controls'), await panel.getAttribute('id'));
  assert.equal(await panel.getAttribute('aria-labelledby'), await toggle.getAttribute('id'));
  assert.equal(await page.locator('.subtask-row').count(), 5);
  assert.deepEqual(await page.locator('.subtask-row span').allTextContents(), ['Child 1', 'Child 2', 'Child 3', 'Child 4', 'Child 5']);
}

async function assertCollapsed(page: Page): Promise<void> {
  const toggle = page.locator('.master-subtask-disclosure-toggle');
  const panel = page.locator('.master-subtask-disclosure-panel');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await panel.getAttribute('aria-hidden'), 'true');
  assert.equal(await panel.getAttribute('inert'), '');
  assert.equal(await page.locator('.master-subtask-disclosure').getAttribute('data-expanded'), 'false');
  assert.equal(await panel.evaluate((element) => element.getBoundingClientRect().height), 0);
  assert.equal(await panel.locator('.subtask-row').count(), 5);
  await toggle.focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.master-subtask-disclosure-panel') !== null), false);
}

async function assertExpanded(page: Page): Promise<void> {
  const toggle = page.locator('.master-subtask-disclosure-toggle');
  const panel = page.locator('.master-subtask-disclosure-panel');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await panel.getAttribute('aria-hidden'), 'false');
  assert.equal(await panel.getAttribute('inert'), null);
  assert.equal(await page.locator('.master-subtask-disclosure').getAttribute('data-expanded'), 'true');
  assert.ok((await panel.evaluate((element) => element.getBoundingClientRect().height)) > 0);
  assert.equal(await panel.locator('.subtask-row').first().evaluate((element) => getComputedStyle(element).paddingBlockStart), '12px');
  assert.equal(await panel.evaluate((element) => getComputedStyle(element).overflow), 'hidden');
}

async function assertMotionContract(page: Page): Promise<void> {
  const panel = page.locator('.master-subtask-disclosure-panel');
  const chevron = page.locator('.master-subtask-disclosure-chevron');
  assert.match(await panel.evaluate((element) => getComputedStyle(element).transitionProperty), /grid-template-rows/);
  assert.match(await chevron.evaluate((element) => getComputedStyle(element).transitionProperty), /transform/);
}

async function toggleWithPointer(page: Page, expectedExpanded: boolean): Promise<void> {
  await preparePanelMotionObservation(page);
  await page.locator('.master-subtask-disclosure-toggle').click();
  await page.waitForFunction((next) => document.querySelector('.master-subtask-disclosure')?.getAttribute('data-expanded') === String(next), expectedExpanded);
  await assertPanelMotionObserved(page);
}

async function toggleWithKeyboard(page: Page, key: string, expectedExpanded: boolean): Promise<void> {
  const toggle = page.locator('.master-subtask-disclosure-toggle');
  await toggle.focus();
  await preparePanelMotionObservation(page);
  await page.keyboard.press(key);
  await page.waitForFunction((next) => document.querySelector('.master-subtask-disclosure')?.getAttribute('data-expanded') === String(next), expectedExpanded);
  await assertPanelMotionObserved(page);
}

async function preparePanelMotionObservation(page: Page): Promise<void> {
  await page.locator('.master-subtask-disclosure-panel').evaluate((element) => {
    element.setAttribute('data-observed-transitions', '');
    const record = (event: Event) => {
      const current = element.getAttribute('data-observed-transitions') ?? '';
      element.setAttribute('data-observed-transitions', `${current}${event.type},`);
    };
    element.addEventListener('transitionrun', record, { once: true });
    element.addEventListener('transitionend', record, { once: true });
  });
}

async function assertPanelMotionObserved(page: Page): Promise<void> {
  const panel = page.locator('.master-subtask-disclosure-panel');
  await page.waitForFunction(() => document.querySelector('.master-subtask-disclosure-panel')?.getAttribute('data-observed-transitions')?.includes('transitionend'));
  assert.equal(await panel.getAttribute('data-observed-transitions'), 'transitionrun,transitionend,');
}

async function assertExecutionDecoration(page: Page, runningId: string, queuedId: string): Promise<void> {
  const state = await page.evaluate(async (cardId) => {
    const projectId = location.pathname.split('/')[2];
    return fetch(`/p/${encodeURIComponent(projectId)}/api/ledgers/tasks/cards/${encodeURIComponent(cardId)}/execution-state`).then((response) => response.json());
  }, 'accordion-master') as { sessions?: Array<{ executions?: Array<{ sourceCardId?: string }> }> };
  const sourceCardIds = state.sessions?.flatMap((session) => session.executions ?? []).map((execution) => execution.sourceCardId) ?? [];
  assert.deepEqual(sourceCardIds.sort(), [runningId, queuedId].sort());
  assert.equal(await page.locator(`.subtask-row[data-card-id="${runningId}"]`).getAttribute('data-run-status'), 'running');
  assert.equal(await page.locator(`.subtask-row[data-card-id="${queuedId}"]`).getAttribute('data-run-status'), 'pending');
}

async function assertExecutionCleanup(page: Page, runningId: string, queuedId: string): Promise<void> {
  const state = await page.evaluate(async (cardId) => {
    const projectId = location.pathname.split('/')[2];
    return fetch(`/p/${encodeURIComponent(projectId)}/api/ledgers/tasks/cards/${encodeURIComponent(cardId)}/execution-state`).then((response) => response.json());
  }, 'accordion-master') as { activeExecutionIds?: string[] };
  assert.deepEqual(state.activeExecutionIds, []);
  // WHAT: Check both terminal execution rows after their canonical lifecycle transitions settle.
  // WHY: Cleanup must remove transient decoration independently without replacing durable subtask labels.
  for (const cardId of [runningId, queuedId]) {
    const row = page.locator(`.subtask-row[data-card-id="${cardId}"]`);
    assert.equal(await row.getAttribute('data-run-status'), null);
    assert.equal(await row.getAttribute('data-execution-phase'), null);
    assert.equal(await row.getAttribute('aria-label'), null);
    assert.equal(await row.locator('small').textContent(), 'waiting');
  }
}

async function assertReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForDisclosure(page);
  const transitions = await page.locator('.master-subtask-disclosure-panel, .master-subtask-disclosure-chevron').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).transitionDuration));
  assert.deepEqual(transitions, ['0s', '0s']);
}
