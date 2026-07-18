/**
 * WHAT: Browser proof that an active desktop voice recording previews X modifiers.
 * WHY: The visible action must match the launch mode before the operator stops recording.
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

test('desktop voice action previews Shift and Control without changing the X key badge', async () => {
  const server = await startDecisionOsServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromiumExecutablePath) ? chromiumExecutablePath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(`${server.url}/tasks-system`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__coreState?.activeLedger?.cards?.length));
    await page.evaluate(async () => {
      const { state } = await import('/src/runtime/state.js');
      const cardId = String(state.activeLedger.cards[0].id);
      state.threadId = `thread-${cardId}`;
      state.threadPanelOpen = true;
      state.voice.recording = true;
      const { renderThreadPanel } = await import('/src/runtime/thread/effect/render-thread-panel.js');
      const { renderVoiceStatus } = await import('/src/runtime/voice/effect/render-voice-status.js');
      renderThreadPanel();
      renderVoiceStatus();
    });

    const action = page.locator('.voice-action--send');
    await action.waitFor({ state: 'visible' });
    await assertAction(action, { mode: 'send', label: 'SEND', path: 'M4 12 20 4l-5 16' });
    assert.equal(await page.evaluate(async () => (await import('/src/runtime/state.js')).state.voice.recording), true);

    await page.keyboard.down('Shift');
    assert.equal(await page.evaluate(async () => (await import('/src/runtime/state.js')).state.voice.recording), true);
    await assertAction(action, { mode: 'run', label: 'RUN', path: 'M5 12h14' });

    await page.keyboard.down('Control');
    await assertAction(action, { mode: 'pipeline', label: 'PIPELINE', path: 'M5 6h5v5H5z' });

    await page.keyboard.up('Control');
    await assertAction(action, { mode: 'run', label: 'RUN', path: 'M5 12h14' });

    await page.keyboard.up('Shift');
    await assertAction(action, { mode: 'send', label: 'SEND', path: 'M4 12 20 4l-5 16' });
  } finally {
    await browser?.close();
    await stopDecisionOsServer(server.process);
  }
});

async function assertAction(action: import('@playwright/test').Locator, expected: { mode: string; label: string; path: string }): Promise<void> {
  assert.equal(await action.getAttribute('data-launch-mode'), expected.mode);
  assert.equal(await action.locator('.terminal-button__key').innerText(), 'X');
  assert.equal(await action.locator('.terminal-button__label').innerText(), expected.label);
  assert.match(await action.locator('.terminal-button__icon').innerHTML(), new RegExp(expected.path));
}

async function startDecisionOsServer(): Promise<{ process: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    '--import',
    resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs'),
    resolve(repoRoot, 'backend/src/server.ts')
  ], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      DECISION_OS_FRONTEND_ROOT: resolve(repoRoot, 'frontend'),
      TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json'),
      HOST: '127.0.0.1',
      PORT: String(port)
    },
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
