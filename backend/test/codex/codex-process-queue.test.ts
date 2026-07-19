import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  codexProcessQueuePosition,
  enqueueCodexContinuation,
  enqueueCodexThreadProcess,
  markCodexProcessQueueItemRunning,
  recordCodexProcessQueueItemProcess,
  readCodexProcessQueue,
  recoverCodexProcessQueue,
  removeCodexProcessQueueItem,
} from '../../src/business/codex/helper/codex-process-queue.js';
import { runningCodexProcessCount, unifiedCodexQueuePosition } from '../../src/business/codex/helper/codex-process-scheduler.js';
import { maxConcurrentCodexProcesses } from '../../src/business/codex/helper/codex-pipeline-runner.js';

test('persists mixed Codex work in FIFO order and recovers a claimed thread as a continuation', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-process-queue-'));
  try {
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
    writeFileSync(resolve(root, 'specs.json'), JSON.stringify({ cards: [
      { id: 'a', codexActiveRunId: 'thread-a', codexActiveExecutionId: 'execution-a' },
      { id: 'b', codexActiveRunId: 'b', codexActiveExecutionId: 'execution-b' },
    ] }));
    enqueueCodexThreadProcess({ decisionOsRoot: root, id: 'thread-a', createdAt: '2026-07-14T10:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'a', runId: 'thread-a', executionId: 'execution-a' } });
    enqueueCodexContinuation({ decisionOsRoot: root, id: 'continue-b', createdAt: '2026-07-14T10:00:01.000Z', payload: { ledgerId: 'specs', cardId: 'b', runId: 'b', executionId: 'execution-b' } });
    assert.equal(codexProcessQueuePosition(root, 'thread-a'), 1);
    assert.equal(codexProcessQueuePosition(root, 'continue-b'), 2);
    assert.equal(markCodexProcessQueueItemRunning(root, 'thread-a')?.status, 'running');
    assert.equal(codexProcessQueuePosition(root, 'continue-b'), 1);
    recoverCodexProcessQueue(root);
    const recovered = readCodexProcessQueue(root);
    assert.deepEqual(recovered.map((item) => [item.id, item.kind, item.status]), [['thread-a', 'continuation', 'pending'], ['continue-b', 'continuation', 'pending']]);
    assert.equal(recovered[0].startedAt, null);
    assert.equal(recovered[0].interruptedAt, null);
    assert.equal(recovered[0].interruptionReason, '');
    assert.deepEqual(recovered[0].payload, {
      ledgerId: 'specs', cardId: 'a',
      runId: 'thread-a',
      executionId: 'execution-a',
      newSession: false,
      restartRecovery: true,
    });
    assert.equal(codexProcessQueuePosition(root, 'thread-a'), 1);
    recoverCodexProcessQueue(root);
    assert.equal(readCodexProcessQueue(root)[0].status, 'pending');
    removeCodexProcessQueueItem(root, 'thread-a');
    assert.deepEqual(readCodexProcessQueue(root).map((item) => item.id), ['continue-b']);
    assert.equal(JSON.parse(readFileSync(resolve(root, 'codex-process-queue.json'), 'utf8')).version, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adopts a matching live process and ignores terminal output until the process exits', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-live-process-adoption-'));
  try {
    const stdoutFile = resolve(root, 'run-a.jsonl');
    const stderrFile = resolve(root, 'run-a.log');
    writeFileSync(stdoutFile, `${JSON.stringify({ type: 'turn.started' })}\n`);
    writeFileSync(stderrFile, '');
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
    writeFileSync(resolve(root, 'specs.json'), JSON.stringify({ cards: [{ id: 'card-a', codexActiveRunId: 'run-a', codexActiveExecutionId: 'execution-a' }] }));
    enqueueCodexThreadProcess({
      decisionOsRoot: root,
      id: 'run-a',
      createdAt: '2026-07-15T08:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-a' },
    });
    markCodexProcessQueueItemRunning(root, 'run-a');
    recordCodexProcessQueueItemProcess({ decisionOsRoot: root, id: 'run-a', processId: process.pid, stdoutFile, stderrFile });
    const runtime: Record<string, unknown> = {};

    recoverCodexProcessQueue(root, runtime);

    assert.equal(readCodexProcessQueue(root)[0]?.status, 'running');
    assert.deepEqual((runtime.codexSkillRuns as Record<string, Record<string, unknown>>)['run-a'], {
      id: 'run-a',
      executionId: 'execution-a',
      ledgerId: 'specs',
      outputCardId: 'card-a',
      stdoutFile,
      stderrFile,
      pid: process.pid,
      status: 'running',
      startedAt: readCodexProcessQueue(root)[0]?.startedAt,
      adopted: true,
      queueItemId: 'run-a',
    });
    writeFileSync(stdoutFile, [JSON.stringify({ type: 'turn.started' }), JSON.stringify({ type: 'turn.completed' })].join('\n'));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(readCodexProcessQueue(root)[0]?.status, 'running');
    assert.equal(((runtime.codexSkillRuns as Record<string, Record<string, unknown>>)['run-a']).status, 'running');
    removeCodexProcessQueueItem(root, 'run-a');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('surviving process identity wins over terminal JSONL during restart recovery', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-terminal-process-recovery-'));
  try {
    const stdoutFile = resolve(root, 'run-complete.jsonl');
    const stderrFile = resolve(root, 'run-complete.log');
    writeFileSync(stdoutFile, [JSON.stringify({ type: 'turn.started' }), JSON.stringify({ type: 'turn.completed' })].join('\n'));
    writeFileSync(stderrFile, '');
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }],
    }));
    writeFileSync(resolve(root, 'specs.json'), JSON.stringify({
      cards: [{
        id: 'card-a',
        codexActiveRunId: 'run-complete',
        codexActiveExecutionId: 'execution-complete',
        executionStatus: 'running',
        executionRunId: 'run-complete',
      }],
    }));
    enqueueCodexThreadProcess({
      decisionOsRoot: root,
      id: 'run-complete',
      createdAt: '2026-07-15T08:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-complete', executionId: 'execution-complete' },
    });
    markCodexProcessQueueItemRunning(root, 'run-complete');
    recordCodexProcessQueueItemProcess({ decisionOsRoot: root, id: 'run-complete', processId: process.pid, stdoutFile, stderrFile });
    const runtime: Record<string, unknown> = {};

    recoverCodexProcessQueue(root, runtime);

    assert.equal(readCodexProcessQueue(root)[0]?.status, 'running');
    assert.equal(((runtime.codexSkillRuns as Record<string, Record<string, unknown>>)['run-complete']).status, 'running');
    assert.equal(JSON.parse(readFileSync(resolve(root, 'specs.json'), 'utf8')).cards[0].codexActiveExecutionId, 'execution-complete');
    removeCodexProcessQueueItem(root, 'run-complete');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('finds terminal output for a legacy running item without persisted process fields', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-legacy-terminal-recovery-'));
  try {
    const runId = 'legacy-run';
    const directory = resolve(root, 'runs', 'codex-skills', 'specs');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, `${runId}.jsonl`), JSON.stringify({ type: 'turn.completed' }));
    writeFileSync(resolve(root, 'codex-process-queue.json'), JSON.stringify({
      version: 1,
      items: [{
        id: runId,
        kind: 'thread',
        status: 'running',
        createdAt: '2026-07-15T08:00:00.000Z',
        startedAt: '2026-07-15T08:00:01.000Z',
        payload: { ledgerId: 'specs', cardId: 'card-a' },
      }],
    }));

    recoverCodexProcessQueue(root, {});

    assert.deepEqual(readCodexProcessQueue(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requeues one owned continuation per interrupted logical run and drops stale ownership', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-interrupted-logical-runs-'));
  try {
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }],
    }));
    writeFileSync(resolve(root, 'specs.json'), JSON.stringify({
      cards: [
        { id: 'card-owned', codexThreadRunId: 'run-owned', codexActiveRunId: 'run-owned', codexActiveExecutionId: 'execution-new' },
        { id: 'card-stale', codexThreadRunId: 'run-newer' },
      ],
    }));
    const runDirectory = resolve(root, 'runs', 'codex-skills', 'specs');
    mkdirSync(runDirectory, { recursive: true });
    writeFileSync(resolve(runDirectory, 'run-owned.jsonl'), [
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'turn.completed' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'item.started', item: { id: 'latest-work', type: 'command_execution' } }),
    ].join('\n'));
    writeFileSync(resolve(root, 'codex-process-queue.json'), JSON.stringify({
      version: 1,
      items: [
        { id: 'continue-owned-a', kind: 'continuation', status: 'interrupted', createdAt: '2026-07-15T01:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'card-owned', runId: 'run-owned', executionId: 'execution-old' } },
        { id: 'continue-owned-b', kind: 'continuation', status: 'interrupted', createdAt: '2026-07-15T02:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'card-owned', runId: 'run-owned', executionId: 'execution-new' } },
        { id: 'continue-stale', kind: 'continuation', status: 'interrupted', createdAt: '2026-07-15T03:00:00.000Z', payload: { ledgerId: 'specs', cardId: 'card-stale', runId: 'run-older', executionId: 'execution-stale' } },
      ],
    }));

    recoverCodexProcessQueue(root, {});

    const recovered = readCodexProcessQueue(root);
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].id, 'continue-owned-b');
    assert.equal(recovered[0].status, 'pending');
    assert.equal(recovered[0].payload.runId, 'run-owned');
    assert.equal(recovered[0].payload.restartRecovery, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('uses server-wide capacity, running count, and queue position callbacks', () => {
  const runtime = {
    decisionOsSettings: { maxConcurrentCodexProcesses: 2 },
    codexSkillRuns: { local: { status: 'running' } },
    globalCodexProcessCapacity: () => 5,
    globalCodexRunningProcessCount: () => 4,
    globalCodexQueuePosition: (id: string) => id === 'queued' ? 3 : 1,
  };
  assert.equal(maxConcurrentCodexProcesses(runtime), 5);
  assert.equal(runningCodexProcessCount(runtime), 4);
  assert.equal(unifiedCodexQueuePosition({ decisionOsRoot: '/unused', id: 'queued', createdAt: '', runtime }), 3);
});

test('deduplicates two pending continuations for one card session', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-continuation-dedupe-'));
  try {
    const first = enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'continuation-first',
      createdAt: '2026-07-15T07:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-first' },
    });
    const second = enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'continuation-second',
      createdAt: '2026-07-15T07:00:01.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-second' },
    });
    assert.equal(second.id, first.id);
    assert.equal(second.payload.executionId, 'execution-first');
    assert.equal(readCodexProcessQueue(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('recovers a claimed continuation without changing its durable run identity', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-continuation-recovery-'));
  try {
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
    writeFileSync(resolve(root, 'specs.json'), JSON.stringify({ cards: [{ id: 'card-a', codexActiveRunId: 'run-a', codexActiveExecutionId: 'execution-a' }] }));
    enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'continuation-a',
      createdAt: '2026-07-15T07:00:00.000Z',
      payload: { ledgerId: 'specs', cardId: 'card-a', runId: 'run-a', executionId: 'execution-a', newSession: false },
    });
    assert.equal(markCodexProcessQueueItemRunning(root, 'continuation-a')?.status, 'running');
    recoverCodexProcessQueue(root);
    const [recovered] = readCodexProcessQueue(root);
    assert.equal(recovered.status, 'pending');
    assert.equal(recovered.kind, 'continuation');
    assert.equal(recovered.payload.runId, 'run-a');
    assert.equal(recovered.payload.restartRecovery, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
