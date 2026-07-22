import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { codexExecutionStoreFile, createCodexExecutionStore } from '@backend/business/codex/helper/codex-execution-store.js';

function record(executionId: string, requestedAt: string) {
  return {
    executionId,
    sessionId: `session-${executionId}`,
    projectId: 'project-a',
    ledgerId: 'tasks',
    taskId: `task-${executionId}`,
    ownerCardId: `card-${executionId}`,
    kind: 'thread' as const,
    requestedAt,
  };
}

test('atomically persists canonical attempts and returns deterministic FIFO work', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-store-'));
  try {
    const store = createCodexExecutionStore({ decisionOsRoot: root, projectId: 'project-a' });
    store.create(record('execution-b', '2026-07-23T01:00:01.000Z'));
    store.create(record('execution-a', '2026-07-23T01:00:00.000Z'));
    store.transition({ expectedExecutionId: 'execution-b', phase: 'queued' });
    store.transition({ expectedExecutionId: 'execution-a', phase: 'queued' });
    assert.equal(store.nextQueued()?.executionId, 'execution-a');
    assert.deepEqual(store.active().map((item) => item.executionId), ['execution-b', 'execution-a']);
    assert.equal(JSON.parse(readFileSync(codexExecutionStoreFile(root), 'utf8')).version, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('preserves corrupt bytes and rejects replacement', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-corrupt-execution-store-'));
  const file = codexExecutionStoreFile(root);
  try {
    writeFileSync(file, '{not-json');
    const store = createCodexExecutionStore({ decisionOsRoot: root, projectId: 'project-a' });
    assert.throws(() => store.create(record('execution-a', '2026-07-23T01:00:00.000Z')), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'codex_execution_store_corrupt');
      return true;
    });
    assert.equal(readFileSync(file, 'utf8'), '{not-json');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fences stale transitions by exact execution identity', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-fenced-execution-store-'));
  try {
    const store = createCodexExecutionStore({ decisionOsRoot: root, projectId: 'project-a' });
    store.create(record('execution-a', '2026-07-23T01:00:00.000Z'));
    assert.throws(() => store.transition({ expectedExecutionId: 'execution-b', phase: 'queued' }), /not_found/);
    assert.equal(store.find('execution-a')?.phase, 'preparing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses to delete active session attempts and deletes terminal history atomically', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delete-execution-session-'));
  try {
    const store = createCodexExecutionStore({ decisionOsRoot: root, projectId: 'project-a' });
    store.create(record('execution-a', '2026-07-23T01:00:00.000Z'));
    assert.throws(() => store.deleteSession('session-execution-a'), /session_active/);
    store.transition({ expectedExecutionId: 'execution-a', phase: 'queued' });
    store.transition({ expectedExecutionId: 'execution-a', phase: 'cancelled', result: { status: 'cancelled', summary: 'cancelled' } });
    assert.equal(store.deleteSession('session-execution-a').length, 1);
    assert.equal(store.find('execution-a'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
