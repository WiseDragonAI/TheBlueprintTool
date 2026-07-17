import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createControlRoomProjectionStore } from '@backend/business/server/helper/control-room-projection-store.js';
import type { DecisionOsProject } from '@backend/business/server/helper/project-catalog.js';

test('direct active master task uses the live run start for its stopwatch', () => {
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
    assert.equal(projection.active.length, 1);
    assert.equal(projection.active[0].activeSince, '2026-07-14T10:02:00.000Z');
    assert.equal(projection.active[0].activeTime, Date.parse('2026-07-14T10:02:00.000Z'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('direct active master task keeps the persisted Codex session start after server continuation', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-control-room-session-stopwatch-'));
  const decisionOsRoot = join(root, '.decision-os');
  const stderrFile = join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'run-a.log');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'runs', 'codex-skills', 'tasks'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'master.md'), 'Active since: 2026-07-14T10:12:00.000Z\n\n## A. Work\n\n1. Running.\n');
  writeFileSync(stderrFile, [
    'decision-os:codex-run-segment {"runId":"run-a","startedAt":"2026-07-14T10:02:00.000Z","segment":"start","startLine":0}',
    'decision-os:codex-run-segment {"runId":"run-a","startedAt":"2026-07-14T10:12:00.000Z","segment":"continue","startLine":12}',
    '',
  ].join('\n'));
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
    runtimeForRoot: () => ({ codexSkillRuns: { 'run-a': { status: 'running', startedAt: '2026-07-14T10:12:00.000Z', stderrFile } } }),
  });

  try {
    const projection = store.get([project]) as Record<string, any>;
    assert.equal(projection.active.length, 1);
    assert.equal(projection.active[0].activeSince, '2026-07-14T10:02:00.000Z');
    assert.equal(projection.active[0].activeTime, Date.parse('2026-07-14T10:02:00.000Z'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
