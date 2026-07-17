import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createControlRoomProjectionStore } from '@backend/business/server/helper/control-room-projection-store.js';
import type { DecisionOsProject } from '@backend/business/server/helper/project-catalog.js';

test('direct executing master task uses the live run start for its stopwatch', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-stopwatch-'));
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), '## A. Work\n\n1. Running.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], codexActiveRunId: 'run-a',
      comment: { contentFile: '.decision-os/cards/tasks/master.md' },
    }],
    annotations: [], relationships: [], threadFiles: {},
  }));
  const project: DecisionOsProject = {
    id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
    description: '', color: '#123456', available: true, diagnostic: '',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room.json'),
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', startedAt: '2026-07-14T10:02:00.000Z' } } }),
  });

  try {
    const projection = store.get([project]) as Record<string, any>;
    assert.equal(projection.exec.length, 1);
    assert.equal(projection.exec[0].executionSince, '2026-07-14T10:02:00.000Z');
    assert.equal(projection.exec[0].executionTime, Date.parse('2026-07-14T10:02:00.000Z'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('direct executing master task uses the latest persisted Codex turn after server continuation', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-session-stopwatch-'));
  const decisionOsRoot = join(root, '.decision-os');
  const stderrFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.log');
  const stdoutFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.jsonl');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'runs', 'codex-skills', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), 'Active since: 2026-07-14T10:02:00.000Z\n\n## A. Work\n\n1. Running.\n');
  writeFileSync(stderrFile, [
    'decision-os:codex-run-segment {"runId":"run-a","startedAt":"2026-07-14T10:02:00.000Z","segment":"start","startLine":0}',
    'decision-os:codex-run-segment {"runId":"run-a","startedAt":"2026-07-14T10:12:00.000Z","segment":"continue","startLine":1}',
    'decision-os:codex-turn-start {"runId":"run-a","startedAt":"2026-07-14T10:12:03.000Z","line":2}',
    '',
  ].join('\n'));
  writeFileSync(stdoutFile, [JSON.stringify({ type: 'turn.completed' }), JSON.stringify({ type: 'turn.started' }), ''].join('\n'));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], codexActiveRunId: 'run-a',
      comment: { contentFile: '.decision-os/cards/tasks/master.md' },
    }],
    annotations: [], relationships: [], threadFiles: {},
  }));
  const project: DecisionOsProject = {
    id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
    description: '', color: '#123456', available: true, diagnostic: '',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room.json'),
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', startedAt: '2026-07-14T10:12:00.000Z', stderrFile, stdoutFile } } }),
  });

  try {
    const projection = store.get([project]) as Record<string, any>;
    assert.equal(projection.exec.length, 1);
    assert.equal(projection.exec[0].executionSince, '2026-07-14T10:12:03.000Z');
    assert.equal(projection.exec[0].executionTime, Date.parse('2026-07-14T10:12:03.000Z'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('direct executing master task waits for Codex turn.started before starting its stopwatch', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-pending-turn-'));
  const decisionOsRoot = join(root, '.decision-os');
  const stderrFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.log');
  const stdoutFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.jsonl');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'runs', 'codex-skills', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), 'Active since: 2026-07-14T10:02:00.000Z\n\n## A. Work\n\n1. Running.\n');
  writeFileSync(stderrFile, 'decision-os:codex-run-segment {"runId":"run-a","startedAt":"2026-07-14T10:12:00.000Z","segment":"continue","startLine":1}\n');
  writeFileSync(stdoutFile, `${JSON.stringify({ type: 'turn.completed' })}\n`);
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], codexActiveRunId: 'run-a', comment: { contentFile: '.decision-os/cards/tasks/master.md' } }],
    annotations: [], relationships: [], threadFiles: {},
  }));
  const project: DecisionOsProject = {
    id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
    description: '', color: '#123456', available: true, diagnostic: '',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room.json'),
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', startedAt: '2026-07-14T10:12:00.000Z', stderrFile, stdoutFile } } }),
  });

  try {
    const projection = store.get([project]) as Record<string, any>;
    assert.equal(projection.exec[0].executionSince, '');
    assert.equal(Number.isNaN(projection.exec[0].executionTime), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rebuilds a cached Exec projection when the process queue file appears', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-pending-cache-'));
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), '## A. Work\n\n1. Pending execution.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'],
      codexActiveRunId: 'run-pending', executionStatus: 'pending',
      comment: { contentFile: '.decision-os/cards/tasks/master.md' },
    }],
    annotations: [], relationships: [], threadFiles: {},
  }));
  const project: DecisionOsProject = {
    id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
    description: '', color: '#123456', available: true, diagnostic: '',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  };
  const store = createControlRoomProjectionStore({
    cacheFile: join(decisionOsRoot, 'cache', 'control-room.json'),
    runtimeForRoot: () => ({}),
  });

  try {
    const before = store.get([project]) as Record<string, any>;
    assert.equal(before.exec[0].executionStatus, 'pending');
    assert.equal(before.exec[0].codexQueuePosition, null);

    writeFileSync(join(decisionOsRoot, 'codex-process-queue.json'), JSON.stringify({
      version: 1,
      items: [{
        id: 'run-pending', kind: 'thread', status: 'pending', createdAt: '2026-07-14T10:02:00.000Z',
        startedAt: null, interruptedAt: null, interruptionReason: '', processId: 0,
        processStartTime: '', stdoutFile: '', stderrFile: '', payload: { cardId: 'master' },
      }],
    }));
    assert.equal(store.reconcile([project]), true);
    await new Promise((resolveWait) => setImmediate(resolveWait));
    const after = store.get([project]) as Record<string, any>;
    assert.equal(after.exec[0].codexQueuePosition, 1);
    assert.ok(after.revision > before.revision);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
