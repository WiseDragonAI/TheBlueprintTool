/**
 * WHAT: Browser proof that reconciliation preserves canvas and thread continuity across stale responses.
 * WHY: Real operator work must win over an older ledger load while lifecycle SSE updates stay thread-scoped.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page, type Response } from '@playwright/test';

type LedgerCard = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  codexThreadRunId?: string;
};

type LedgerDocument = {
  cards?: LedgerCard[];
  annotations?: Array<Record<string, unknown>>;
  relationships?: Array<Record<string, unknown>>;
  notes?: Record<string, Array<Record<string, unknown>>>;
  threadFiles?: Record<string, string>;
};

type LedgerGeometry = { x: number; y: number; width: number; height: number };

type LedgerGeometryPatch = {
  cards?: Record<string, LedgerGeometry>;
  zones?: Record<string, LedgerGeometry>;
  groups?: Record<string, LedgerGeometry>;
};

type PatchGeometryMutation = {
  action?: string;
  geometry?: LedgerGeometryPatch;
};

type TemporaryWorkspace = {
  workspace: string;
  ledgerFile: string;
  threadFile: string;
  promptFile: string;
  lifecycleSignalFile: string;
  fakeCodexFile: string;
};

type ServerHandle = {
  process: ChildProcess;
  url: string;
};

type DeferredSignal = {
  promise: Promise<void>;
  resolve(): void;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const targetCardId = 'card-continuity';
const alternateCardId = 'card-direct-selection';
const targetThreadId = `thread-${targetCardId}`;
const chromiumExecutablePath = '/snap/bin/chromium';

test('The refresh system preserves canvas continuity during operator work.', { timeout: 60_000 }, async () => {
  const fixture = createTemporaryWorkspace();
  let server: ServerHandle | undefined;
  let browser: Browser | undefined;
  const releaseStaleResponse = deferredSignal();

  try {
    server = await startDecisionOsServer(fixture);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const committedMutations: PatchGeometryMutation[] = [];
    const staleResponseCaptured = deferredSignal();
    const staleResponseDelivered = deferredSignal();
    let holdNextLedgerGet = false;
    let heldLedgerGet = false;
    let staleServerRevision = -1;

    await page.route(`${server.url}/decision-os/specs`, async (route) => {
      const request = route.request();
      if (request.method() === 'PATCH') {
        const mutation = request.postDataJSON() as PatchGeometryMutation;
        if (mutation.action === 'patch-geometry') committedMutations.push(mutation);
        await route.continue();
        return;
      }
      if (request.method() !== 'GET' || !holdNextLedgerGet || heldLedgerGet) {
        await route.continue();
        return;
      }

      heldLedgerGet = true;
      const upstream = await route.fetch();
      staleServerRevision = Number(upstream.headers()['x-decision-os-ledger-revision'] ?? -1);
      const body = await upstream.body();
      staleResponseCaptured.resolve();
      await releaseStaleResponse.promise;
      await route.fulfill({ response: upstream, body });
      staleResponseDelivered.resolve();
    });

    await seedCanvasViewport(page);
    await page.goto(`${server.url}/specs`, { waitUntil: 'domcontentloaded' });
    await waitForLedgerCard(page, targetCardId);

    const targetCard = page.locator(`[data-card-id="${targetCardId}"].ledger-node`);
    const alternateCard = page.locator(`[data-card-id="${alternateCardId}"].ledger-node`);
    await targetCard.waitFor({ state: 'visible' });
    await alternateCard.waitFor({ state: 'visible' });
    await targetCard.click();
    await assertSelectedCard(page, targetCardId);

    await page.keyboard.press('a');
    const modelSelect = page.locator('[data-codex-preference="model"]');
    const effortSelect = page.locator('[data-codex-preference="effort"]');
    await modelSelect.waitFor({ state: 'visible' });
    await modelSelect.selectOption('gpt-5.4');
    await effortSelect.selectOption('medium');
    await page.evaluate(() => {
      const browserWindow = window as Window & {
        __browserContinuityRefs?: {
          actions: Element | null;
          button: Element | null;
          effort: Element | null;
          model: Element | null;
          card: Element | null;
        };
      };
      browserWindow.__browserContinuityRefs = {
        actions: document.querySelector('.thread-actions'),
        button: document.querySelector('[data-action="process-thread-codex"]'),
        effort: document.querySelector('[data-codex-preference="effort"]'),
        model: document.querySelector('[data-codex-preference="model"]'),
        card: null,
      };
    });
    const threadHeaderBeforeLaunch = await threadHeaderGeometry(page);

    holdNextLedgerGet = true;
    await page.locator('[data-action="refresh"]').click();
    await staleResponseCaptured.promise;
    assert.ok(staleServerRevision >= 0, 'Expected the held ledger GET to carry a server revision');

    const startRequestPromise = page.waitForRequest((request) => request.url() === `${server?.url}/api/codex/threads/process` && request.method() === 'POST');
    const startResponsePromise = page.waitForResponse((response) => response.url() === `${server?.url}/api/codex/threads/process` && response.request().method() === 'POST');
    await page.locator('[data-action="process-thread-codex"]').click();
    const [startRequest, startResponse] = await Promise.all([startRequestPromise, startResponsePromise]);
    assert.equal(startResponse.status(), 202, await startResponse.text());
    assert.deepEqual(startRequest.postDataJSON(), {
      ledgerId: 'specs',
      threadId: targetThreadId,
      cardId: targetCardId,
      codexModel: 'gpt-5.4',
      codexEffort: 'medium',
    });
    const startedRun = await startResponse.json() as { ok?: boolean; run?: { id?: string } };
    const runId = String(startedRun.run?.id ?? '');
    assert.equal(startedRun.ok, true);
    assert.ok(runId, 'Expected the browser-started thread run to expose its run id');

    await page.waitForFunction(() => {
      const telemetry = (window as Window & { __coreTelemetry?: Array<{ name?: string }> }).__coreTelemetry ?? [];
      return telemetry.some((entry) => entry.name === 'codex-thread-process-created-widget');
    });
    const threadHeaderAfterLaunch = await threadHeaderGeometry(page);
    assert.deepEqual(threadHeaderAfterLaunch, threadHeaderBeforeLaunch, 'Thread-run refresh changed the launcher geometry');
    assert.equal(await controlsMatchCapturedReferences(page), true, 'Thread-run refresh replaced an unchanged thread control');

    await page.evaluate((cardId) => {
      const browserWindow = window as Window & {
        __browserContinuityRefs?: { card: Element | null };
      };
      if (browserWindow.__browserContinuityRefs) {
        browserWindow.__browserContinuityRefs.card = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"].ledger-node`);
      }
      (document.querySelector('[data-codex-preference="model"]') as HTMLSelectElement | null)?.focus();
    }, targetCardId);
    writeFileSync(fixture.lifecycleSignalFile, 'release lifecycle events\n', 'utf8');

    await page.locator('.thread-note-list').getByText('Browser lifecycle note.', { exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const telemetry = (window as Window & { __coreTelemetry?: Array<{ name?: string }> }).__coreTelemetry ?? [];
      return telemetry.some((entry) => entry.name === 'thread-content-refresh-applied');
    });
    const lifecycleContinuity = await page.evaluate(() => {
      const browserWindow = window as Window & {
        __browserContinuityRefs?: {
          actions: Element | null;
          button: Element | null;
          effort: Element | null;
          model: Element | null;
          card: Element | null;
        };
      };
      const refs = browserWindow.__browserContinuityRefs;
      return {
        actions: refs?.actions === document.querySelector('.thread-actions'),
        button: refs?.button === document.querySelector('[data-action="process-thread-codex"]'),
        effort: refs?.effort === document.querySelector('[data-codex-preference="effort"]'),
        model: refs?.model === document.querySelector('[data-codex-preference="model"]'),
        card: refs?.card === document.querySelector(`[data-card-id="${CSS.escape('card-continuity')}"].ledger-node`),
        focus: refs?.model === document.activeElement,
      };
    });
    assert.deepEqual(lifecycleContinuity, {
      actions: true,
      button: true,
      effort: true,
      model: true,
      card: true,
      focus: true,
    });
    await modelSelect.selectOption('gpt-5.3-codex');
    assert.equal(await page.locator('[data-action="process-thread-codex"]').getAttribute('data-codex-model'), 'gpt-5.3-codex');

    await page.locator('.canvas').focus();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const state = (window as Window & { __coreState?: { threadPanelOpen?: boolean } }).__coreState;
      return state?.threadPanelOpen === false && document.querySelector('.thread-panel')?.hasAttribute('hidden') === true;
    });
    await targetCard.click();
    await assertSelectedCard(page, targetCardId);

    const initialGeometry = await runtimeCardGeometry(page, targetCardId);
    const resizeToContentResponse = waitForNextGeometryResponse(page, server.url);
    await page.keyboard.press('Control+d');
    assert.equal((await resizeToContentResponse).status(), 200);
    await waitFor(() => committedMutations.length >= 1, 'Timed out waiting for the Ctrl+D geometry mutation');
    const contentSizedGeometry = await runtimeCardGeometry(page, targetCardId);
    assert.notEqual(contentSizedGeometry.height, initialGeometry.height, 'Ctrl+D did not resize the selected card to its content');
    assertMutationTargetsOnlyCard(committedMutations[0], targetCardId);
    assert.deepEqual(committedMutations[0].geometry?.cards?.[targetCardId], contentSizedGeometry);

    const cardBeforeDrag = await targetCard.boundingBox();
    assert.ok(cardBeforeDrag, 'Expected target card geometry before drag');
    const dragStart = {
      x: cardBeforeDrag.x + cardBeforeDrag.width / 2,
      y: cardBeforeDrag.y + cardBeforeDrag.height / 2,
    };
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + 96, dragStart.y + 32, { steps: 4 });
    const dragResponse = waitForNextGeometryResponse(page, server.url);
    await page.mouse.up();
    assert.equal((await dragResponse).status(), 200);
    await waitFor(() => committedMutations.length >= 2, 'Timed out waiting for the drag geometry mutation');
    const draggedGeometry = await runtimeCardGeometry(page, targetCardId);
    assert.deepEqual(draggedGeometry, {
      ...contentSizedGeometry,
      x: contentSizedGeometry.x + 96,
      y: contentSizedGeometry.y + 32,
    });
    assertMutationTargetsOnlyCard(committedMutations[1], targetCardId);
    assert.deepEqual(committedMutations[1].geometry?.cards?.[targetCardId], draggedGeometry);

    const resizeHandle = targetCard.locator('.resize-handle.se');
    const handleBox = await resizeHandle.boundingBox();
    assert.ok(handleBox, 'Expected the selected target card to expose its southeast resize handle');
    const resizeStart = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };
    await page.mouse.move(resizeStart.x, resizeStart.y);
    await page.mouse.down();
    await page.mouse.move(resizeStart.x + 64, resizeStart.y + 48, { steps: 4 });
    const resizeResponse = waitForNextGeometryResponse(page, server.url);
    await page.mouse.up();
    assert.equal((await resizeResponse).status(), 200);
    await waitFor(() => committedMutations.length >= 3, 'Timed out waiting for the pointer-resize geometry mutation');
    const resizedGeometry = await runtimeCardGeometry(page, targetCardId);
    assert.deepEqual(resizedGeometry, {
      ...draggedGeometry,
      width: draggedGeometry.width + 64,
      height: draggedGeometry.height + 48,
    });
    assertMutationTargetsOnlyCard(committedMutations[2], targetCardId);
    assert.deepEqual(committedMutations[2].geometry?.cards?.[targetCardId], resizedGeometry);

    await alternateCard.click();
    await assertSelectedCard(page, alternateCardId);
    await targetCard.click();
    await assertSelectedCard(page, targetCardId);
    const stateBeforeStaleResponse = await continuityState(page, targetCardId);

    releaseStaleResponse.resolve();
    await staleResponseDelivered.promise;
    await page.waitForFunction(() => {
      const telemetry = (window as Window & {
        __coreTelemetry?: Array<{ name?: string; args?: { reason?: string } }>;
      }).__coreTelemetry ?? [];
      return telemetry.some((entry) => entry.name === 'active-ledger-reconciliation-rejected' && entry.args?.reason === 'server-revision');
    });

    const stateAfterStaleResponse = await continuityState(page, targetCardId);
    assert.deepEqual(stateAfterStaleResponse, stateBeforeStaleResponse);
    assert.deepEqual(stateAfterStaleResponse.geometry, resizedGeometry);
    assert.deepEqual(stateAfterStaleResponse.selectedCardIds, [targetCardId]);
    assert.deepEqual(stateAfterStaleResponse.selectedDomCardIds, [targetCardId]);
    assert.equal(stateAfterStaleResponse.pointerActive, false);
    assert.ok(stateAfterStaleResponse.lastAppliedServerRevision > staleServerRevision);
    assert.equal(await controlsMatchCapturedReferences(page), true, 'Canvas reconciliations replaced unchanged thread controls');

    await page.keyboard.press('a');
    await modelSelect.waitFor({ state: 'visible' });
    assert.equal(await controlsMatchCapturedReferences(page), true, 'Reopening the unchanged thread remounted its controls');
    assert.equal(await modelSelect.inputValue(), 'gpt-5.3-codex');
    assert.equal(await page.locator('.thread-note-list').getByText('Browser lifecycle note.', { exact: true }).count(), 1);

    const persistedLedger = JSON.parse(readFileSync(fixture.ledgerFile, 'utf8')) as LedgerDocument;
    const persistedTarget = persistedLedger.cards?.find((card) => card.id === targetCardId);
    assert.ok(persistedTarget, 'Expected final target card in the temporary ledger');
    assert.deepEqual(cardGeometry(persistedTarget), resizedGeometry);
    assert.equal(persistedTarget.codexThreadRunId, runId);
    const persistedThread = readFileSync(fixture.threadFile, 'utf8');
    assert.match(persistedThread, /Browser lifecycle note\./);
    assert.equal((persistedThread.match(/^# AGENT$/gm) ?? []).length, 1);
    const prompt = readFileSync(fixture.promptFile, 'utf8');
    assert.match(prompt, /Launch Codex from this thread\./);
    assert.match(prompt, /Continuity target body\./);
    assert.doesNotMatch(prompt, new RegExp(escapeRegExp(fixture.workspace)));
    assert.equal(committedMutations.length, 3);
  } finally {
    releaseStaleResponse.resolve();
    await browser?.close();
    if (server) await stopDecisionOsServer(server.process);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});

function createTemporaryWorkspace(): TemporaryWorkspace {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-browser-refresh-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardDirectory = join(decisionOsRoot, 'cards', 'specs');
  const threadDirectory = join(decisionOsRoot, 'threads', 'specs');
  const ledgerFile = join(decisionOsRoot, 'specs.json');
  const threadFile = join(threadDirectory, `${targetThreadId}.md`);
  const promptFile = join(workspace, 'fake-codex-prompt.txt');
  const lifecycleSignalFile = join(workspace, 'release-lifecycle-events');
  const fakeCodexFile = join(workspace, 'fake-codex.mjs');
  mkdirSync(cardDirectory, { recursive: true });
  mkdirSync(threadDirectory, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }, null, 2));
  writeFileSync(join(cardDirectory, `${targetCardId}.md`), 'Continuity target body.\n', 'utf8');
  writeFileSync(join(cardDirectory, `${alternateCardId}.md`), 'Direct selection target body.\n', 'utf8');
  writeFileSync(threadFile, '# OPERATOR\n<!-- decision-os:note {"id":"note-browser-launch","timestamp":"2026-07-10T01:59:00.000Z"} -->\n\nLaunch Codex from this thread.\n', 'utf8');
  writeFileSync(join(threadDirectory, `thread-${alternateCardId}.md`), '\n', 'utf8');
  writeFileSync(ledgerFile, JSON.stringify({
    cards: [
      {
        id: targetCardId,
        title: 'Continuity target',
        x: 160,
        y: 130,
        w: 320,
        h: 320,
        status: 'todo',
        comment: { contentFile: `.decision-os/cards/specs/${targetCardId}.md` },
        facts: [],
        fields: [],
      },
      {
        id: alternateCardId,
        title: 'Direct selection target',
        x: 620,
        y: 150,
        w: 280,
        h: 180,
        status: 'todo',
        comment: { contentFile: `.decision-os/cards/specs/${alternateCardId}.md` },
        facts: [],
        fields: [],
      },
    ],
    annotations: [],
    relationships: [],
    notes: {},
    deletedNoteIds: {},
    threadFiles: {
      [targetThreadId]: `.decision-os/threads/specs/${targetThreadId}.md`,
      [`thread-${alternateCardId}`]: `.decision-os/threads/specs/thread-${alternateCardId}.md`,
    },
    viewport: { x: 0, y: 0, scale: 1 },
  }, null, 2));
  writeFileSync(fakeCodexFile, [
    '#!/usr/bin/env node',
    'import { appendFileSync, existsSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += String(chunk); });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(promptFile)}, prompt, "utf8");`,
    '  const timer = setInterval(() => {',
    `    if (!existsSync(${JSON.stringify(lifecycleSignalFile)})) return;`,
    '    clearInterval(timer);',
    `    appendFileSync(${JSON.stringify(threadFile)}, "\\n# AGENT\\n<!-- decision-os:note {\\"id\\":\\"note-agent-1783680838228-1c5bee79\\",\\"timestamp\\":\\"2026-07-10T02:00:00.000Z\\"} -->\\n\\nBrowser lifecycle note.\\n", "utf8");`,
    '    console.log(JSON.stringify({ type: "thread.started", thread_id: "browser-thread-session" }));',
    '    console.log(JSON.stringify({ type: "item.completed", item: { id: "browser-message", type: "agent_message", status: "completed", text: "Browser lifecycle note." } }));',
    '    console.log(JSON.stringify({ type: "turn.completed" }));',
    '  }, 10);',
    '});',
  ].join('\n'), 'utf8');
  chmodSync(fakeCodexFile, 0o755);
  return { workspace, ledgerFile, threadFile, promptFile, lifecycleSignalFile, fakeCodexFile };
}

async function seedCanvasViewport(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('decision-os.canvas.state', JSON.stringify({
      activeTab: 'specs',
      railCollapsed: false,
      selection: { cardIds: [], zoneIds: [], groupIds: [] },
      viewport: { x: 0, y: 0, scale: 1 },
      viewports: { specs: { x: 0, y: 0, scale: 1 } },
    }));
  });
}

async function waitForLedgerCard(page: Page, cardId: string): Promise<void> {
  await page.waitForFunction((id) => {
    const state = (window as Window & {
      __coreState?: { activeLedger?: { cards?: Array<{ id?: string }> } };
    }).__coreState;
    return Boolean(state?.activeLedger?.cards?.some((card) => String(card.id ?? '') === id));
  }, cardId);
}

async function assertSelectedCard(page: Page, cardId: string): Promise<void> {
  const selection = await page.evaluate(() => {
    const state = (window as Window & {
      __coreState?: { selection?: { cardIds?: string[]; zoneIds?: string[]; groupIds?: string[] } };
    }).__coreState;
    return {
      cardIds: [...(state?.selection?.cardIds ?? [])],
      zoneIds: [...(state?.selection?.zoneIds ?? [])],
      groupIds: [...(state?.selection?.groupIds ?? [])],
      domCardIds: Array.from(document.querySelectorAll('.ledger-node.selected[data-card-id]')).map((element) => (element as HTMLElement).dataset.cardId ?? ''),
    };
  });
  assert.deepEqual(selection, { cardIds: [cardId], zoneIds: [], groupIds: [], domCardIds: [cardId] });
}

async function runtimeCardGeometry(page: Page, cardId: string): Promise<LedgerGeometry> {
  return page.evaluate((id) => {
    const state = (window as Window & {
      __coreState?: { activeLedger?: { cards?: LedgerCard[] } };
    }).__coreState;
    const card = state?.activeLedger?.cards?.find((entry) => String(entry.id ?? '') === id);
    if (!card) throw new Error(`Runtime card not found: ${id}`);
    return {
      x: Number(card.x ?? 0),
      y: Number(card.y ?? 0),
      width: Number(card.w ?? card.width ?? 0),
      height: Number(card.h ?? card.height ?? 0),
    };
  }, cardId);
}

function cardGeometry(card: LedgerCard): LedgerGeometry {
  return {
    x: Number(card.x ?? 0),
    y: Number(card.y ?? 0),
    width: Number(card.w ?? card.width ?? 0),
    height: Number(card.h ?? card.height ?? 0),
  };
}

function waitForNextGeometryResponse(page: Page, baseUrl: string): Promise<Response> {
  return page.waitForResponse((response) => {
    if (response.url() !== `${baseUrl}/decision-os/specs` || response.request().method() !== 'PATCH') return false;
    try {
      return (response.request().postDataJSON() as PatchGeometryMutation).action === 'patch-geometry';
    } catch {
      return false;
    }
  });
}

function assertMutationTargetsOnlyCard(mutation: PatchGeometryMutation | undefined, cardId: string): void {
  assert.ok(mutation?.geometry, 'Expected a patch-geometry mutation');
  assert.deepEqual(Object.keys(mutation.geometry.cards ?? {}), [cardId]);
  assert.deepEqual(Object.keys(mutation.geometry.zones ?? {}), []);
  assert.deepEqual(Object.keys(mutation.geometry.groups ?? {}), []);
}

async function controlsMatchCapturedReferences(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const browserWindow = window as Window & {
      __browserContinuityRefs?: {
        actions: Element | null;
        button: Element | null;
        effort: Element | null;
        model: Element | null;
      };
    };
    const refs = browserWindow.__browserContinuityRefs;
    return Boolean(
      refs
      && refs.actions === document.querySelector('.thread-actions')
      && refs.button === document.querySelector('[data-action="process-thread-codex"]')
      && refs.effort === document.querySelector('[data-codex-preference="effort"]')
      && refs.model === document.querySelector('[data-codex-preference="model"]')
    );
  });
}

async function threadHeaderGeometry(page: Page): Promise<{
  headingHeight: number;
  toolbarHeight: number;
  actionsHeight: number;
  modelWidth: number;
  effortWidth: number;
  buttonWidth: number;
  buttonHeight: number;
  buttonCardId: string | undefined;
  buttonCodexCardId: string | undefined;
}> {
  return page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>('.thread-heading');
    const toolbar = document.querySelector<HTMLElement>('.thread-toolbar');
    const actions = document.querySelector<HTMLElement>('.thread-actions');
    const model = document.querySelector<HTMLElement>('[data-codex-preference="model"]');
    const effort = document.querySelector<HTMLElement>('[data-codex-preference="effort"]');
    const button = document.querySelector<HTMLElement>('[data-action="process-thread-codex"]');
    return {
      headingHeight: heading?.getBoundingClientRect().height ?? 0,
      toolbarHeight: toolbar?.getBoundingClientRect().height ?? 0,
      actionsHeight: actions?.getBoundingClientRect().height ?? 0,
      modelWidth: model?.getBoundingClientRect().width ?? 0,
      effortWidth: effort?.getBoundingClientRect().width ?? 0,
      buttonWidth: button?.getBoundingClientRect().width ?? 0,
      buttonHeight: button?.getBoundingClientRect().height ?? 0,
      buttonCardId: button?.dataset.cardId,
      buttonCodexCardId: button?.dataset.codexCardId,
    };
  });
}

async function continuityState(page: Page, cardId: string): Promise<{
  geometry: LedgerGeometry;
  selectedCardIds: string[];
  selectedDomCardIds: string[];
  pointerActive: boolean;
  activeTab: string;
  lastAppliedServerRevision: number;
  renderedGeometry: LedgerGeometry;
}> {
  return page.evaluate((id) => {
    const state = (window as Window & {
      __coreState?: {
        activeLedger?: { cards?: LedgerCard[] };
        activeTab?: string;
        selection?: { cardIds?: string[] };
        pointer?: unknown;
        ledgerReconciliation?: { lastAppliedServerRevision?: number };
      };
    }).__coreState;
    const card = state?.activeLedger?.cards?.find((entry) => String(entry.id ?? '') === id);
    const node = document.querySelector(`[data-card-id="${CSS.escape(id)}"].ledger-node`) as HTMLElement | null;
    if (!card || !node) throw new Error(`Continuity target missing: ${id}`);
    return {
      geometry: {
        x: Number(card.x ?? 0),
        y: Number(card.y ?? 0),
        width: Number(card.w ?? card.width ?? 0),
        height: Number(card.h ?? card.height ?? 0),
      },
      selectedCardIds: [...(state?.selection?.cardIds ?? [])],
      selectedDomCardIds: Array.from(document.querySelectorAll('.ledger-node.selected[data-card-id]')).map((element) => (element as HTMLElement).dataset.cardId ?? ''),
      pointerActive: Boolean(state?.pointer),
      activeTab: String(state?.activeTab ?? ''),
      lastAppliedServerRevision: Number(state?.ledgerReconciliation?.lastAppliedServerRevision ?? -1),
      renderedGeometry: {
        x: Number.parseFloat(node.style.left),
        y: Number.parseFloat(node.style.top),
        width: Number.parseFloat(node.style.width),
        height: Number.parseFloat(node.style.height),
      },
    };
  }, cardId);
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

async function startDecisionOsServer(fixture: TemporaryWorkspace): Promise<ServerHandle> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: fixture.workspace,
    detached: true,
    env: {
      ...process.env,
      CODEX_BIN: fixture.fakeCodexFile,
      HOST: '127.0.0.1',
      PORT: String(port),
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

function deferredSignal(): DeferredSignal {
  let settled = false;
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolveDeferred) => {
    resolvePromise = resolveDeferred;
  });
  return {
    promise,
    resolve() {
      if (settled) return;
      settled = true;
      resolvePromise?.();
    },
  };
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 15_000;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
