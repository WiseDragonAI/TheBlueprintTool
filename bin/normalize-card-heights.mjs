#!/usr/bin/env node
/**
 * WHAT: Browser-backed migration for ledger cards missing explicit heights.
 * WHY: Card geometry is runtime-owned, so legacy natural-height cards need h before the zoom refactor.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] ?? '';
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

async function waitForCdp(port, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Browser is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Chromium did not expose CDP on port ${port}.`);
}

function cdpClient(webSocketDebuggerUrl) {
  let id = 1;
  const pending = new Map();
  const waiters = new Map();
  const ws = new WebSocket(webSocketDebuggerUrl);
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolveCall, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolveCall(message.result ?? {});
      return;
    }
    if (message.method && waiters.has(message.method)) {
      for (const waiter of waiters.get(message.method).splice(0)) waiter(message.params ?? {});
    }
  });
  return {
    close() {
      ws.close();
    },
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady, { once: true });
      ws.addEventListener('error', rejectReady, { once: true });
    }),
    send(method, params = {}) {
      const callId = id++;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolveCall, reject) => pending.set(callId, { resolve: resolveCall, reject }));
    },
    waitEvent(method) {
      return new Promise((resolveEvent) => {
        const list = waiters.get(method) ?? [];
        list.push(resolveEvent);
        waiters.set(method, list);
      });
    }
  };
}

async function waitForCards(client, count) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await client.send('Runtime.evaluate', {
      expression: `(() => ({ ready: document.readyState, cards: document.querySelectorAll('.card[data-card-id]').length }))()`,
      returnByValue: true
    }).catch(() => undefined);
    const value = result?.result?.value;
    if (value?.ready === 'complete' && value.cards >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Ledger cards did not finish rendering.');
}

async function measureMissingHeights(url, ids, chromeBinary, port) {
  const profile = await mkdtemp(resolve(tmpdir(), 'corev2-height-migration-'));
  const browser = spawn(chromeBinary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank'
  ], { stdio: 'ignore' });
  try {
    await waitForCdp(port);
    const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((response) => response.json());
    const client = cdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.waitEvent('Page.loadEventFired').catch(() => {});
    await waitForCards(client, ids.length);
    const result = await client.send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const ids = ${JSON.stringify(ids)};
        const heights = {};
        document.querySelector('.canvas')?.classList.remove('low-detail', 'overview-detail');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        for (const id of ids) {
          const card = document.querySelector(\`[data-card-id="\${CSS.escape(id)}"]\`);
          if (!card) continue;
          const previousHeight = card.style.height;
          const previousMinHeight = card.style.minHeight;
          const detail = card.querySelector('.ledger-card-detail-layer');
          const previousVisibility = detail?.style.visibility ?? '';
          const previousContentVisibility = detail?.style.contentVisibility ?? '';
          card.style.height = 'auto';
          card.style.minHeight = '132px';
          if (detail) {
            detail.style.visibility = 'visible';
            detail.style.contentVisibility = 'visible';
          }
          await new Promise((resolve) => requestAnimationFrame(resolve));
          heights[id] = Math.max(132, Math.ceil(card.scrollHeight || card.getBoundingClientRect().height));
          card.style.height = previousHeight;
          card.style.minHeight = previousMinHeight;
          if (detail) {
            detail.style.visibility = previousVisibility;
            detail.style.contentVisibility = previousContentVisibility;
          }
        }
        return heights;
      })()`
    });
    client.close();
    return result.result.value ?? {};
  } finally {
    browser.kill();
    await rm(profile, { recursive: true, force: true });
  }
}

const ledgerPath = argValue('--ledger');
const url = argValue('--url');
const chromeBinary = argValue('--chrome') || '/snap/bin/chromium';
const port = Number(argValue('--port') || 9233);

if (!ledgerPath || !url) {
  console.error('Usage: normalize-card-heights --ledger <ledger.json> --url <http://host/route> [--chrome <path>] [--port <port>]');
  process.exit(1);
}

const absoluteLedgerPath = resolve(ledgerPath);
const originalText = await readFile(absoluteLedgerPath, 'utf8');
const ledger = JSON.parse(originalText);
if (!ledger || typeof ledger !== 'object' || !Array.isArray(ledger.cards)) {
  throw new Error('Ledger must be a JSON object with a cards array.');
}

const missing = ledger.cards.filter((card) => {
  if (!card || typeof card !== 'object') return false;
  if (!card.id) return false;
  return typeof card.h !== 'number' && typeof card.height !== 'number';
});

if (missing.length === 0) {
  console.log('No cards missing h; no migration needed.');
  process.exit(0);
}

const heights = await measureMissingHeights(url, missing.map((card) => String(card.id)), chromeBinary, port);
const backupDir = resolve(dirname(absoluteLedgerPath), 'backups', `card-height-${stamp()}`);
const backupPath = join(backupDir, basename(absoluteLedgerPath));
await mkdir(backupDir, { recursive: true });
await writeFile(backupPath, originalText, 'utf8');

let changed = 0;
for (const card of ledger.cards) {
  if (!card || typeof card !== 'object' || typeof card.id !== 'string') continue;
  if (typeof card.h === 'number' || typeof card.height === 'number') continue;
  const height = Number(heights[card.id]);
  if (!Number.isFinite(height) || height <= 0) continue;
  card.h = Math.max(132, Math.ceil(height));
  changed += 1;
}

await writeFile(absoluteLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
console.log(`Backed up ${absoluteLedgerPath} to ${backupPath}`);
console.log(`Normalized ${changed} card heights.`);
