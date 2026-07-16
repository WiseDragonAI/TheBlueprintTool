import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';

test('completes every linked subtask and the master-task lifecycle', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const ledger = {
    cards: [
      {
        id: 'master-a',
        status: 'todo',
        comment: {
          what: '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-07-12T00:00:00.000Z\nActive since: 2026-07-12T00:01:00.000Z\n\n## B. Subtasks\n\n1. [Research](card:subtask-a) — Status: active\n2. [Build](card:subtask-b) — Status: waiting',
        },
      },
      { id: 'subtask-a', status: 'todo' },
      { id: 'subtask-b', status: 'todo' },
    ],
    relationships: [
      { id: 'rel-a', from: 'master-a', to: 'subtask-a', label: 'subtask' },
      { id: 'rel-b', from: 'master-a', to: 'subtask-b', label: 'subtask' },
    ],
  };

  try {
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath,
      ledger,
      mutation: { action: 'complete-master-task', masterTaskId: 'master-a' },
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(ledger.cards.map((card) => card.status), ['done', 'done', 'done']);
    const markdown = readFileSync(join(decisionOsRoot, 'cards', 'specs', 'master-a.md'), 'utf8');
    assert.doesNotMatch(markdown, /#master-task|#task-complete|— Status:/);
    assert.match(markdown, /^Completed at: \d{4}-\d{2}-\d{2}T/m);
    assert.deepEqual(ledger.cards.map((card) => (card as { labels?: string[] }).labels), [['master-task'], ['subtask'], ['subtask']]);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects completion when a canonical subtask link is unresolved', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    const ledger = {
      cards: [
        { id: 'master-a', status: 'todo', comment: { what: '#master-task #task-active\n\n## B. Subtasks\n\n1. [Missing](card:missing-a) — Status: waiting' } },
      ],
      relationships: [{ id: 'rel-a', from: 'master-a', to: 'missing-a', label: 'subtask' }],
    };
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath: join(decisionOsRoot, 'specs.json'),
      ledger,
      mutation: { action: 'complete-master-task', masterTaskId: 'master-a' },
    });
    assert.equal(result.error?.statusCode, 400);
    assert.equal(ledger.cards[0]?.status, 'todo');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('completes a direct-treatment master task with no linked subtask cards', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const ledger = {
    cards: [{
      id: 'master-direct',
      status: 'todo',
      comment: {
        what: '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-07-12T00:00:00.000Z\nActive since: 2026-07-12T00:01:00.000Z\n\n## D. Subtasks\n\n1. **Direct treatment:** Implemented as one focused change.',
      },
    }],
  };

  try {
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath,
      ledger,
      mutation: { action: 'complete-master-task', masterTaskId: 'master-direct' },
    });
    assert.equal(result.error, undefined);
    assert.equal(ledger.cards[0]?.status, 'done');
    const markdown = readFileSync(join(decisionOsRoot, 'cards', 'specs', 'master-direct.md'), 'utf8');
    assert.doesNotMatch(markdown, /#master-task|#task-complete/);
    assert.match(markdown, /^Completed at: \d{4}-\d{2}-\d{2}T/m);
    assert.match(markdown, /\*\*Direct treatment:\*\*/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
