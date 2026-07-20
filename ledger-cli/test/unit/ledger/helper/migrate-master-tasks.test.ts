import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateMasterTasks } from '../../../../src/business/ledger/helper/migrate-master-tasks.js';

test('moves a complete master-task zone and preserves unrelated source content', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-migration-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(join(root, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(root, 'threads', 'specs'), { recursive: true });
  const master = {
    id: 'card-master', title: 'Master', labels: ['master-task'], domainId: 'specs', x: 10, y: 10, w: 100, h: 100,
    comment: { contentFile: '.decision-os/cards/specs/card-master.md' },
  };
  const subtask = {
    id: 'card-subtask', title: 'Subtask', labels: ['subtask'], domainId: 'specs', x: 140, y: 10, w: 100, h: 100,
    comment: { contentFile: '.decision-os/cards/specs/card-subtask.md' },
  };
  const unrelated = {
    id: 'card-spec', title: 'Spec', labels: [], domainId: 'specs', x: 2010, y: 10, w: 100, h: 100,
    comment: { contentFile: '.decision-os/cards/specs/card-spec.md' },
  };
  const source = {
    modelName: 'specs', cards: [master, subtask, unrelated],
    annotations: [
      { id: 'zone-task', x: 0, y: 0, width: 1000, height: 800 },
      { id: 'zone-spec', x: 2000, y: 0, width: 1000, height: 800 },
    ],
    relationships: [{ id: 'rel-subtask', from: 'card-master', to: 'card-subtask', label: 'subtask' }],
    notes: {}, deletedNoteIds: {},
    threadFiles: { 'thread-card-master': '.decision-os/threads/specs/thread-card-master.md' },
  };
  const target = { modelName: 'tasks', cards: [], annotations: [], relationships: [], notes: {}, deletedNoteIds: {}, threadFiles: {} };
  writeFileSync(join(root, 'specs.json'), JSON.stringify(source));
  writeFileSync(join(root, 'tasks.json'), JSON.stringify(target));
  writeFileSync(join(root, 'cards', 'specs', 'card-master.md'), 'master');
  writeFileSync(join(root, 'cards', 'specs', 'card-subtask.md'), 'subtask');
  writeFileSync(join(root, 'cards', 'specs', 'card-spec.md'), 'spec');
  writeFileSync(join(root, 'threads', 'specs', 'thread-card-master.md'), '# OPERATOR\n\nnote');
  writeFileSync(join(root, 'codex-process-queue.json'), JSON.stringify({ items: [{ payload: { ledgerId: 'specs', cardId: 'card-master' } }] }));
  writeFileSync(join(root, 'codex-pipelines.json'), JSON.stringify({ runs: [{ ledgerId: 'specs', sourceCardId: 'card-master' }] }));

  const dryRun = migrateMasterTasks({ sourceLedger: join(root, 'specs.json'), targetLedger: join(root, 'tasks.json'), write: false });
  assert.equal(dryRun.ok, true);
  if (!dryRun.ok) return;
  assert.deepEqual({
    cards: dryRun.value.cards,
    zones: dryRun.value.zones,
    relationships: dryRun.value.relationships,
    cardFiles: dryRun.value.cardFiles,
    threadFiles: dryRun.value.threadFiles,
    queueItems: dryRun.value.queueItems,
    pipelineRuns: dryRun.value.pipelineRuns,
  }, { cards: 2, zones: 1, relationships: 1, cardFiles: 2, threadFiles: 1, queueItems: 1, pipelineRuns: 1 });
  assert.deepEqual(dryRun.value.manifest.cardIds, ['card-master', 'card-subtask']);
  assert.deepEqual(dryRun.value.manifest.zoneIds, ['zone-task']);
  assert.deepEqual(dryRun.value.manifest.relationshipIds, ['rel-subtask']);
  assert.equal(JSON.parse(readFileSync(join(root, 'specs.json'), 'utf8')).cards.length, 3);

  const written = migrateMasterTasks({ sourceLedger: join(root, 'specs.json'), targetLedger: join(root, 'tasks.json'), write: true });
  assert.equal(written.ok, true);
  const migratedSource = JSON.parse(readFileSync(join(root, 'specs.json'), 'utf8'));
  const migratedTarget = JSON.parse(readFileSync(join(root, 'tasks.json'), 'utf8'));
  assert.deepEqual(migratedSource.cards.map((card: any) => card.id), ['card-spec']);
  assert.deepEqual(migratedTarget.cards.map((card: any) => card.id), ['card-master', 'card-subtask']);
  assert.ok(migratedTarget.cards.every((card: any) => card.domainId === 'tasks'));
  assert.equal(migratedTarget.cards[0].comment.contentFile, '.decision-os/cards/tasks/card-master.md');
  assert.equal(migratedTarget.threadFiles['thread-card-master'], '.decision-os/threads/tasks/thread-card-master.md');
  assert.equal(existsSync(join(root, 'cards', 'specs', 'card-master.md')), false);
  assert.equal(readFileSync(join(root, 'cards', 'tasks', 'card-master.md'), 'utf8'), 'master');
  assert.equal(readFileSync(join(root, 'threads', 'tasks', 'thread-card-master.md'), 'utf8'), '# OPERATOR\n\nnote');
  assert.equal(JSON.parse(readFileSync(join(root, 'codex-process-queue.json'), 'utf8')).items[0].payload.ledgerId, 'tasks');
  assert.equal(JSON.parse(readFileSync(join(root, 'codex-pipelines.json'), 'utf8')).runs[0].ledgerId, 'tasks');
});

test('moves ledger records and reports source sidecars that were already missing', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-missing-sidecars-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(root, { recursive: true });
  const cardReference = '.decision-os/cards/specs/card-master.md';
  const threadReference = '.decision-os/threads/specs/thread-card-master.md';
  writeFileSync(join(root, 'specs.json'), JSON.stringify({
    cards: [{
      id: 'card-master', title: 'Master', labels: ['master-task'], domainId: 'specs', x: 10, y: 10, w: 100, h: 100,
      comment: { contentFile: cardReference },
    }],
    annotations: [{ id: 'zone-task', x: 0, y: 0, width: 1000, height: 800 }],
    relationships: [], notes: {}, deletedNoteIds: {},
    threadFiles: { 'thread-card-master': threadReference },
  }));
  writeFileSync(join(root, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, deletedNoteIds: {}, threadFiles: {} }));

  const result = migrateMasterTasks({ sourceLedger: join(root, 'specs.json'), targetLedger: join(root, 'tasks.json'), write: true });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.missingCardFiles, [cardReference]);
  assert.deepEqual(result.value.missingThreadFiles, [threadReference]);
  const migratedTarget = JSON.parse(readFileSync(join(root, 'tasks.json'), 'utf8'));
  assert.equal(migratedTarget.cards[0].comment.contentFile, '.decision-os/cards/tasks/card-master.md');
  assert.equal(migratedTarget.threadFiles['thread-card-master'], '.decision-os/threads/tasks/thread-card-master.md');
});

test('moves relationship-owned subtasks that extend beyond the master-task zone', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-overflow-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'specs.json'), JSON.stringify({
    cards: [
      { id: 'card-master', labels: ['master-task'], domainId: 'specs', x: 10, y: 10, w: 100, h: 100 },
      { id: 'card-overflow', labels: ['subtask'], domainId: 'specs', x: 1200, y: 10, w: 100, h: 100 },
    ],
    annotations: [{ id: 'zone-task', x: 0, y: 0, width: 500, height: 500 }],
    relationships: [{ id: 'rel-subtask', from: 'card-master', to: 'card-overflow', label: 'subtask' }],
    notes: {}, deletedNoteIds: {}, threadFiles: {},
  }));
  writeFileSync(join(root, 'tasks.json'), JSON.stringify({
    cards: [], annotations: [], relationships: [], notes: {}, deletedNoteIds: {}, threadFiles: {},
  }));

  const result = migrateMasterTasks({
    sourceLedger: join(root, 'specs.json'),
    targetLedger: join(root, 'tasks.json'),
    write: false,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.cards, 2);
  assert.equal(result.value.zones, 1);
  assert.equal(result.value.relationships, 1);
});

test('moves legacy Markdown-labeled master tasks into the canonical ledger', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-legacy-label-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(join(root, 'cards', 'specs'), { recursive: true });
  const sourceLedger = join(root, 'specs.json');
  const targetLedger = join(root, 'tasks.json');
  writeFileSync(sourceLedger, JSON.stringify({
    cards: [{
      id: 'card-legacy-master', labels: ['legacy'], domainId: 'specs', x: 10, y: 10, w: 100, h: 100,
      comment: { contentFile: '.decision-os/cards/specs/card-legacy-master.md' },
    }],
    annotations: [{ id: 'zone-task', x: 0, y: 0, width: 500, height: 500 }],
    relationships: [], notes: {}, deletedNoteIds: {}, threadFiles: {},
  }));
  writeFileSync(targetLedger, JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, deletedNoteIds: {}, threadFiles: {} }));
  writeFileSync(join(root, 'cards', 'specs', 'card-legacy-master.md'), '#master-task #ready\n\nLegacy task.');

  const result = migrateMasterTasks({ sourceLedger, targetLedger, write: true });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.cards, 1);
  assert.equal(JSON.parse(readFileSync(sourceLedger, 'utf8')).cards.length, 0);
  assert.equal(JSON.parse(readFileSync(targetLedger, 'utf8')).cards[0].id, 'card-legacy-master');
  assert.equal(readFileSync(join(root, 'cards', 'tasks', 'card-legacy-master.md'), 'utf8'), '#master-task #ready\n\nLegacy task.');
});

test('moves sidecars when the ledger filename and stored content domain differ', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-aliased-domain-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(join(root, 'cards', 'a35'), { recursive: true });
  mkdirSync(join(root, 'threads', 'a35'), { recursive: true });
  const sourceLedger = join(root, 'article-35.json');
  const targetLedger = join(root, 'tasks.json');
  writeFileSync(sourceLedger, JSON.stringify({
    cards: [{
      id: 'card-aliased-master', labels: ['master-task'], domainId: 'a35', x: 10, y: 10, w: 100, h: 100,
      comment: { contentFile: '.decision-os/cards/a35/card-aliased-master.md' },
    }],
    annotations: [{ id: 'zone-task', x: 0, y: 0, width: 500, height: 500 }],
    relationships: [], notes: {}, deletedNoteIds: {},
    threadFiles: { 'thread-card-aliased-master': '.decision-os/threads/a35/thread-card-aliased-master.md' },
  }));
  writeFileSync(targetLedger, JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, deletedNoteIds: {}, threadFiles: {} }));
  writeFileSync(join(root, 'cards', 'a35', 'card-aliased-master.md'), 'Aliased card.');
  writeFileSync(join(root, 'threads', 'a35', 'thread-card-aliased-master.md'), 'Aliased thread.');

  const result = migrateMasterTasks({ sourceLedger, targetLedger, write: true });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.cardFiles, 1);
  assert.equal(result.value.threadFiles, 1);
  const migratedTarget = JSON.parse(readFileSync(targetLedger, 'utf8'));
  assert.equal(migratedTarget.cards[0].comment.contentFile, '.decision-os/cards/tasks/card-aliased-master.md');
  assert.equal(migratedTarget.threadFiles['thread-card-aliased-master'], '.decision-os/threads/tasks/thread-card-aliased-master.md');
  assert.equal(readFileSync(join(root, 'cards', 'tasks', 'card-aliased-master.md'), 'utf8'), 'Aliased card.');
  assert.equal(readFileSync(join(root, 'threads', 'tasks', 'thread-card-aliased-master.md'), 'utf8'), 'Aliased thread.');
});

test('rejects a relationship that would cross ledger boundaries', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-cross-edge-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(join(root, 'cards', 'specs'), { recursive: true });
  const cards = [
    { id: 'card-master', labels: ['master-task'], x: 10, y: 10, w: 50, h: 50, comment: { contentFile: '.decision-os/cards/specs/card-master.md' } },
    { id: 'card-spec', labels: [], x: 1010, y: 10, w: 50, h: 50, comment: { contentFile: '.decision-os/cards/specs/card-spec.md' } },
  ];
  writeFileSync(join(root, 'specs.json'), JSON.stringify({ cards, annotations: [
    { id: 'zone-task', x: 0, y: 0, width: 500, height: 500 },
    { id: 'zone-spec', x: 1000, y: 0, width: 500, height: 500 },
  ], relationships: [{ id: 'rel-cross', from: 'card-master', to: 'card-spec', label: 'reference' }] }));
  writeFileSync(join(root, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  writeFileSync(join(root, 'cards', 'specs', 'card-master.md'), 'master');
  writeFileSync(join(root, 'cards', 'specs', 'card-spec.md'), 'spec');

  assert.deepEqual(migrateMasterTasks({ sourceLedger: join(root, 'specs.json'), targetLedger: join(root, 'tasks.json'), write: false }), {
    ok: false, error: 'Migration would break 1 cross-ledger relationships.',
  });
});

test('returns a zero-change result after all master tasks have already moved', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-idempotent-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(root, { recursive: true });
  const sourceLedger = join(root, 'specs.json');
  const targetLedger = join(root, 'tasks.json');
  writeFileSync(sourceLedger, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  writeFileSync(targetLedger, JSON.stringify({ cards: [{ id: 'existing-task' }], annotations: [], relationships: [] }));

  const result = migrateMasterTasks({ sourceLedger, targetLedger, write: true });

  assert.deepEqual(result, { ok: true, value: {
    cards: 0,
    zones: 0,
    relationships: 0,
    cardFiles: 0,
    threadFiles: 0,
    missingCardFiles: [],
    missingThreadFiles: [],
    queueItems: 0,
    pipelineRuns: 0,
    sourceLedger,
    targetLedger,
    write: true,
    manifest: { cardIds: [], zoneIds: [], retainedSourceZoneIds: [], relationshipIds: [], cardFiles: [], threadFiles: [], queueItemIds: [], pipelineRunIds: [] },
  } });
  assert.deepEqual(JSON.parse(readFileSync(targetLedger, 'utf8')).cards, [{ id: 'existing-task' }]);
});

test('never treats a specification sharing task geometry as a task member', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-shared-zone-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(root, { recursive: true });
  const sourceLedger = join(root, 'specs.json');
  const targetLedger = join(root, 'tasks.json');
  writeFileSync(sourceLedger, JSON.stringify({
    cards: [
      { id: 'master', labels: ['master-task'], domainId: 'specs', x: 10, y: 10, w: 100, h: 100 },
      { id: 'subtask', labels: ['subtask'], domainId: 'specs', x: 150, y: 10, w: 100, h: 100 },
      { id: 'specification', labels: ['architecture'], domainId: 'specs', x: 300, y: 10, w: 100, h: 100 },
    ],
    annotations: [{ id: 'shared-zone', x: 0, y: 0, width: 800, height: 600 }],
    relationships: [{ id: 'subtask-edge', from: 'master', to: 'subtask', label: 'subtask' }],
    threadFiles: {},
  }));
  writeFileSync(targetLedger, JSON.stringify({ cards: [], annotations: [], relationships: [], threadFiles: {} }));

  const result = migrateMasterTasks({ sourceLedger, targetLedger, write: true });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.manifest.cardIds, ['master', 'subtask']);
  assert.deepEqual(result.value.manifest.retainedSourceZoneIds, ['shared-zone']);
  assert.deepEqual(JSON.parse(readFileSync(sourceLedger, 'utf8')).cards.map((card: any) => card.id), ['specification']);
  assert.deepEqual(JSON.parse(readFileSync(sourceLedger, 'utf8')).annotations.map((zone: any) => zone.id), ['shared-zone']);
  assert.deepEqual(JSON.parse(readFileSync(targetLedger, 'utf8')).cards.map((card: any) => card.id), ['master', 'subtask']);
});

test('backfills empty canonical sidecars from the retained source-domain content', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-sidecar-backfill-'));
  const root = join(workspace, '.decision-os');
  mkdirSync(join(root, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(root, 'threads', 'specs'), { recursive: true });
  mkdirSync(join(root, 'threads', 'tasks'), { recursive: true });
  const sourceLedger = join(root, 'specs.json');
  const targetLedger = join(root, 'tasks.json');
  writeFileSync(sourceLedger, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  writeFileSync(targetLedger, JSON.stringify({
    cards: [{ id: 'card-master', labels: ['master-task'], comment: { contentFile: '.decision-os/cards/tasks/card-master.md' } }],
    annotations: [], relationships: [],
    threadFiles: { 'thread-card-master': '.decision-os/threads/tasks/thread-card-master.md' },
  }));
  const cardContent = 'Ledger: Tasks\nWaiting since: 2026-07-18T06:00:00.000Z\n\nTask body.\n';
  const threadContent = '# OPERATOR\n<!-- decision-os:note {"id":"note-1","timestamp":"2026-07-18T06:00:00.000Z"} -->\n\nRun it.\n';
  writeFileSync(join(root, 'cards', 'specs', 'card-master.md'), cardContent);
  writeFileSync(join(root, 'cards', 'tasks', 'card-master.md'), '');
  writeFileSync(join(root, 'threads', 'specs', 'thread-card-master.md'), threadContent);
  writeFileSync(join(root, 'threads', 'tasks', 'thread-card-master.md'), '');

  const dryRun = migrateMasterTasks({ sourceLedger, targetLedger, write: false });
  assert.equal(dryRun.ok, true);
  if (!dryRun.ok) return;
  assert.equal(dryRun.value.cardFiles, 1);
  assert.equal(dryRun.value.threadFiles, 1);
  assert.equal(readFileSync(join(root, 'cards', 'tasks', 'card-master.md'), 'utf8'), '');

  const result = migrateMasterTasks({ sourceLedger, targetLedger, write: true });
  assert.equal(result.ok, true);
  assert.equal(readFileSync(join(root, 'cards', 'tasks', 'card-master.md'), 'utf8'), cardContent);
  assert.equal(readFileSync(join(root, 'threads', 'tasks', 'thread-card-master.md'), 'utf8'), threadContent);
  assert.equal(readFileSync(join(root, 'cards', 'specs', 'card-master.md'), 'utf8'), cardContent);
  assert.equal(readFileSync(join(root, 'threads', 'specs', 'thread-card-master.md'), 'utf8'), threadContent);
});
