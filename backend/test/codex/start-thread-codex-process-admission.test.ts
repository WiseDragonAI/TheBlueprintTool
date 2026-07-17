/**
 * WHAT: Admission coverage for authoritative operator-triggered thread runs.
 * WHY: Stale card and queue state must never suppress Run; only a live child process may reject it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startThreadCodexProcessController } from '@backend/business/codex/controller/start-thread-codex-process-controller.js';
import { enqueueCodexThreadProcess, readCodexProcessQueue } from '@backend/business/codex/helper/codex-process-queue.js';

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
