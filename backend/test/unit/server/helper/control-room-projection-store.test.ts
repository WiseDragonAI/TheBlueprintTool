import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], codexActiveRunId: 'run-a', codexActiveExecutionId: 'execution-a',
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
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', executionId: 'execution-a', startedAt: '2026-07-14T10:02:00.000Z', child: { pid: process.pid, exitCode: null, killed: false } } } }),
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
    'decision-os:codex-run-segment {"runId":"run-a","executionId":"execution-old","startedAt":"2026-07-14T10:02:00.000Z","segment":"start","startLine":0}',
    'decision-os:codex-run-segment {"runId":"run-a","executionId":"execution-a","startedAt":"2026-07-14T10:12:00.000Z","segment":"continue","startLine":1}',
    'decision-os:codex-turn-start {"runId":"run-a","executionId":"execution-a","startedAt":"2026-07-14T10:12:03.000Z","line":2}',
    '',
  ].join('\n'));
  writeFileSync(stdoutFile, [JSON.stringify({ type: 'turn.completed' }), JSON.stringify({ type: 'turn.started' }), ''].join('\n'));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], codexActiveRunId: 'run-a', codexActiveExecutionId: 'execution-a',
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
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', executionId: 'execution-a', startedAt: '2026-07-14T10:12:00.000Z', stderrFile, stdoutFile, child: { pid: process.pid, exitCode: null, killed: false } } } }),
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

test('continuation stopwatch waits for its active execution and changes the projection fingerprint when the turn starts', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-pending-turn-'));
  const decisionOsRoot = join(root, '.decision-os');
  const stderrFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.log');
  const stdoutFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.jsonl');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'runs', 'codex-skills', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), 'Active since: 2026-07-14T10:02:00.000Z\n\n## A. Work\n\n1. Running.\n');
  writeFileSync(stderrFile, [
    'decision-os:codex-run-segment {"runId":"run-a","executionId":"execution-old","startedAt":"2026-07-14T10:02:00.000Z","segment":"start","startLine":0}',
    'decision-os:codex-turn-start {"runId":"run-a","executionId":"execution-old","startedAt":"2026-07-14T10:02:03.000Z","line":1}',
    'decision-os:codex-run-segment {"runId":"run-a","executionId":"execution-new","startedAt":"2026-07-14T10:12:00.000Z","segment":"continue","startLine":1}',
    '',
  ].join('\n'));
  writeFileSync(stdoutFile, `${JSON.stringify({ type: 'turn.completed' })}\n`);
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], codexActiveRunId: 'run-a',
      codexActiveExecutionId: 'execution-new',
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
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', executionId: 'execution-new', startedAt: '2026-07-14T10:12:00.000Z', stderrFile, stdoutFile, child: { pid: process.pid, exitCode: null, killed: false } } } }),
  });

  try {
    const before = store.get([project]) as Record<string, any>;
    assert.equal(before.exec[0].executionSince, '2026-07-14T10:12:00.000Z');
    assert.equal(before.exec[0].executionTime, Date.parse('2026-07-14T10:12:00.000Z'));

    appendFileSync(stderrFile, 'decision-os:codex-turn-start {"runId":"run-a","executionId":"execution-new","startedAt":"2026-07-14T10:12:03.000Z","line":2}\n');
    store.invalidate(project.id);
    await new Promise((resolveWait) => setImmediate(resolveWait));
    const after = store.get([project]) as Record<string, any>;
    assert.equal(after.exec[0].executionSince, '2026-07-14T10:12:03.000Z');
    assert.equal(after.exec[0].executionTime, Date.parse('2026-07-14T10:12:03.000Z'));
    assert.notEqual(after.fingerprint, before.fingerprint);
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
      codexActiveRunId: 'run-pending', codexActiveExecutionId: 'execution-pending',
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
    assert.equal(before.exec.length, 0);
    assert.equal(before.queue.length, 1);

    writeFileSync(join(decisionOsRoot, 'codex-process-queue.json'), JSON.stringify({
      version: 1,
      items: [{
        id: 'run-pending', kind: 'thread', status: 'pending', createdAt: '2026-07-14T10:02:00.000Z',
        startedAt: null, interruptedAt: null, interruptionReason: '', processId: 0,
        processStartTime: '', stdoutFile: '', stderrFile: '', payload: { ledgerId: 'tasks', cardId: 'master', runId: 'run-pending', executionId: 'execution-pending' },
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

test('orders one multi-project Queue only by newest waiting time', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-queue-order-'));
  const createProject = (id: string, cards: Array<{ id: string; waitingSince: string; queueRank?: number }>): DecisionOsProject => {
    const projectRoot = join(root, id);
    const decisionOsRoot = join(projectRoot, '.decision-os');
    mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
    for (const card of cards) {
      writeFileSync(join(decisionOsRoot, 'cards', 'tasks', `${card.id}.md`), [
        `Waiting since: ${card.waitingSince}`,
        ...(card.queueRank ? [`Queue rank: ${card.queueRank}`] : []),
        '',
        '## A. Work',
        '',
        '1. Waiting.',
        '',
      ].join('\n'));
    }
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
      cards: cards.map((card) => ({
        id: card.id, title: card.id, status: 'todo', labels: ['master-task'],
        comment: { contentFile: `.decision-os/cards/tasks/${card.id}.md` },
      })),
      annotations: [], relationships: [], threadFiles: {},
    }));
    return {
      id, name: id, relativePath: id, root: projectRoot, decisionOsRoot,
      description: '', color: '#123456', available: true, diagnostic: '',
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    };
  };
  const projects = [
    createProject('project-a', [
      { id: 'ranked-oldest', waitingSince: '2026-07-17T10:00:00.000Z', queueRank: 1 },
      { id: 'middle', waitingSince: '2026-07-17T12:00:00.000Z' },
    ]),
    createProject('project-b', [
      { id: 'newest', waitingSince: '2026-07-17T13:00:00.000Z' },
      { id: 'oldest', waitingSince: '2026-07-17T11:00:00.000Z' },
    ]),
  ];
  const store = createControlRoomProjectionStore({
    cacheFile: join(root, 'control-room.json'),
    runtimeForRoot: () => ({}),
  });

  try {
    const projection = store.get(projects) as Record<string, any>;
    assert.deepEqual(projection.queue.map((task: Record<string, unknown>) => task.cardId), [
      'newest',
      'middle',
      'oldest',
      'ranked-oldest',
    ]);
    assert.deepEqual(projection.queue.map((task: Record<string, unknown>) => task.projectId), [
      'project-b',
      'project-a',
      'project-b',
      'project-a',
    ]);
    assert.equal('queueRank' in projection.queue[3], false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('projects voice transcription before launch as active without calling it Codex queued', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-voice-transcribing-'));
  const decisionOsRoot = join(root, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), '## A. Work\n\n1. Voice launch requested.\n');
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'],
      executionStatus: 'transcribing-before-launch',
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
    runtimeForRoot: () => ({
      voiceCodexExecutionObservations: {
        ['tasks\0master']: { kind: 'voice-transcription', startedAt: '2026-07-14T10:02:00.000Z' },
      },
    }),
  });

  try {
    const projection = store.get([project]) as Record<string, any>;
    assert.equal(projection.queue.length, 0);
    assert.equal(projection.exec.length, 1);
    assert.equal(projection.exec[0].executionStatus, 'transcribing-before-launch');
    assert.equal(projection.exec[0].transcribingBeforeLaunch, true);
    assert.equal(projection.exec[0].codexQueued, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
