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
  assert.deepEqual(dryRun, { ok: true, value: {
    cards: 2, zones: 1, relationships: 1, cardFiles: 2, threadFiles: 1, queueItems: 1, pipelineRuns: 1,
    sourceLedger: join(root, 'specs.json'), targetLedger: join(root, 'tasks.json'), write: false,
  } });
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
