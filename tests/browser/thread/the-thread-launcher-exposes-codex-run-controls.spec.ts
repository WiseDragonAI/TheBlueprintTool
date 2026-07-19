/**
 * WHAT: Browser proof that the thread launcher exposes the Codex model and effort controls.
 * WHY: Operators must be able to configure a thread-started Codex run before launching it.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('The thread launcher exposes Codex model and effort controls.', async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(`${server.url}/tasks-system`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__coreState?.activeLedger?.cards?.length));

    await page.evaluate(async () => {
      const state = window.__coreState;
      const cardId = String(state.activeLedger.cards[0].id);
      state.threadId = `thread-${cardId}`;
      state.threadPanelOpen = true;
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      renderThreadPanel();
    });

    const selectors = page.locator('.thread-codex-select');
    await assert.doesNotReject(() => selectors.nth(1).waitFor({ state: 'visible' }));
    assert.equal(await selectors.count(), 2);
    assert.equal(await selectors.nth(0).getAttribute('aria-label'), 'Model for thread Codex');
    assert.equal(await selectors.nth(1).getAttribute('aria-label'), 'Effort for thread Codex');
    assert.equal(await selectors.nth(0).inputValue(), 'gpt-5.6-sol');
    assert.equal(await selectors.nth(1).inputValue(), 'medium');

    await selectors.nth(0).selectOption('gpt-5.4');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexModel === 'gpt-5.4');
    await selectors.nth(1).selectOption('high');
    const button = page.locator('.thread-actions [data-action="process-thread-codex"]');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexEffort === 'high');
    assert.equal(await button.getAttribute('data-codex-model'), 'gpt-5.4');
    assert.equal(await button.getAttribute('data-codex-effort'), 'high');
    await selectors.nth(0).selectOption('gpt-5.6-sol');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexModel === 'gpt-5.6-sol');
    await selectors.nth(1).selectOption('medium');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexEffort === 'medium');

    const persistedWidgetSelection = await page.evaluate(async () => {
      const { renderCardSkillRunWidget } = await import('/src/runtime/codex/component/render-card-skill-run-widget.js');
      const widget = renderCardSkillRunWidget({
        id: 'card-a',
        codexThreadRunId: 'codex-skill-1000-widget',
        codexRunModel: 'gpt-5.4',
        codexRunEffort: 'high'
      });
      return {
        model: widget?.querySelector<HTMLSelectElement>('[data-codex-run-model]')?.value ?? '',
        effort: widget?.querySelector<HTMLSelectElement>('[data-codex-run-effort]')?.value ?? ''
      };
    });
    assert.deepEqual(persistedWidgetSelection, { model: 'gpt-5.4', effort: 'high' });

    const launcherFitsPanel = await page.evaluate(() => {
      const panel = document.querySelector('.thread-panel')?.getBoundingClientRect();
      const controls = [...document.querySelectorAll('.thread-actions > *')].map((element) => element.getBoundingClientRect());
      return Boolean(panel) && controls.every((control) => control.left >= panel.left && control.right <= panel.right);
    });
    assert.equal(launcherFitsPanel, true);

    const threadTab = page.locator('#thread-tab-thread');
    const logTab = page.locator('#thread-tab-codex-log');
    assert.equal(await page.locator('.thread-target-title').count(), 1);
    assert.equal(await page.locator('.thread-target').getAttribute('title'), await page.locator('.thread-target-title').innerText());
    assert.equal(await page.locator('.thread-target-title').getAttribute('title'), await page.locator('.thread-target-title').innerText());
    assert.equal(await page.locator('.thread-heading .kicker, .thread-heading h2, .thread-target-id').count(), 0);
    const titleTruncation = await page.evaluate(async () => {
      const state = window.__coreState;
      const owner = document.querySelector<HTMLElement>(`[data-thread-id="${state.threadId}"]`);
      const target = owner?.querySelector<HTMLElement>('.ledger-card-title, .zone-title, strong');
      const longTitle = 'A deliberately long active target title that must remain on one compact header row without displacing controls';
      if (target) target.textContent = longTitle;
      state.activeLedger.cards[0].title = longTitle;
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      renderThreadPanel();
      const title = document.querySelector<HTMLElement>('.thread-target');
      const titleText = document.querySelector<HTMLElement>('.thread-target-title');
      return { text: title?.textContent ?? '', nativeTitle: title?.title ?? '', truncated: Boolean(titleText && titleText.scrollWidth > titleText.clientWidth) };
    });
    assert.equal(titleTruncation.nativeTitle, titleTruncation.text);
    assert.equal(titleTruncation.truncated, true);
    assert.equal(await threadTab.getAttribute('role'), 'tab');
    assert.equal(await threadTab.getAttribute('aria-controls'), 'thread-panel-thread');
    assert.equal(await logTab.getAttribute('aria-controls'), 'thread-panel-codex-log');
    assert.equal(await page.locator('#thread-panel-thread').getAttribute('aria-labelledby'), 'thread-tab-thread');
    assert.equal(await page.locator('#thread-panel-codex-log').getAttribute('aria-labelledby'), 'thread-tab-codex-log');
    assert.equal(await threadTab.getAttribute('aria-selected'), 'true');
    assert.equal(await logTab.getAttribute('tabindex'), '-1');
    assert.equal(await page.locator('.voice-panel').isVisible(), true);

    await threadTab.focus();
    await page.keyboard.press('End');
    assert.equal(await logTab.getAttribute('aria-selected'), 'true');
    assert.equal(await logTab.evaluate((element) => element === document.activeElement), true);
    assert.equal(await page.locator('#thread-panel-thread').isHidden(), true);
    assert.equal(await page.locator('#thread-panel-codex-log').isVisible(), true);
    assert.equal(await page.locator('.codex-log-empty').innerText(), 'No Codex run for this thread.');
    assert.equal(await page.locator('.voice-panel').isHidden(), true);
    await page.keyboard.press('Home');
    assert.equal(await threadTab.getAttribute('aria-selected'), 'true');
    assert.equal(await threadTab.evaluate((element) => element === document.activeElement), true);
    assert.equal(await page.locator('.voice-panel').isVisible(), true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await logTab.getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await threadTab.getAttribute('aria-selected'), 'true');

    const bottomPositions = await page.evaluate(async () => {
      const { setThreadPanelTab } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      const conversation = document.querySelector<HTMLElement>('.thread-conversation-scroll');
      const log = document.querySelector<HTMLElement>('.thread-log-scroll');
      if (!conversation || !log) return null;
      conversation.scrollTop = conversation.scrollHeight;
      setThreadPanelTab('codex-log');
      log.scrollTop = log.scrollHeight;
      setThreadPanelTab('thread');
      const conversationBottom = conversation.scrollHeight - conversation.clientHeight - conversation.scrollTop;
      setThreadPanelTab('codex-log');
      const logBottom = log.scrollHeight - log.clientHeight - log.scrollTop;
      return { conversationBottom, logBottom };
    });
    assert.ok(bottomPositions);
    assert.ok(Math.abs(bottomPositions.conversationBottom) <= 1);
    assert.ok(Math.abs(bottomPositions.logBottom) <= 1);

    const tabMemory = await page.evaluate(async () => {
      const state = window.__coreState;
      const cards = state.activeLedger.cards;
      if (cards.length < 2) return null;
      const firstThread = state.threadId;
      const secondThread = `thread-${String(cards[1].id)}`;
      const { selectThread } = await import('/src/runtime/thread/effect/select-thread.js');
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      selectThread(secondThread);
      renderThreadPanel();
      const secondTab = document.querySelector('#thread-tab-thread')?.getAttribute('aria-selected');
      selectThread(firstThread);
      renderThreadPanel();
      const restoredTab = document.querySelector('#thread-tab-codex-log')?.getAttribute('aria-selected');
      return { secondTab, restoredTab };
    });
    assert.deepEqual(tabMemory, { secondTab: 'true', restoredTab: 'true' });

    const seededLog = await page.evaluate(async () => {
      const state = window.__coreState;
      const cardId = String(state.activeLedger.cards[0].id);
      const threadId = `thread-${cardId}`;
      const runId = 'codex-skill-9000-browser';
      const card = state.activeLedger.cards[0];
      const markdownBefore = JSON.stringify(state.activeLedger.notes?.[threadId] ?? []);
      card.codexThreadRunId = runId;
      card.codexRunModel = 'gpt-5.5';
      card.codexRunEffort = 'xhigh';
      state.threadRunIdByThreadId[threadId] = runId;
      state.threadRunSummaryByThreadId[threadId] = {
        ok: true,
        runId,
        runKind: 'thread',
        status: 'complete',
        startedAt: '2026-07-10T00:00:00.000Z',
        elapsedMs: 3200,
        lineCount: 3,
        nextSince: 3,
        toolCallCount: 1,
        agentMessageCount: 0,
        fileChangeCount: 0,
        thinkingCount: 1,
        warningCount: 1,
        errorCount: 0,
        transportStatus: 'degraded',
        persistedEventCount: 0,
        metadata: { sourceCardTitle: String(card.title), sourceThreadId: threadId, codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        latestEvent: null,
        events: [],
        diagnostics: []
      };
      const toolKey = `${runId}:item:tool-browser`;
      state.threadRunEventsByThreadId[threadId] = [
        {
          runId, line: 1, source: 'jsonl', sourceLine: 1, type: 'item.completed', kind: 'tool_call',
          title: 'rg browser', text: 'Tool completed.', status: 'completed', itemId: 'tool-browser', tool: 'rg browser',
          output: 'browser match', exitCode: '0', severity: 'info', persist: false, eventKey: toolKey, toolKey
        },
        {
          runId, line: 3, source: 'stderr', sourceLine: 1, type: 'stderr', kind: 'transport',
          title: 'Transport degraded', text: 'Connection lost.', status: 'degraded', itemId: '', tool: '', output: '',
          exitCode: '', severity: 'warning', persist: false, eventKey: `${runId}:event:stderr:1`, toolKey: ''
        }
      ];
      state.threadRunAnnouncementByThreadId[threadId] = { sequence: 1, text: 'Search completed.' };
      state.threadActiveTabByThreadId[threadId] = 'codex-log';
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      return { threadId, markdownBefore };
    });
    assert.equal(await page.locator('.codex-log-status').getAttribute('data-run-status'), 'complete');
    assert.match(await page.locator('.codex-log-diagnostic-summary').innerText(), /1 warning · transport degraded/i);
    assert.equal(await page.locator('.codex-tool-group').count(), 1);
    assert.match(await page.locator('.codex-tool-group-summary').innerText(), /^1 tool · 1 completed$/i);
    assert.equal(await page.locator('.codex-tool-group').getAttribute('open'), null);
    assert.equal(await page.locator('.codex-log-announcer').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('.codex-log-announcer').innerText(), 'Search completed.');

    const firstLiveElapsed = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const runId = String(state.threadRunIdByThreadId[threadId]);
      const summary = state.threadRunSummaryByThreadId[threadId];
      summary.status = 'running';
      summary.startedAt = '';
      summary.elapsedMs = 2200;
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      const { syncThreadCodexRunClock } = await import('/src/runtime/codex/effect/bind-thread-codex-run-log.js');
      renderThreadCodexLog();
      syncThreadCodexRunClock({ threadId, runId, summary });
      return document.querySelector<HTMLElement>('[data-codex-log-elapsed]')?.textContent ?? '';
    }, { threadId: seededLog.threadId });
    assert.equal(firstLiveElapsed, '00:02');
    await delay(1100);
    assert.equal(await page.locator('[data-codex-log-elapsed]').innerText(), '00:03');
    await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const runId = String(state.threadRunIdByThreadId[threadId]);
      const summary = state.threadRunSummaryByThreadId[threadId];
      summary.status = 'complete';
      summary.elapsedMs = 3200;
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      const { syncThreadCodexRunClock } = await import('/src/runtime/codex/effect/bind-thread-codex-run-log.js');
      syncThreadCodexRunClock({ threadId, runId, summary });
      renderThreadCodexLog();
    }, { threadId: seededLog.threadId });

    await page.locator('.codex-tool-group-summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.codex-tool-group').getAttribute('open'), '');
    assert.equal(await page.locator('.codex-tool-call').getAttribute('open'), null);
    assert.equal(await page.locator('.codex-tool-call-output').isHidden(), true);
    await page.locator('.codex-tool-call-summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.codex-tool-call').getAttribute('open'), '');
    assert.equal(await page.locator('.codex-tool-call-output').isVisible(), true);
    assert.equal(await page.locator('.codex-tool-call-output').innerText(), 'browser match');
    await page.evaluate(async () => {
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
    });
    assert.equal(await page.locator('.codex-tool-group').getAttribute('open'), '');
    assert.equal(await page.locator('.codex-tool-call').getAttribute('open'), '');

    const logScrollInvariant = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const runId = String(state.threadRunIdByThreadId[threadId]);
      const events = state.threadRunEventsByThreadId[threadId];
      for (let index = 0; index < 36; index += 1) {
        events.push({
          runId, line: 20 + index, source: 'jsonl', sourceLine: 20 + index, type: 'item.completed', kind: 'thinking',
          title: `Thinking ${index}`, text: `Diagnostic line ${index} with enough content to occupy the log viewport.`,
          status: 'completed', itemId: `thinking-${index}`, tool: '', output: '', exitCode: '', severity: 'info', persist: false,
          eventKey: `${runId}:event:jsonl:${20 + index}`, toolKey: ''
        });
      }
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      const viewport = document.querySelector<HTMLElement>('.thread-log-scroll');
      if (!viewport) return null;
      viewport.scrollTop = 80;
      const unpinnedBefore = viewport.scrollTop;
      events.push({
        runId, line: 80, source: 'jsonl', sourceLine: 80, type: 'item.completed', kind: 'thinking', title: 'Unpinned append',
        text: 'Keep the reader stationary.', status: 'completed', itemId: 'thinking-unpinned', tool: '', output: '', exitCode: '', severity: 'info', persist: false,
        eventKey: `${runId}:event:jsonl:80`, toolKey: ''
      });
      renderThreadCodexLog();
      const unpinnedAfter = viewport.scrollTop;
      viewport.scrollTop = viewport.scrollHeight;
      events.push({
        runId, line: 81, source: 'jsonl', sourceLine: 81, type: 'item.completed', kind: 'thinking', title: 'Pinned append',
        text: 'Keep the reader at the bottom.', status: 'completed', itemId: 'thinking-pinned', tool: '', output: '', exitCode: '', severity: 'info', persist: false,
        eventKey: `${runId}:event:jsonl:81`, toolKey: ''
      });
      renderThreadCodexLog();
      return {
        unpinnedBefore,
        unpinnedAfter,
        bottomDistance: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
      };
    }, { threadId: seededLog.threadId });
    assert.ok(logScrollInvariant);
    assert.equal(logScrollInvariant.unpinnedAfter, logScrollInvariant.unpinnedBefore);
    assert.ok(Math.abs(logScrollInvariant.bottomDistance) <= 1);

    const inactiveAnnouncement = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      state.threadActiveTabByThreadId[threadId] = 'thread';
      state.threadRunAnnouncementByThreadId[threadId] = { sequence: 2, text: 'Hidden update.' };
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      return {
        live: document.querySelector('.codex-log-announcer')?.getAttribute('aria-live'),
        text: document.querySelector('.codex-log-announcer')?.textContent,
        markdownAfter: JSON.stringify(state.activeLedger.notes?.[threadId] ?? [])
      };
    }, { threadId: seededLog.threadId });
    assert.deepEqual(inactiveAnnouncement, { live: 'off', text: '', markdownAfter: seededLog.markdownBefore });

    const runHistory = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const card = state.activeLedger.cards.find((candidate: { id: unknown }) => `thread-${String(candidate.id)}` === threadId);
      const currentRunId = String(card.codexThreadRunId);
      card.codexThreadRunIds = ['codex-skill-8999-browser', currentRunId];
      state.threadSelectedRunIdByThreadId[threadId] = currentRunId;
      state.threadActiveTabByThreadId[threadId] = 'codex-log';
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      return { currentRunId };
    }, { threadId: seededLog.threadId });
    assert.equal(await page.locator('.codex-log-run-position').innerText(), 'Run 2 of 2');
    assert.equal(await page.locator('[data-codex-run-history="previous"]').isEnabled(), true);
    assert.equal(await page.locator('[data-codex-run-history="next"]').isDisabled(), true);
    await page.locator('[data-codex-run-history="previous"]').click();
    assert.equal(await page.evaluate(({ threadId }) => window.__coreState.threadSelectedRunIdByThreadId[threadId], { threadId: seededLog.threadId }), 'codex-skill-8999-browser');
    await page.waitForFunction(() => document.querySelector('.codex-log-run-position')?.textContent?.trim() === 'Run 1 of 2');
    assert.equal(await page.locator('.codex-log-run-position').innerText(), 'Run 1 of 2');
    assert.equal(await page.locator('[data-codex-run-history="previous"]').isDisabled(), true);
    assert.equal(await page.locator('[data-codex-run-history="next"]').isEnabled(), true);
    await page.locator('[data-codex-run-history="next"]').click();
    assert.equal(await page.evaluate(({ threadId }) => window.__coreState.threadSelectedRunIdByThreadId[threadId], { threadId: seededLog.threadId }), runHistory.currentRunId);
    await page.waitForFunction(() => document.querySelector('.codex-log-run-position')?.textContent?.trim() === 'Run 2 of 2');

    for (const width of [1600, 1000, 760]) {
      await page.setViewportSize({ width, height: 700 });
      const metrics = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('.thread-panel');
        const heading = document.querySelector<HTMLElement>('.thread-heading');
        const target = document.querySelector<HTMLElement>('.thread-target');
        const toolbar = document.querySelector<HTMLElement>('.thread-toolbar');
        const tabs = document.querySelector<HTMLElement>('.thread-tabs');
        const tabButtons = [...document.querySelectorAll<HTMLElement>('.thread-tabs > .thread-tab')];
        const toolbarControls = [...document.querySelectorAll<HTMLElement>('.thread-toolbar > *')].map((element) => element.getBoundingClientRect());
        const actionRow = document.querySelector<HTMLElement>('.thread-actions')?.getBoundingClientRect();
        const actionControls = [...document.querySelectorAll<HTMLElement>('.thread-actions > *')].map((element) => element.getBoundingClientRect());
        const headingStyle = heading ? getComputedStyle(heading) : null;
        const targetRect = target?.getBoundingClientRect();
        const toolbarRect = toolbar?.getBoundingClientRect();
        const tabsRect = tabs?.getBoundingClientRect();
        return {
          panelWidth: panel?.getBoundingClientRect().width ?? 0,
          position: headingStyle?.position,
          rowTemplate: headingStyle?.gridTemplateRows,
          targetBottom: targetRect?.bottom ?? 0,
          toolbarTop: toolbarRect?.top ?? 0,
          toolbarHeight: toolbarRect?.height ?? 0,
          controlsFitRows: toolbarControls.every((rect) => rect.top >= (toolbarRect?.top ?? 0) - 1 && rect.bottom <= (toolbarRect?.bottom ?? 0) + 1)
            && actionControls.every((rect) => rect.top >= (actionRow?.top ?? 0) - 1 && rect.bottom <= (actionRow?.bottom ?? 0) + 1),
          rowsSeparated: (toolbarRect?.bottom ?? 0) <= (actionRow?.top ?? 0) + 1,
          tabsContained: tabButtons.every((button) => {
            const rect = button.getBoundingClientRect();
            return rect.top >= (tabsRect?.top ?? 0) && rect.bottom <= (tabsRect?.bottom ?? 0);
          }),
          modelWidth: document.querySelector<HTMLElement>('[data-codex-preference="model"]')?.getBoundingClientRect().width ?? 0,
          effortWidth: document.querySelector<HTMLElement>('[data-codex-preference="effort"]')?.getBoundingClientRect().width ?? 0,
        };
      });
      assert.equal(metrics.position, 'sticky');
      assert.match(metrics.rowTemplate ?? '', /px.*px/);
      assert.ok(metrics.targetBottom <= metrics.toolbarTop + metrics.toolbarHeight + 1, JSON.stringify({ width, metrics }));
      assert.ok(metrics.toolbarHeight >= 28 && metrics.toolbarHeight <= 62);
      assert.equal(metrics.controlsFitRows, true);
      assert.equal(metrics.rowsSeparated, true);
      assert.equal(metrics.tabsContained, true);
      assert.ok(metrics.modelWidth >= 112);
      assert.ok(metrics.effortWidth >= 84);
    }
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

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
    const response = await fetch(`${url}/tasks-system`, { method: 'HEAD' }).catch(() => undefined);
    return Boolean(response?.ok);
  }, `Timed out waiting for decision-os server at ${url}/tasks-system`);
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

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10000;
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
