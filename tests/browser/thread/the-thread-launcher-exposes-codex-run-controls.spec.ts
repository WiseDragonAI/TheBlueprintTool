/**
 * WHAT: Browser proof that the thread launcher exposes the Codex model and effort controls.
 * WHY: Operators must be able to configure a thread-started Codex run before launching it.
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Locator, type Page } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';

test('The thread launcher exposes Codex model and effort controls.', async () => {
  const tasksSystemFile = resolve(repoRoot, '.decision-os/tasks-system.json');
  const originalTasksSystem = readFileSync(tasksSystemFile);
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
    const fixtureCardId = await page.evaluate(() => String(window.__coreState?.activeLedger?.cards?.[0]?.id ?? ''));
    const executionStateResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET'
      && new URL(response.url()).pathname.endsWith(`/api/tasks/${encodeURIComponent(fixtureCardId)}/execution-state`)
    ));

    await page.evaluate(async (cardId) => {
      const state = window.__coreState;
      state.activeLedger.cards[0].codexRunModel = 'gpt-5.6-sol';
      state.activeLedger.cards[0].codexRunEffort = 'medium';
      state.threadId = `thread-${cardId}`;
      state.threadPanelOpen = true;
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      renderThreadPanel();
    }, fixtureCardId);
    assert.equal((await executionStateResponse).status(), 200);

    const selectors = page.locator('.thread-codex-select');
    await assert.doesNotReject(() => selectors.nth(1).waitFor({ state: 'visible' }));
    assert.equal(await selectors.count(), 2);
    assert.equal(await selectors.nth(0).getAttribute('aria-label'), 'Model for thread Codex');
    assert.equal(await selectors.nth(1).getAttribute('aria-label'), 'Effort for thread Codex');
    assert.equal(await selectors.nth(0).inputValue(), 'gpt-5.6-sol');
    assert.equal(await selectors.nth(1).inputValue(), 'medium');

    await selectPersistedPreference(page, selectors.nth(0), 'gpt-5.4');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexModel === 'gpt-5.4');
    await selectPersistedPreference(page, selectors.nth(1), 'high');
    const button = page.locator('.thread-actions [data-action="process-thread-codex"]');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexEffort === 'high');
    assert.equal(await button.getAttribute('data-codex-model'), 'gpt-5.4');
    assert.equal(await button.getAttribute('data-codex-effort'), 'high');
    await selectPersistedPreference(page, selectors.nth(0), 'gpt-5.6-sol');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.thread-actions [data-action="process-thread-codex"]')?.dataset.codexModel === 'gpt-5.6-sol');
    await selectPersistedPreference(page, selectors.nth(1), 'medium');
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

    const upwardScrollSetup = await page.evaluate(async () => {
      const state = window.__coreState;
      const threadId = String(state.threadId);
      state.threadActiveTabByThreadId[threadId] = 'thread';
      state.activeLedger.notes[threadId] = Array.from({ length: 32 }, (_, index) => ({
        id: `scroll-regression-${index}`,
        role: index % 2 === 0 ? 'operator' : 'agent',
        message: `Thread viewport regression line ${index}: enough content to keep the conversation surface scrollable.`,
      }));
      const { requestThreadViewportEntry } = await import('/src/runtime/thread/effect/request-thread-viewport-entry.js');
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      requestThreadViewportEntry(threadId, 'thread', 'tab-activation');
      renderThreadPanel();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const viewport = document.querySelector<HTMLElement>('.thread-conversation-scroll');
      return viewport ? {
        bottomDistance: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
      } : null;
    });
    assert.ok(upwardScrollSetup);
    assert.ok(upwardScrollSetup.scrollHeight > 0);
    assert.ok(Math.abs(upwardScrollSetup.bottomDistance) <= 1);

    const conversationViewport = page.locator('.thread-conversation-scroll');
    assert.equal(await conversationViewport.count(), 1);
    await conversationViewport.hover();
    await page.mouse.wheel(0, -500);
    await page.waitForFunction(() => {
      const state = window.__coreState;
      return state.threadFollowBottomByThreadId[String(state.threadId)] === false;
    });
    const upwardScrollBeforeResize = await conversationViewport.evaluate((viewport) => viewport.scrollTop);
    await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>('.thread-note-list');
      const delayedBlock = document.createElement('div');
      delayedBlock.style.height = '320px';
      delayedBlock.textContent = 'Delayed layout growth';
      content?.append(delayedBlock);
    });
    await page.waitForTimeout(100);
    const upwardScrollAfterResize = await conversationViewport.evaluate((viewport) => viewport.scrollTop);
    assert.equal(upwardScrollAfterResize, upwardScrollBeforeResize);

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
      const restoredTab = document.querySelector('#thread-tab-thread')?.getAttribute('aria-selected');
      return { secondTab, restoredTab };
    });
    assert.deepEqual(tabMemory, { secondTab: 'true', restoredTab: 'true' });

    const seededLog = await page.evaluate(async () => {
      const state = window.__coreState;
      const cardId = String(state.activeLedger.cards[0].id);
      const threadId = `thread-${cardId}`;
      const runId = 'codex-skill-9000-browser';
      const executionId = 'execution-9000-browser';
      const card = state.activeLedger.cards[0];
      const markdownBefore = JSON.stringify(state.activeLedger.notes?.[threadId] ?? []);
      state.threadActiveTabByThreadId[threadId] = 'codex-log';
      const { setThreadPanelTab } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      setThreadPanelTab('codex-log');
      const { unbindThreadCodexRunLog } = await import('/src/runtime/codex/effect/bind-thread-codex-run-log.js');
      unbindThreadCodexRunLog({
        projectId: String(state.projectId ?? ''),
        replicaNodeId: String(state.replicaNodeId ?? ''),
        ledgerId: String(state.activeTab ?? ''),
        cardId,
        threadId,
        runId: '',
      });
      card.codexThreadRunId = runId;
      card.codexRunModel = 'gpt-5.5';
      card.codexRunEffort = 'xhigh';
      state.threadRunIdByThreadId[threadId] = runId;
      const execution = {
        executionId,
        sessionId: runId,
        sourceCardId: cardId,
        kind: 'thread',
        phase: 'succeeded',
        requestedAt: '2026-07-10T00:00:00.000Z',
        startedAt: '2026-07-10T00:00:00.000Z',
        finishedAt: '2026-07-10T00:00:03.200Z',
        model: 'gpt-5.5',
        effort: 'xhigh',
        predecessorExecutionId: null,
        executorNodeId: 'workstation',
        revision: 1,
        queuePosition: null,
        error: null,
        artifacts: { jsonl: true, stderr: true, telemetry: false, result: false },
      };
      state.threadTaskExecutionStateByThreadId[threadId] = {
        taskId: cardId,
        activeExecutionIds: [],
        defaultExecutionId: executionId,
        sessions: [{ sessionId: runId, requestedAt: execution.requestedAt, executions: [execution] }],
      };
      state.threadSelectedExecutionIdByThreadId[threadId] = executionId;
      state.threadExecutionPresentationByThreadId[threadId] = {
        execution: {
          executionId,
          sessionId: runId,
          taskId: cardId,
          kind: 'thread',
          phase: 'succeeded',
          requestedAt: execution.requestedAt,
          startedAt: execution.startedAt,
          finishedAt: execution.finishedAt,
          model: execution.model,
          effort: execution.effort,
          executorNodeId: execution.executorNodeId,
          revision: execution.revision,
          error: null,
          counts: { tools: 1, messages: 0, comments: 0, thinking: 0, files: 0, warnings: 1, errors: 0 },
        },
        events: [
          {
            id: 'tool-browser',
            kind: 'tool_call',
            title: 'rg browser',
            command: 'rg browser',
            status: 'completed',
            exitCode: '0',
            severity: 'info',
          },
          {
            id: 'transport-browser',
            kind: 'transport',
            title: 'Transport degraded',
            text: 'Connection lost.',
            status: 'degraded',
            severity: 'warning',
          },
        ],
      };
      // The live clock still consumes the compatibility summary while status and events use task execution state.
      state.threadRunSummaryByThreadId[threadId] = {
        ok: true,
        runId,
        executionId,
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
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      return { threadId, markdownBefore };
    });
    assert.equal(await page.locator('.codex-log-status').getAttribute('data-run-status'), 'complete');
    assert.match(await page.locator('.codex-log-diagnostic-summary').innerText(), /1 warning · transport degraded/i);
    assert.equal(await page.locator('.codex-tool-group').count(), 1);
    assert.equal(await page.locator('.codex-tool-group-summary').textContent(), '1 tool call · 1/1 settled');
    assert.equal(await page.locator('.codex-tool-group').getAttribute('open'), null);

    const firstLiveElapsed = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const runId = String(state.threadRunIdByThreadId[threadId]);
      const summary = state.threadRunSummaryByThreadId[threadId];
      const taskSummary = state.threadTaskExecutionStateByThreadId[threadId];
      const execution = taskSummary.sessions[0].executions[0];
      summary.status = 'running';
      summary.startedAt = '';
      summary.elapsedMs = 2200;
      execution.phase = 'running';
      execution.startedAt = new Date(Date.now() - 2200).toISOString();
      execution.finishedAt = null;
      taskSummary.activeExecutionIds = [execution.executionId];
      state.threadExecutionPresentationByThreadId[threadId].execution.phase = 'running';
      state.threadExecutionPresentationByThreadId[threadId].execution.startedAt = execution.startedAt;
      state.threadExecutionPresentationByThreadId[threadId].execution.finishedAt = null;
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
      const taskSummary = state.threadTaskExecutionStateByThreadId[threadId];
      const execution = taskSummary.sessions[0].executions[0];
      summary.status = 'complete';
      summary.elapsedMs = 3200;
      execution.phase = 'succeeded';
      execution.finishedAt = new Date(Date.parse(execution.startedAt) + 3200).toISOString();
      taskSummary.activeExecutionIds = [];
      state.threadExecutionPresentationByThreadId[threadId].execution.phase = 'succeeded';
      state.threadExecutionPresentationByThreadId[threadId].execution.finishedAt = execution.finishedAt;
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      const { syncThreadCodexRunClock } = await import('/src/runtime/codex/effect/bind-thread-codex-run-log.js');
      syncThreadCodexRunClock({ threadId, runId, summary });
      renderThreadCodexLog();
    }, { threadId: seededLog.threadId });

    await page.locator('.codex-tool-group-summary').click();
    assert.equal(await page.locator('.codex-tool-group').getAttribute('open'), '');
    assert.equal(await page.locator('.codex-tool-call').getAttribute('open'), null);
    await page.locator('.codex-tool-call-summary').click();
    assert.equal(await page.locator('.codex-tool-call').getAttribute('open'), '');
    assert.equal(await page.locator('.codex-tool-call-full-command').innerText(), 'rg browser');
    assert.equal(await page.locator('.codex-tool-call-output').count(), 0);
    await page.evaluate(async () => {
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
    });
    assert.equal(await page.locator('.codex-tool-group').getAttribute('open'), '');
    assert.equal(await page.locator('.codex-tool-call').getAttribute('open'), '');

    const logScrollInvariant = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const events = state.threadExecutionPresentationByThreadId[threadId].events;
      for (let index = 0; index < 36; index += 1) {
        events.push({
          id: `thinking-${index}`, kind: 'thinking',
          title: `Thinking ${index}`, text: `Diagnostic line ${index} with enough content to occupy the log viewport.`,
          status: 'completed', severity: 'info',
        });
      }
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      const { renderThreadCodexLogUpdate } = await import('/src/runtime/thread/effect/render-thread-codex-log-update.js');
      renderThreadCodexLog();
      const viewport = document.querySelector<HTMLElement>('.thread-log-scroll');
      if (!viewport) return null;
      viewport.scrollTop = viewport.scrollHeight;
      viewport.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
      viewport.scrollTop = 80;
      viewport.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
      const unpinnedBefore = viewport.scrollTop;
      events.push({
        id: 'thinking-unpinned', kind: 'thinking', title: 'Unpinned append',
        text: 'Keep the reader stationary.', status: 'completed', severity: 'info',
      });
      renderThreadCodexLogUpdate();
      const unpinnedAfter = viewport.scrollTop;
      const { pinThreadSurfaceToBottom } = await import('/src/runtime/thread/effect/pin-thread-feed-to-last-message.js');
      pinThreadSurfaceToBottom('codex-log', { follow: true });
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
      events.push({
        id: 'thinking-pinned', kind: 'thinking', title: 'Pinned append',
        text: 'Keep the reader at the bottom.', status: 'completed', severity: 'info',
      });
      renderThreadCodexLogUpdate();
      return {
        unpinnedBefore,
        unpinnedAfter,
        bottomDistance: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
      };
    }, { threadId: seededLog.threadId });
    assert.ok(logScrollInvariant);
    assert.equal(logScrollInvariant.unpinnedAfter, logScrollInvariant.unpinnedBefore);
    assert.ok(Math.abs(logScrollInvariant.bottomDistance) <= 1);

    const inactiveRender = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      state.threadActiveTabByThreadId[threadId] = 'thread';
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      return {
        status: document.querySelector('.codex-log-status')?.getAttribute('data-run-status'),
        markdownAfter: JSON.stringify(state.activeLedger.notes?.[threadId] ?? [])
      };
    }, { threadId: seededLog.threadId });
    assert.deepEqual(inactiveRender, { status: 'complete', markdownAfter: seededLog.markdownBefore });

    const runHistory = await page.evaluate(async ({ threadId }) => {
      const state = window.__coreState;
      const card = state.activeLedger.cards.find((candidate: { id: unknown }) => `thread-${String(candidate.id)}` === threadId);
      const taskSummary = state.threadTaskExecutionStateByThreadId[threadId];
      const currentExecution = taskSummary.sessions[0].executions[0];
      const previousRunId = 'codex-skill-8999-browser';
      const previousExecutionId = 'execution-8999-browser';
      const previousExecution = {
        ...currentExecution,
        executionId: previousExecutionId,
        sessionId: previousRunId,
        requestedAt: '2026-07-09T00:00:00.000Z',
        startedAt: '2026-07-09T00:00:00.000Z',
        finishedAt: '2026-07-09T00:00:02.000Z',
        revision: 1,
      };
      taskSummary.sessions.unshift({
        sessionId: previousRunId,
        requestedAt: previousExecution.requestedAt,
        executions: [previousExecution],
      });
      state.threadSelectedExecutionIdByThreadId[threadId] = currentExecution.executionId;
      state.threadActiveTabByThreadId[threadId] = 'codex-log';
      const { renderThreadCodexLog } = await import('/src/runtime/thread/effect/render-thread-codex-log.js');
      renderThreadCodexLog();
      return { currentExecutionId: currentExecution.executionId, previousExecutionId };
    }, { threadId: seededLog.threadId });
    assert.equal(await page.locator('.codex-log-run-position').textContent(), 'Execution 2 of 2');
    assert.equal(await page.locator('.codex-log-run-arrow--previous').isEnabled(), true);
    assert.equal(await page.locator('.codex-log-run-arrow--next').isDisabled(), true);
    const historyTransitions = await page.evaluate(({ threadId }) => {
      const previous = document.querySelector<HTMLButtonElement>('.codex-log-run-arrow--previous');
      previous?.click();
      const afterPrevious = {
        selectedExecutionId: window.__coreState.threadSelectedExecutionIdByThreadId[threadId],
        position: document.querySelector('.codex-log-run-position')?.textContent,
        previousDisabled: document.querySelector<HTMLButtonElement>('.codex-log-run-arrow--previous')?.disabled,
        nextDisabled: document.querySelector<HTMLButtonElement>('.codex-log-run-arrow--next')?.disabled,
      };
      document.querySelector<HTMLButtonElement>('.codex-log-run-arrow--next')?.click();
      return {
        afterPrevious,
        afterNext: {
          selectedExecutionId: window.__coreState.threadSelectedExecutionIdByThreadId[threadId],
          position: document.querySelector('.codex-log-run-position')?.textContent,
        },
      };
    }, { threadId: seededLog.threadId });
    assert.deepEqual(historyTransitions, {
      afterPrevious: {
        selectedExecutionId: runHistory.previousExecutionId,
        position: 'Execution 1 of 2',
        previousDisabled: true,
        nextDisabled: false,
      },
      afterNext: {
        selectedExecutionId: runHistory.currentExecutionId,
        position: 'Execution 2 of 2',
      },
    });

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
    writeFileSync(tasksSystemFile, originalTasksSystem);
  }
});

async function selectPersistedPreference(page: Page, select: Locator, value: string): Promise<void> {
  const response = page.waitForResponse((candidate) => (
    candidate.request().method() === 'PATCH'
    && new URL(candidate.url()).pathname.endsWith('/decision-os/tasks-system')
  ));
  await select.selectOption(value);
  assert.equal((await response).status(), 200);
}

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
