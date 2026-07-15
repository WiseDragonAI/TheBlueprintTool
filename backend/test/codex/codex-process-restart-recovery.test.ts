import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { enqueueCodexThreadProcess, readCodexProcessQueue } from '@backend/business/codex/helper/codex-process-queue.js';

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

async function waitForFile(file: string, decisionOsRoot: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (existsSync(file)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${file}; queue=${JSON.stringify(readCodexProcessQueue(decisionOsRoot))}`);
}

async function waitForQueueToDrain(decisionOsRoot: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (readCodexProcessQueue(decisionOsRoot).length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for the Codex queue to drain at ${decisionOsRoot}`);
}

function createProject(root: string, ledger: Record<string, unknown> | null): string {
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: ledger ? [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] : [],
  }, null, 2));
  if (ledger) writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify(ledger, null, 2));
  return decisionOsRoot;
}

test('server startup drains pending Codex work discovered after an empty project', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const home = mkdtempSync(join(tmpdir(), 'decision-os-restart-queue-'));
  const masterDecisionOsRoot = createProject(home, null);
  createProject(join(home, 'a-empty'), null);
  const queuedProject = join(home, 'b-queued');
  const queuedDecisionOsRoot = createProject(queuedProject, {
    cards: [{ id: 'card-queued', title: 'Queued card', codexThreadRunId: 'run-queued', comment: { what: 'Queued card body.' }, facts: [], fields: [] }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-queued': '.decision-os/threads/specs/thread-card-queued.md' },
  });
  const threadDirectory = join(queuedDecisionOsRoot, 'threads', 'specs');
  mkdirSync(threadDirectory, { recursive: true });
  writeFileSync(join(threadDirectory, 'thread-card-queued.md'), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-queued","timestamp":"2026-07-15T06:00:00.000Z"} -->',
    '',
    'Resume this queued task.',
  ].join('\n'));
  writeFileSync(join(queuedDecisionOsRoot, 'codex-process-queue.json'), JSON.stringify({
    version: 1,
    items: [{
      id: 'run-queued',
      kind: 'thread',
      status: 'pending',
      createdAt: '2026-07-15T06:00:01.000Z',
      startedAt: null,
      interruptedAt: null,
      interruptionReason: '',
      payload: { ledgerId: 'specs', threadId: 'thread-card-queued', cardId: 'card-queued' },
    }],
  }, null, 2));
  const invocationFile = join(queuedProject, 'invoked.txt');
  const fakeCodex = join(home, 'fake-codex.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    `writeFileSync(${JSON.stringify(invocationFile)}, "started");`,
    'process.stdin.resume();',
    'process.stdin.on("end", () => console.log(JSON.stringify({ type: "turn.completed" })));',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot: masterDecisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');

  try {
    await waitForFile(invocationFile, queuedDecisionOsRoot);
    assert.equal(readFileSync(invocationFile, 'utf8'), 'started');
    await waitForQueueToDrain(queuedDecisionOsRoot);
    assert.deepEqual(readCodexProcessQueue(queuedDecisionOsRoot), []);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(home, { recursive: true, force: true });
  }
});

test('server queue scanner launches pending work added after startup', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const home = mkdtempSync(join(tmpdir(), 'decision-os-recurring-queue-scan-'));
  const decisionOsRoot = createProject(home, {
    cards: [{ id: 'card-late', title: 'Late queued card', codexThreadRunId: 'run-late', comment: { what: 'Late body.' }, facts: [], fields: [] }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { 'thread-card-late': '.decision-os/threads/specs/thread-card-late.md' },
  });
  const threadDirectory = join(decisionOsRoot, 'threads', 'specs');
  mkdirSync(threadDirectory, { recursive: true });
  writeFileSync(join(threadDirectory, 'thread-card-late.md'), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-late","timestamp":"2026-07-15T06:00:00.000Z"} -->',
    '',
    'Launch after startup.',
  ].join('\n'));
  const invocationFile = join(home, 'invoked-late.txt');
  const fakeCodex = join(home, 'fake-codex-late.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    `writeFileSync(${JSON.stringify(invocationFile)}, "started");`,
    'process.stdin.resume();',
    'process.stdin.on("end", () => console.log(JSON.stringify({ type: "turn.completed" })));',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');

  try {
    enqueueCodexThreadProcess({
      decisionOsRoot,
      id: 'run-late',
      createdAt: new Date().toISOString(),
      payload: { ledgerId: 'specs', threadId: 'thread-card-late', cardId: 'card-late' },
    });
    await waitForFile(invocationFile, decisionOsRoot);
    assert.equal(readFileSync(invocationFile, 'utf8'), 'started');
    await waitForQueueToDrain(decisionOsRoot);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(home, { recursive: true, force: true });
  }
});
