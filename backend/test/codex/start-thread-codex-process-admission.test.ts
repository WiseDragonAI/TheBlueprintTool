/**
 * WHAT: Admission coverage for authoritative operator-triggered thread runs.
 * WHY: Stale card and queue state must never suppress Run; only a live child process may reject it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startThreadCodexProcessController } from '@backend/business/codex/controller/start-thread-codex-process-controller.js';
import { cancelCardSkillRunController } from '@backend/business/codex/controller/cancel-card-skill-run-controller.js';
import { enqueueCodexThreadProcess, markCodexProcessQueueItemRunning, readCodexProcessQueue } from '@backend/business/codex/helper/codex-process-queue.js';
import { runtimeCodexRunOwnsLiveProcess } from '@backend/business/codex/helper/runtime-codex-run-owns-live-process.js';

type Fixture = {
  workspace: string;
  decisionOsRoot: string;
  ledgerPath: string;
  cardId: string;
  threadId: string;
  staleRunId: string;
};

function fixture(): Fixture {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-authoritative-run-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardId = 'card-a';
  const threadId = `thread-${cardId}`;
  const staleRunId = 'codex-skill-1784100000000-stale';
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const cardRef = `.decision-os/cards/specs/${cardId}.md`;
  const threadRef = `.decision-os/threads/specs/${threadId}.md`;
  mkdirSync(join(decisionOsRoot, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'specs'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), `${JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }, null, 2)}\n`);
  writeFileSync(ledgerPath, `${JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Authoritative Run Card',
      status: 'todo',
      comment: { contentFile: cardRef },
      facts: [],
      fields: [],
      codexActiveRunId: staleRunId,
      codexThreadRunId: staleRunId,
    }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { [threadId]: threadRef },
  }, null, 2)}\n`);
  writeFileSync(join(workspace, cardRef), '# Authoritative Run Card\n');
  writeFileSync(join(workspace, threadRef), [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-15T08:10:40.966Z"} -->',
    '',
    'Run this thread now.',
    '',
  ].join('\n'));
  return { workspace, decisionOsRoot, ledgerPath, cardId, threadId, staleRunId };
}

async function waitForCondition(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}.`);
}

test('operator Run supersedes stale card ownership and a pending queue item', async () => {
  const context = fixture();
  const runtime: Record<string, unknown> = {
    decisionOsRoot: context.decisionOsRoot,
    codexSkillRuns: {
      [context.staleRunId]: { id: context.staleRunId, status: 'pending', pid: 0 },
    },
    scheduleCodexProcesses: async () => ({ ok: true, launched: [] }),
  };
  enqueueCodexThreadProcess({
    decisionOsRoot: context.decisionOsRoot,
    id: context.staleRunId,
    createdAt: '2026-07-15T08:00:00.000Z',
    payload: { ledgerId: 'specs', threadId: context.threadId, cardId: context.cardId },
  });

  try {
    const result = await startThreadCodexProcessController({
      action_payload: { ledgerId: 'specs', threadId: context.threadId, cardId: context.cardId },
      runtime_state: runtime,
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 202);
    const newRunId = String((result.run as Record<string, unknown>).id ?? '');
    assert.notEqual(newRunId, context.staleRunId);
    assert.deepEqual(readCodexProcessQueue(context.decisionOsRoot).map((item) => item.id), [newRunId]);
    const oldRuntimeRun = (runtime.codexSkillRuns as Record<string, Record<string, unknown>>)[context.staleRunId];
    assert.equal(oldRuntimeRun.status, 'cancelled');
    assert.equal(oldRuntimeRun.error, 'Superseded by an operator-triggered run.');
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexActiveRunId, newRunId);
    assert.equal(ledger.cards[0].codexThreadRunId, newRunId);
    assert.equal(ledger.cards[0].executionStatus, 'pending');
    assert.equal(ledger.cards[0].executionRunId, newRunId);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('operator Run is rejected while the card owns a live child process', async () => {
  const context = fixture();
  const liveChild = { pid: 4242, exitCode: null, killed: false };
  const runtime: Record<string, unknown> = {
    decisionOsRoot: context.decisionOsRoot,
    codexSkillRuns: {
      [context.staleRunId]: { id: context.staleRunId, status: 'running', pid: liveChild.pid, child: liveChild },
    },
  };

  try {
    const result = await startThreadCodexProcessController({
      action_payload: { ledgerId: 'specs', threadId: context.threadId, cardId: context.cardId },
      runtime_state: runtime,
    });

    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 409);
    assert.equal(result.error, 'Card already owns a live Codex process.');
    assert.deepEqual(readCodexProcessQueue(context.decisionOsRoot), []);
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexActiveRunId, context.staleRunId);
    assert.equal(ledger.cards[0].codexThreadRunId, context.staleRunId);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('turn lifecycle updates preserve the live child handle for cancellation', async () => {
  const context = fixture();
  const fakeCodex = join(context.workspace, 'fake-codex-live.mjs');
  const previousCodexBin = process.env.CODEX_BIN;
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'process.stdin.resume();',
    'process.stdin.on("end", () => {',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-live" }));',
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  setInterval(() => {}, 1000);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot: context.decisionOsRoot };
  enqueueCodexThreadProcess({
    decisionOsRoot: context.decisionOsRoot,
    id: context.staleRunId,
    createdAt: '2026-07-15T08:00:00.000Z',
    payload: { ledgerId: 'specs', threadId: context.threadId, cardId: context.cardId },
  });
  markCodexProcessQueueItemRunning(context.decisionOsRoot, context.staleRunId);

  try {
    const result = await startThreadCodexProcessController({
      action_payload: {
        ledgerId: 'specs',
        threadId: context.threadId,
        cardId: context.cardId,
        reservedRunId: context.staleRunId,
        queueDispatch: true,
      },
      runtime_state: runtime,
    });
    assert.equal(result.ok, true);
    const stdoutFile = String((result.run as Record<string, unknown>).stdoutFile ?? '');
    await waitForCondition(
      () => Boolean(stdoutFile && existsSync(stdoutFile) && readFileSync(stdoutFile, 'utf8').includes('turn.started')),
      'the turn.started event',
    );

    assert.equal(runtimeCodexRunOwnsLiveProcess(runtime, context.staleRunId), true);
    const cancellation = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.staleRunId },
      runtime_state: runtime,
    });
    assert.equal(cancellation.ok, true);
    assert.equal(cancellation.statusCode, 202);
    assert.equal(cancellation.status, 'cancelled');
    await waitForCondition(
      () => Boolean((runtime.codexSkillRuns as Record<string, { settledAt?: string }>)[context.staleRunId]?.settledAt),
      'the cancelled child to settle',
    );
  } finally {
    const run = (runtime.codexSkillRuns as Record<string, { child?: { kill?: (signal?: string) => boolean }; settledAt?: string }> | undefined)?.[context.staleRunId];
    if (!run?.settledAt) {
      run?.child?.kill?.('SIGKILL');
      await waitForCondition(() => Boolean(run?.settledAt), 'the test child cleanup');
    }
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(context.workspace, { recursive: true, force: true });
  }
});
