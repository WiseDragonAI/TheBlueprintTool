/**
 * WHAT: Covers cancellation through a durable Codex process identity.
 * WHY: A restarted server and a lost non-enumerable child handle must not leave a live run unstoppable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cancelCardSkillRunController } from '@backend/business/codex/controller/cancel-card-skill-run-controller.js';
import {
  enqueueCodexThreadProcess,
  markCodexProcessQueueItemRunning,
  readCodexProcessQueue,
  recordCodexProcessQueueItemProcess,
} from '@backend/business/codex/helper/codex-process-queue.js';

test('cancels a live run through its PID and start identity when the runtime child handle is absent', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-persisted-cancel-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const runId = 'codex-skill-persisted-live';
  const cardId = 'card-a';
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: cardId, codexActiveRunId: runId, codexThreadRunId: runId, executionStatus: 'running', executionRunId: runId }],
  }));
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  const closed = once(child, 'close');
  enqueueCodexThreadProcess({
    decisionOsRoot,
    id: runId,
    createdAt: '2026-07-17T07:00:00.000Z',
    payload: { ledgerId: 'specs', threadId: `thread-${cardId}`, cardId },
  });
  markCodexProcessQueueItemRunning(decisionOsRoot, runId);
  recordCodexProcessQueueItemProcess({
    decisionOsRoot,
    id: runId,
    processId: child.pid ?? 0,
    stdoutFile: join(decisionOsRoot, 'run.jsonl'),
    stderrFile: join(decisionOsRoot, 'run.log'),
  });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    codexSkillRuns: {
      [runId]: { id: runId, ledgerId: 'specs', outputCardId: cardId, status: 'running', adopted: true, pid: child.pid },
    },
  };

  try {
    const result = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId, runId },
      runtime_state: runtime,
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 202);
    assert.equal(result.status, 'cancelled');
    await closed;
    assert.deepEqual(readCodexProcessQueue(decisionOsRoot), []);
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexActiveRunId, undefined);
    assert.equal(ledger.cards[0].executionStatus, undefined);
    assert.equal(ledger.cards[0].executionRunId, undefined);
    assert.equal(ledger.cards[0].codexThreadRunId, runId);
  } finally {
    if (child.exitCode === null) {
      try {
        process.kill(process.platform === 'win32' ? child.pid ?? 0 : -(child.pid ?? 0), 'SIGKILL');
      } catch {
        // The expected cancellation already settled the process.
      }
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});
