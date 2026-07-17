/**
 * WHAT: Proves reusable pipeline creation, skill defaults, live step progress, cancellation, restart, and failure in a real browser.
 * WHY: The complete operator flow crosses modal state, durable backend state, process lifecycle events, and generated-card widgets.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Locator, type Page, type Route } from '@playwright/test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

type BrowserFixture = {
  workspace: string;
  codexHome: string;
  fakeCodexFile: string;
  launchFile: string;
};

type ServerHandle = {
  process: ChildProcess;
  url: string;
};

type LaunchRecord = {
  step: string;
  model: string;
  effort: string;
  call: number;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
const sourceCardId = 'card-browser-pipeline-source';
const skillName = 'workspace-browser-skill';

test('Process card keeps an overflowing skill catalog readable.', { timeout: 30_000 }, async () => {
  await assertFrontendSpec('Playwright for real browser interaction tests', 'cef65c97', 'canvas');
  const fixture = createFixture({ extraSkillCount: 24 });
  let server: ServerHandle | undefined;
  let browser: Browser | undefined;
  try {
    server = await startDecisionOsServer(fixture);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      localStorage.setItem('decision-os.canvas.state', JSON.stringify({
        activeTab: 'specs',
        railCollapsed: false,
        selection: { cardIds: [], zoneIds: [], groupIds: [] },
        viewport: { x: 0, y: 0, scale: 1 },
        viewports: { specs: { x: 0, y: 0, scale: 1 } },
      }));
    });
    await page.goto(`${server.url}/specs`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((cardId) => Boolean(window.__coreState?.activeLedger?.cards?.some((card: { id?: string }) => card.id === cardId)), sourceCardId);
    await openProcessCard(page);
    const process = page.locator('.process-modal');
    await process.getByRole('tab', { name: 'Skills', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#process-panel-skills .process-skill-row').length >= 25);

    const layout = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('#process-panel-skills');
      const modal = document.querySelector<HTMLElement>('.process-modal');
      const rows = [...document.querySelectorAll<HTMLElement>('#process-panel-skills .process-skill-row')];
      const modalRect = modal?.getBoundingClientRect();
      return {
        rowCount: rows.length,
        minRowHeight: Math.min(...rows.map((row) => row.getBoundingClientRect().height)),
        flexShrinkValues: [...new Set(rows.map((row) => getComputedStyle(row).flexShrink))],
        clientHeight: panel?.clientHeight ?? 0,
        scrollHeight: panel?.scrollHeight ?? 0,
        modalWidth: modalRect?.width ?? 0,
        modalHeight: modalRect?.height ?? 0,
      };
    });
    assert.ok(layout.rowCount >= 25, `Expected at least 25 skill rows, received ${layout.rowCount}.`);
    assert.ok(layout.minRowHeight >= 60, `Skill rows collapsed to ${layout.minRowHeight}px.`);
    assert.deepEqual(layout.flexShrinkValues, ['0']);
    assert.ok(layout.scrollHeight > layout.clientHeight,
      `Expected skill results to scroll instead of shrink (${layout.scrollHeight} <= ${layout.clientHeight}).`);
    assert.ok(layout.modalWidth >= 850, `Expected the skill modal to be about 880px wide, received ${layout.modalWidth}px.`);
    assert.ok(layout.modalHeight >= 620, `Expected the skill modal to use four-fifths of the viewport, received ${layout.modalHeight}px.`);

    await process.getByRole('button', { name: 'Close', exact: true }).click();
    await process.waitFor({ state: 'hidden' });
    await page.locator('[data-action="open-pipelines-modal"]').click();
    const library = page.locator('.pipelines-modal');
    await library.waitFor({ state: 'visible' });
    await library.getByRole('button', { name: 'New pipeline', exact: true }).click();
    const editor = page.locator('.pipeline-editor-modal');
    await editor.waitFor({ state: 'visible' });
    await editor.getByRole('button', { name: 'Add skill', exact: true }).click();
    const skillPicker = page.locator('.pipeline-skill-picker-modal');
    await skillPicker.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('.pipeline-skill-picker-results .pipeline-picker-result').length >= 25);

    const pickerLayout = await page.evaluate(() => {
      const results = document.querySelector<HTMLElement>('.pipeline-skill-picker-results');
      const modal = document.querySelector<HTMLElement>('.pipeline-skill-picker-modal');
      const rows = [...document.querySelectorAll<HTMLElement>('.pipeline-skill-picker-results .pipeline-picker-result')];
      const rowRects = rows.map((row) => row.getBoundingClientRect());
      const modalRect = modal?.getBoundingClientRect();
      const gaps = rowRects.slice(1).map((rect, index) => rect.top - rowRects[index].bottom);
      if (results) results.scrollTop = results.scrollHeight;
      return {
        rowCount: rows.length,
        minRowHeight: Math.min(...rowRects.map((rect) => rect.height)),
        minInterRowGap: Math.min(...gaps),
        flexShrinkValues: [...new Set(rows.map((row) => getComputedStyle(row).flexShrink))],
        overflowY: results ? getComputedStyle(results).overflowY : '',
        clientHeight: results?.clientHeight ?? 0,
        scrollHeight: results?.scrollHeight ?? 0,
        scrollTop: results?.scrollTop ?? 0,
        modalWidth: modalRect?.width ?? 0,
        modalHeight: modalRect?.height ?? 0,
      };
    });
    assert.ok(pickerLayout.rowCount >= 25, `Expected at least 25 picker rows, received ${pickerLayout.rowCount}.`);
    assert.ok(pickerLayout.minRowHeight >= 60, `Picker rows collapsed to ${pickerLayout.minRowHeight}px.`);
    assert.ok(pickerLayout.minInterRowGap >= 0, `Picker rows overlap by ${Math.abs(pickerLayout.minInterRowGap)}px.`);
    assert.deepEqual(pickerLayout.flexShrinkValues, ['0']);
    assert.ok(['auto', 'scroll'].includes(pickerLayout.overflowY),
      `Expected the picker catalog to own vertical scrolling, received overflow-y: ${pickerLayout.overflowY}.`);
    assert.ok(pickerLayout.scrollHeight > pickerLayout.clientHeight,
      `Expected picker results to overflow internally (${pickerLayout.scrollHeight} <= ${pickerLayout.clientHeight}).`);
    assert.ok(pickerLayout.scrollTop > 0, 'Expected the dedicated picker catalog to scroll to later skills.');
    assert.ok(pickerLayout.modalWidth >= 850, `Expected the dedicated picker to be about 880px wide, received ${pickerLayout.modalWidth}px.`);
    assert.ok(pickerLayout.modalHeight >= 620, `Expected the dedicated picker to use four-fifths of the viewport, received ${pickerLayout.modalHeight}px.`);
  } finally {
    await browser?.close();
    if (server) await stopDecisionOsServer(server.process);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

test('Skills Library keeps canonical Markdown in a bounded scroll view above persistent actions.', { timeout: 45_000 }, async () => {
  const fixture = createFixture({ extraSkillCount: 2 });
  let server: ServerHandle | undefined;
  let browser: Browser | undefined;
  try {
    writeFileSync(join(fixture.workspace, '.decision-os', 'codex-pipelines.json'), JSON.stringify({
      version: 1,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [{
        skillName,
        favorite: true,
        tags: [],
        defaultCodexModel: null,
        defaultCodexEffort: null,
        updatedAt: '2026-07-17T00:00:00.000Z',
      }],
      activeWorkspaceRun: null,
    }, null, 2));
    writeFileSync(join(fixture.workspace, '.skills', skillName, 'SKILL.md'), [
      '---',
      `name: ${skillName}`,
      'description: Browser fixture skill for reusable pipeline verification.',
      '---',
      '',
      '# Browser fixture',
      '',
      ...Array.from({ length: 24 }, (_, index) => `## Instruction ${index + 1}\n\nRead and apply this canonical Markdown instruction.`),
      '',
    ].join('\n'), 'utf8');
    server = await startDecisionOsServer(fixture);
    const responsiveSource = await fetch(`${server.url}/src/app/responsive/codex.js`).then((response) => response.text());
    assert.match(responsiveSource, /Loading SKILL\.md/);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${server.url}/skills`, { waitUntil: 'domcontentloaded' });
    const library = page.locator('.process-modal');
    await library.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('.process-library .codex-list-item').length >= 3);

    const firstSkill = library.locator('.process-library .codex-list-item').first();
    assert.match(await firstSkill.locator('strong').textContent() ?? '', new RegExp(`^${skillName}`));
    const cardPresentation = await firstSkill.evaluate((activation) => {
      const card = activation.parentElement;
      const activationStyle = getComputedStyle(activation);
      const cardStyle = card ? getComputedStyle(card) : undefined;
      return {
        cardTag: card?.tagName ?? '',
        cardBackground: cardStyle?.backgroundColor ?? '',
        cardShadow: cardStyle?.boxShadow ?? '',
        activationBackground: activationStyle.backgroundColor,
        activationShadow: activationStyle.boxShadow,
        activationTransform: activationStyle.transform,
        activationHeight: activation.getBoundingClientRect().height,
        activationScrollHeight: activation.scrollHeight,
      };
    });
    assert.equal(cardPresentation.cardTag, 'ARTICLE');
    assert.notEqual(cardPresentation.cardBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(cardPresentation.cardShadow, 'none');
    assert.equal(cardPresentation.activationBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(cardPresentation.activationShadow, 'none');
    assert.equal(cardPresentation.activationTransform, 'none');
    assert.ok(cardPresentation.activationHeight + 1 >= cardPresentation.activationScrollHeight,
      `Card content overflowed its surface (${cardPresentation.activationHeight} < ${cardPresentation.activationScrollHeight}).`);
    const detailResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/codex/server-skills/${skillName}`));
    await firstSkill.click();
    const detailResponse = await detailResponsePromise;
    const detailPayload = await detailResponse.json();
    assert.equal(detailResponse.status(), 200, JSON.stringify(detailPayload));
    assert.deepEqual(detailPayload.skill.references?.map((reference: { name: string }) => reference.name), ['guide.md']);
    assert.deepEqual(pageErrors, []);

    await library.getByRole('heading', { name: 'SKILL.md', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await library.getByRole('heading', { name: 'Browser fixture', exact: true }).isVisible(), true);
    const geometry = await page.evaluate(() => {
      const modal = document.querySelector<HTMLElement>('.process-modal');
      const detail = document.querySelector<HTMLElement>('.process-detail');
      const scroll = document.querySelector<HTMLElement>('.skill-detail-scroll');
      const markdown = document.querySelector<HTMLElement>('.skill-markdown-section > .ledger-card-body');
      const actions = document.querySelector<HTMLElement>('.skill-detail-actions');
      const favorite = document.querySelector<HTMLElement>('.skill-favorite-toggle');
      const modalRect = modal?.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      const favoriteRect = favorite?.getBoundingClientRect();
      const markdownStyle = markdown ? getComputedStyle(markdown) : undefined;
      return {
        modalHeight: modalRect?.height ?? 0,
        detailClientHeight: detail?.clientHeight ?? 0,
        detailScrollHeight: detail?.scrollHeight ?? 0,
        documentClientHeight: scroll?.clientHeight ?? 0,
        documentScrollHeight: scroll?.scrollHeight ?? 0,
        documentOverflowY: scroll ? getComputedStyle(scroll).overflowY : '',
        actionsInsideModal: (actionsRect?.bottom ?? Infinity) <= (modalRect?.bottom ?? -Infinity),
        favoriteInsideModal: (favoriteRect?.bottom ?? Infinity) <= (modalRect?.bottom ?? -Infinity),
        markdownPadding: markdownStyle?.padding ?? '',
        markdownBackground: markdownStyle?.backgroundImage ?? '',
        markdownShadow: markdownStyle?.boxShadow ?? '',
      };
    });
    assert.ok(Math.abs(geometry.modalHeight - 720) <= 2, `Expected an 80vh modal, received ${geometry.modalHeight}px.`);
    assert.equal(geometry.detailScrollHeight, geometry.detailClientHeight, 'The detail shell must not own document overflow.');
    assert.ok(geometry.documentScrollHeight > geometry.documentClientHeight, 'The Markdown document must own vertical scrolling.');
    assert.equal(geometry.documentOverflowY, 'auto');
    assert.equal(geometry.actionsInsideModal, true);
    assert.equal(geometry.favoriteInsideModal, true);
    assert.equal(geometry.markdownPadding, '18px');
    assert.match(geometry.markdownBackground, /linear-gradient/);
    assert.notEqual(geometry.markdownShadow, 'none');
    const reference = library.getByRole('button', { name: 'guide.md', exact: true });
    await reference.waitFor({ state: 'attached' });
    await reference.scrollIntoViewIfNeeded();
    await reference.waitFor({ state: 'visible' });
    const referencePresentation = await reference.evaluate((activation) => ({
      cardTag: activation.parentElement?.tagName ?? '',
      cardBackground: activation.parentElement ? getComputedStyle(activation.parentElement).backgroundColor : '',
      activationBackground: getComputedStyle(activation).backgroundColor,
      activationShadow: getComputedStyle(activation).boxShadow,
    }));
    assert.equal(referencePresentation.cardTag, 'ARTICLE');
    assert.notEqual(referencePresentation.cardBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(referencePresentation.activationBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(referencePresentation.activationShadow, 'none');
    await reference.click();
    assert.equal(await reference.getAttribute('aria-expanded'), 'true');
    assert.equal(await library.getByText('Reference content is readable.', { exact: true }).isVisible(), true);

    const metadataPath = `/api/codex/server-skills/${skillName}`;
    const metadataPattern = `**${metadataPath}`;
    let releaseFavoriteSave = () => {};
    let observeFavoriteRequest = () => {};
    const favoriteSaveRelease = new Promise<void>((resolveRelease) => { releaseFavoriteSave = resolveRelease; });
    const favoriteRequestObserved = new Promise<void>((resolveObserved) => { observeFavoriteRequest = resolveObserved; });
    const delayFavoriteSave = async (route: Route) => {
      if (route.request().method() !== 'PUT' || route.request().postDataJSON()?.favorite !== false) return route.continue();
      observeFavoriteRequest();
      await favoriteSaveRelease;
      await route.continue();
    };
    await page.route(metadataPattern, delayFavoriteSave);
    const favoriteSavePromise = page.waitForResponse((response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === metadataPath);
    await library.getByRole('button', { name: 'Remove from favorites', exact: true }).click();
    await favoriteRequestObserved;
    assert.equal(await library.getByRole('button', { name: 'Add to favorites', exact: true }).getAttribute('aria-pressed'), 'false');
    releaseFavoriteSave();
    const favoriteSave = await favoriteSavePromise;
    await page.unroute(metadataPattern, delayFavoriteSave);
    assert.equal(favoriteSave.status(), 200);
    assert.equal((await favoriteSave.json()).skill.favorite, false);

    const tagChoice = library.getByRole('button', { name: 'Set Interface tag', exact: true });
    await tagChoice.waitFor({ state: 'visible' });
    const tagSavePromise = page.waitForResponse((response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === metadataPath);
    await tagChoice.click();
    const tagSave = await tagSavePromise;
    assert.equal(tagSave.status(), 200);
    assert.deepEqual((await tagSave.json()).skill.tags, ['Interface']);

    const persistedAfterSave = JSON.parse(readFileSync(join(fixture.workspace, '.decision-os', 'codex-pipelines.json'), 'utf8'));
    const persistedRecord = persistedAfterSave.skillLibrary.find((record: { skillName: string }) => record.skillName === skillName);
    assert.deepEqual({ favorite: persistedRecord.favorite, tags: persistedRecord.tags }, { favorite: false, tags: ['Interface'] });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await library.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('.process-library .codex-list-item').length >= 3);
    const reloadedSkill = library.locator('.process-library .codex-list-item').filter({ hasText: skillName });
    await reloadedSkill.waitFor({ state: 'visible' });
    assert.equal(await reloadedSkill.locator('.skill-favorite-star').count(), 0);
    assert.equal(await reloadedSkill.getByText('Interface', { exact: true }).count(), 1);

    const reloadedDetailPromise = page.waitForResponse((response) => new URL(response.url()).pathname === metadataPath && response.request().method() === 'GET');
    await reloadedSkill.click();
    await reloadedDetailPromise;
    assert.equal(await library.getByRole('button', { name: 'Add to favorites', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await library.getByRole('button', { name: 'Set Interface tag', exact: true }).getAttribute('aria-pressed'), 'true');

    let releaseRejectedTagSave = () => {};
    let observeRejectedTagRequest = () => {};
    const rejectedTagRelease = new Promise<void>((resolveRelease) => { releaseRejectedTagSave = resolveRelease; });
    const rejectedTagObserved = new Promise<void>((resolveObserved) => { observeRejectedTagRequest = resolveObserved; });
    const rejectTagSave = async (route: Route) => {
      if (route.request().method() !== 'PUT' || route.request().postDataJSON()?.tags?.[0] !== 'Architecture') return route.continue();
      observeRejectedTagRequest();
      await rejectedTagRelease;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Forced persistence rejection.' }) });
    };
    await page.route(metadataPattern, rejectTagSave);
    const rejectedTagResponse = page.waitForResponse((response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === metadataPath);
    await library.getByRole('button', { name: 'Set Architecture tag', exact: true }).click();
    await rejectedTagObserved;
    assert.equal(await library.getByRole('button', { name: 'Set Architecture tag', exact: true }).getAttribute('aria-pressed'), 'true');
    releaseRejectedTagSave();
    assert.equal((await rejectedTagResponse).status(), 500);
    await page.unroute(metadataPattern, rejectTagSave);
    await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('[aria-label="Set Interface tag"]')?.getAttribute('aria-pressed') === 'true');
    assert.equal(await library.getByRole('button', { name: 'Set Architecture tag', exact: true }).getAttribute('aria-pressed'), 'false');
    const persistedAfterRejection = JSON.parse(readFileSync(join(fixture.workspace, '.decision-os', 'codex-pipelines.json'), 'utf8'));
    assert.deepEqual(persistedAfterRejection.skillLibrary.find((record: { skillName: string }) => record.skillName === skillName).tags, ['Interface']);

    const restoreFavoritePromise = page.waitForResponse((response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === metadataPath);
    await library.getByRole('button', { name: 'Add to favorites', exact: true }).click();
    assert.equal((await (await restoreFavoritePromise).json()).skill.favorite, true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await library.waitFor({ state: 'visible' });
    const firstReloadedSkill = library.locator('.process-library .codex-list-item').first();
    assert.match(await firstReloadedSkill.locator('strong').textContent() ?? '', new RegExp(`^${skillName}`));
    assert.equal(await firstReloadedSkill.locator('.skill-favorite-star').count(), 1);
  } finally {
    await browser?.close();
    if (server) await stopDecisionOsServer(server.process);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

test('Reusable step pipelines preserve defaults and publish visible execution progression.', { timeout: 90_000 }, async () => {
  await assertFrontendSpec('Playwright for real browser interaction tests', 'cef65c97', 'canvas');
  const fixture = createFixture();
  let server: ServerHandle | undefined;
  let browser: Browser | undefined;
  try {
    server = await startDecisionOsServer(fixture);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
    page.on('pageerror', (error) => console.error('Browser page error:', error));
    const resizedCardIds = new Set<string>();
    page.on('request', (request) => {
      const requestPath = new URL(request.url()).pathname;
      if (request.method() !== 'PATCH' || !requestPath.endsWith('/decision-os/specs')) return;
      try {
        const body = request.postDataJSON() as { action?: string; geometry?: { cards?: Record<string, unknown> } };
        if (body.action === 'patch-geometry') Object.keys(body.geometry?.cards ?? {}).forEach((cardId) => resizedCardIds.add(cardId));
      } catch {
        // Non-JSON requests are irrelevant to the geometry assertion.
      }
    });
    await page.addInitScript(() => {
      const key = 'decision-os.pipeline-browser-loads';
      sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) ?? 0) + 1));
      localStorage.setItem('decision-os.canvas.state', JSON.stringify({
        activeTab: 'specs',
        railCollapsed: false,
        selection: { cardIds: [], zoneIds: [], groupIds: [] },
        viewport: { x: 0, y: 0, scale: 1 },
        viewports: { specs: { x: 0, y: 0, scale: 1 } },
      }));
    });
    await page.goto(`${server.url}/specs`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((cardId) => Boolean(window.__coreState?.activeLedger?.cards?.some((card: { id?: string }) => card.id === cardId)), sourceCardId);

    await createPipelineAndSkillDefaults(page);
    await runDirectInheritedSkill(page);
    await runCancelRestartAndFailPipeline(page, resizedCardIds);

    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('decision-os.pipeline-browser-loads') ?? 0)), 1,
      'Pipeline progression must not reload the page.');
    const launches = readFileSync(fixture.launchFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as LaunchRecord);
    const direct = launches.find((entry) => entry.step === skillName);
    const inherited = launches.filter((entry) => entry.step === 'Inherit defaults');
    const explicit = launches.filter((entry) => entry.step === 'Explicit override');
    assert.deepEqual({ model: direct?.model, effort: direct?.effort }, { model: 'gpt-5.4', effort: 'high' });
    assert.equal(inherited.length, 2, 'The inherited step must run once before and once after restart.');
    assert.ok(inherited.every((entry) => entry.model === 'gpt-5.4' && entry.effort === 'high'));
    assert.equal(explicit.length, 2, 'The explicit step must run once before and once after restart.');
    assert.ok(explicit.every((entry) => entry.model === 'gpt-5.5' && entry.effort === 'low'));
  } finally {
    await browser?.close();
    if (server) await stopDecisionOsServer(server.process);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

async function createPipelineAndSkillDefaults(page: Page): Promise<void> {
  await page.locator('[data-action="open-pipelines-modal"]').click();
  const library = page.locator('.pipelines-modal');
  await library.waitFor({ state: 'visible' });
  await library.getByRole('button', { name: 'New pipeline', exact: true }).click();
  const editor = page.locator('.pipeline-editor-modal');
  await editor.waitFor({ state: 'visible' });
  await editor.getByLabel('Pipeline name', { exact: true }).fill('Browser pipeline');
  await editor.getByLabel('Purpose', { exact: true }).fill('Prove inherited and explicit run settings.');
  assert.equal(await editor.locator('.pipeline-skill-picker').count(), 0, 'The skill catalog must not be embedded in the step editor.');
  await editor.getByRole('button', { name: 'Add skill', exact: true }).click();

  const skillPicker = page.locator('.pipeline-skill-picker-modal');
  await skillPicker.waitFor({ state: 'visible' });
  const pickerBox = await skillPicker.boundingBox();
  assert.ok((pickerBox?.width ?? 0) >= 850, 'The dedicated skill picker must use the expanded modal width.');
  assert.ok((pickerBox?.height ?? 0) >= 780, 'The dedicated skill picker must use four-fifths of the 1000px viewport.');
  await skillPicker.getByRole('button', { name: 'Edit skill', exact: true }).click();

  const skillEditor = page.locator('.skill-library-editor-modal');
  await skillEditor.waitFor({ state: 'visible' });
  await skillEditor.getByLabel('Default model', { exact: true }).selectOption('gpt-5.4');
  await skillEditor.getByLabel('Default effort', { exact: true }).selectOption('high');
  await skillEditor.getByRole('button', { name: 'Save skill', exact: true }).click();
  await skillEditor.getByText('Skill saved. Inherited run settings have been refreshed.', { exact: true }).waitFor({ state: 'visible' });
  await skillEditor.getByRole('button', { name: 'Close', exact: true }).click();
  await skillEditor.waitFor({ state: 'hidden' });
  await skillPicker.waitFor({ state: 'visible' });
  await skillPicker.getByRole('button', { name: 'Add skill', exact: true }).click();
  await skillPicker.waitFor({ state: 'hidden' });

  let openStep = editor.locator('.pipeline-step-card.is-open');
  await openStep.getByLabel('Step name', { exact: true }).fill('Inherit defaults');
  await openStep.getByLabel('Step purpose', { exact: true }).fill('Use the skill-library defaults.');
  assert.equal(await openStep.getByText('Use skill default', { exact: true }).count(), 2);
  await openStep.getByText('Current default: gpt-5.4', { exact: true }).waitFor({ state: 'visible' });
  await openStep.getByText('Current default: high', { exact: true }).waitFor({ state: 'visible' });

  await editor.getByRole('button', { name: 'New step', exact: true }).click();
  openStep = editor.locator('.pipeline-step-card.is-open');
  await openStep.getByLabel('Step name', { exact: true }).fill('Explicit override');
  await openStep.getByLabel('Step purpose', { exact: true }).fill('Override the library defaults.');
  await openStep.getByRole('button', { name: 'Add skill', exact: true }).click();
  await skillPicker.waitFor({ state: 'visible' });
  await skillPicker.getByRole('button', { name: 'Add skill', exact: true }).click();
  await skillPicker.waitFor({ state: 'hidden' });
  openStep = editor.locator('.pipeline-step-card.is-open');
  await openStep.getByLabel('Model', { exact: true }).selectOption('gpt-5.5');
  openStep = editor.locator('.pipeline-step-card.is-open');
  await openStep.getByLabel('Effort', { exact: true }).selectOption('low');
  openStep = editor.locator('.pipeline-step-card.is-open');
  assert.equal(await openStep.getByLabel('Model', { exact: true }).inputValue(), 'gpt-5.5');
  assert.equal(await openStep.getByLabel('Effort', { exact: true }).inputValue(), 'low');

  await editor.getByRole('button', { name: 'Save pipeline', exact: true }).click();
  await editor.getByText('Pipeline saved.', { exact: true }).waitFor({ state: 'visible' });
  await editor.getByRole('button', { name: 'Close pipeline editor', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  await library.getByText('Browser pipeline', { exact: true }).waitFor({ state: 'visible' });
  await library.getByRole('button', { name: 'Close', exact: true }).click();
  await library.waitFor({ state: 'hidden' });
}

async function runDirectInheritedSkill(page: Page): Promise<void> {
  await openProcessCard(page);
  const process = page.locator('.process-modal');
  await process.getByRole('tab', { name: 'Skills', exact: true }).click();
  await process.getByLabel('Model · default gpt-5.4', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await process.getByLabel('Model · default gpt-5.4', { exact: true }).inputValue(), 'gpt-5.4');
  assert.equal(await process.getByLabel('Effort · default high', { exact: true }).inputValue(), 'high');
  assert.equal(await process.getByText('Using skill default', { exact: true }).count(), 2);
  await process.getByRole('button', { name: 'Run one skill', exact: true }).click();
  await process.waitFor({ state: 'hidden' });

  const widget = pipelineWidget(page, `${skillName} run`, skillName);
  await widget.waitFor({ state: 'visible' });
  try {
    await widget.locator('[data-codex-run-status]').filter({ hasText: 'COMPLETE' }).waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    console.error('Direct pipeline widget did not complete:', await widget.innerText());
    throw error;
  }
  assert.equal(await widget.locator('[data-codex-run-model]').inputValue(), 'gpt-5.4');
  assert.equal(await widget.locator('[data-codex-run-effort]').inputValue(), 'high');
}

async function runCancelRestartAndFailPipeline(page: Page, resizedCardIds: Set<string>): Promise<void> {
  await openProcessCard(page);
  const process = page.locator('.process-modal');
  await process.locator('[data-process-pipeline-id]').click();
  await process.getByRole('button', { name: 'Run pipeline', exact: true }).click();
  await process.waitFor({ state: 'hidden' });

  const inheritedWidget = pipelineWidget(page, 'Browser pipeline', 'Inherit defaults');
  const explicitWidget = pipelineWidget(page, 'Browser pipeline', 'Explicit override');
  await inheritedWidget.waitFor({ state: 'visible' });
  await explicitWidget.waitFor({ state: 'visible' });
  await explicitWidget.locator('[data-codex-run-status]').filter({ hasText: 'PENDING' }).waitFor({ state: 'visible' });
  assert.equal(await explicitWidget.locator('[data-codex-run-restart]').isHidden(), true);

  await inheritedWidget.locator('[data-codex-run-status]').filter({ hasText: 'COMPLETE' }).waitFor({ state: 'visible', timeout: 15_000 });
  await explicitWidget.locator('[data-codex-run-status]').filter({ hasText: 'RUNNING' }).waitFor({ state: 'visible', timeout: 15_000 });
  assert.equal(await inheritedWidget.locator('[data-codex-run-model]').inputValue(), 'gpt-5.4');
  assert.equal(await inheritedWidget.locator('[data-codex-run-effort]').inputValue(), 'high');
  assert.equal(await explicitWidget.locator('[data-codex-run-model]').inputValue(), 'gpt-5.5');
  assert.equal(await explicitWidget.locator('[data-codex-run-effort]').inputValue(), 'low');
  const inheritedCardId = await cardIdForWidget(inheritedWidget);
  await waitFor(() => resizedCardIds.has(inheritedCardId), `Expected completed step ${inheritedCardId} to resize after its lifecycle event.`);

  await explicitWidget.getByRole('button', { name: 'Stop Codex run', exact: true }).click();
  await explicitWidget.locator('[data-codex-run-status]').filter({ hasText: 'CANCELLED' }).waitFor({ state: 'visible', timeout: 15_000 });
  await explicitWidget.getByRole('button', { name: 'Restart the complete pipeline', exact: true }).waitFor({ state: 'visible' });
  await explicitWidget.getByRole('button', { name: 'Restart the complete pipeline', exact: true }).click();
  await explicitWidget.locator('[data-codex-run-status]').filter({ hasText: 'PENDING' }).waitFor({ state: 'visible' });

  await inheritedWidget.locator('[data-codex-run-status]').filter({ hasText: 'COMPLETE' }).waitFor({ state: 'visible', timeout: 15_000 });
  await explicitWidget.locator('[data-codex-run-status]').filter({ hasText: 'FAILED' }).waitFor({ state: 'visible', timeout: 15_000 });
  await explicitWidget.getByRole('button', { name: 'Restart the complete pipeline', exact: true }).waitFor({ state: 'visible' });
}

function pipelineWidget(page: Page, pipelineName: string, stepName: string): Locator {
  // WHAT: Address the generated output card when a pipeline run is also projected onto its source card.
  // WHY: Source-card projection feeds its Codex Log, while lifecycle controls and result geometry belong to the generated card.
  return page.locator(`.card:not([data-card-id="${sourceCardId}"]) .codex-run-widget`)
    .filter({ has: page.locator('[data-codex-run-context]', { hasText: `${pipelineName} › ${stepName}` }) });
}

async function cardIdForWidget(widget: Locator): Promise<string> {
  return widget.evaluate((element) => ((element as HTMLElement).dataset.codexCardId ?? ''));
}

async function openProcessCard(page: Page): Promise<void> {
  await page.mouse.move(2, 2);
  const card = page.locator(`.card[data-card-id="${sourceCardId}"]`);
  await card.hover();
  const action = page.locator(`[data-action="open-card-process-modal"][data-card-id="${sourceCardId}"]`);
  await action.waitFor({ state: 'visible' });
  await action.click();
  await page.locator('.process-modal').waitFor({ state: 'visible' });
}

function createFixture(options: { extraSkillCount?: number } = {}): BrowserFixture {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-browser-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardDirectory = join(decisionOsRoot, 'cards', 'specs');
  const threadDirectory = join(decisionOsRoot, 'threads', 'specs');
  const skillDirectory = join(workspace, '.skills', skillName);
  const codexHome = join(workspace, '.codex-home');
  const fakeCodexFile = join(workspace, 'fake-codex.mjs');
  const launchFile = join(workspace, 'fake-codex-launches.jsonl');
  const counterFile = join(workspace, 'fake-codex-counts.json');
  mkdirSync(cardDirectory, { recursive: true });
  mkdirSync(threadDirectory, { recursive: true });
  mkdirSync(skillDirectory, { recursive: true });
  mkdirSync(join(codexHome, 'skills'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }, null, 2));
  writeFileSync(join(cardDirectory, `${sourceCardId}.md`), 'Browser pipeline source content.\n', 'utf8');
  writeFileSync(join(threadDirectory, `thread-${sourceCardId}.md`), '\n', 'utf8');
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{
      id: sourceCardId,
      title: 'Browser pipeline source',
      x: 120,
      y: 120,
      w: 360,
      h: 240,
      status: 'todo',
      comment: { contentFile: `.decision-os/cards/specs/${sourceCardId}.md` },
      facts: [],
      fields: [],
    }],
    annotations: [],
    relationships: [],
    notes: {},
    deletedNoteIds: {},
    threadFiles: { [`thread-${sourceCardId}`]: `.decision-os/threads/specs/thread-${sourceCardId}.md` },
    viewport: { x: 0, y: 0, scale: 1 },
  }, null, 2));
  writeFileSync(join(skillDirectory, 'SKILL.md'), [
    '---',
    `name: ${skillName}`,
    'description: Browser fixture skill for reusable pipeline verification.',
    '---',
    '',
    '# Browser fixture',
    '',
    'Write a concise result to the assigned output card.',
    '',
  ].join('\n'), 'utf8');
  mkdirSync(join(skillDirectory, 'references'), { recursive: true });
  writeFileSync(join(skillDirectory, 'references', 'guide.md'), '# Guide\n\nReference content is readable.\n', 'utf8');
  for (let index = 1; index <= (options.extraSkillCount ?? 0); index += 1) {
    const extraSkillName = `layout-skill-${String(index).padStart(2, '0')}`;
    const extraSkillDirectory = join(workspace, '.skills', extraSkillName);
    mkdirSync(extraSkillDirectory, { recursive: true });
    writeFileSync(join(extraSkillDirectory, 'SKILL.md'), [
      '---',
      `name: ${extraSkillName}`,
      'description: Browser fixture skill for verifying readable overflowing skill rows.',
      '---',
      '',
      `# ${extraSkillName}`,
      '',
      'Keep this skill row readable inside the Process card modal.',
      '',
    ].join('\n'), 'utf8');
  }
  writeFileSync(fakeCodexFile, fakeCodexSource({ launchFile, counterFile }), 'utf8');
  chmodSync(fakeCodexFile, 0o755);
  return { workspace, codexHome, fakeCodexFile, launchFile };
}

function fakeCodexSource(input: { launchFile: string; counterFile: string }): string {
  return [
    '#!/usr/bin/env node',
    'import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";',
    'const args = process.argv.slice(2);',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += String(chunk); });',
    'process.stdin.on("end", async () => {',
    '  const step = prompt.match(/^Active step title: (.+)$/m)?.[1]?.trim() || "unknown";',
    '  const outputFile = prompt.match(/^Write the final result to this Markdown file: (.+)$/m)?.[1]?.trim() || "";',
    `  const counts = existsSync(${JSON.stringify(input.counterFile)}) ? JSON.parse(readFileSync(${JSON.stringify(input.counterFile)}, "utf8")) : {};`,
    '  counts[step] = Number(counts[step] || 0) + 1;',
    `  writeFileSync(${JSON.stringify(input.counterFile)}, JSON.stringify(counts), "utf8");`,
    '  const modelIndex = Math.max(args.indexOf("--model"), args.indexOf("-m"));',
    '  const model = modelIndex >= 0 ? String(args[modelIndex + 1] || "") : "";',
    '  const effortArg = args.find((value) => String(value).includes("model_reasoning_effort=")) || "";',
    '  const effort = String(effortArg).split("=").slice(1).join("=").replace(/[\\"\']/g, "");',
    `  appendFileSync(${JSON.stringify(input.launchFile)}, JSON.stringify({ step, model, effort, call: counts[step] }) + "\\n", "utf8");`,
    '  if (outputFile) writeFileSync(outputFile, `## ${step}\\n\\nResolved model: ${model}\\n\\nResolved effort: ${effort}\\n`, "utf8");',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: `browser-${step}-${counts[step]}` }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: `message-${step}`, type: "agent_message", status: "completed", text: `Processed ${step}` } }));',
    '  if (step === "Explicit override" && counts[step] === 1) { setInterval(() => {}, 1000); return; }',
    '  if (step === "Explicit override" && counts[step] === 2) { console.error("Forced browser pipeline failure"); setTimeout(() => process.exit(1), 50); return; }',
    '  await new Promise((resolveDelay) => setTimeout(resolveDelay, step === "Inherit defaults" ? 750 : 150));',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '  setTimeout(() => process.exit(0), 50);',
    '});',
    '',
  ].join('\n');
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

async function startDecisionOsServer(fixture: BrowserFixture): Promise<ServerHandle> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: fixture.workspace,
    detached: true,
    env: {
      ...process.env,
      CODEX_BIN: fixture.fakeCodexFile,
      CODEX_HOME: fixture.codexHome,
      DECISION_OS_FRONTEND_ROOT: resolve(repoRoot, 'frontend'),
      HOST: '127.0.0.1',
      PORT: String(port),
      TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk) => output.push(String(chunk)));
  child.stderr?.on('data', (chunk) => output.push(String(chunk)));
  try {
    await waitFor(async () => {
      assert.equal(child.exitCode, null, `decision-os server exited early:\n${output.join('')}`);
      const response = await fetch(`${url}/specs`, { method: 'HEAD' }).catch(() => undefined);
      return Boolean(response?.ok);
    }, `Timed out waiting for decision-os server at ${url}/specs`);
  } catch (error) {
    await stopDecisionOsServer(child);
    throw error;
  }
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
  }
  const exited = await Promise.race([new Promise<boolean>((resolveExit) => child.once('exit', () => resolveExit(true))), delay(2000).then(() => false)]);
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
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

declare global {
  interface Window {
    __coreState: any;
  }
}
