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
    assert.match(markdown, /^#master-task #task-complete$/m);
    assert.match(markdown, /^Completed at: \d{4}-\d{2}-\d{2}T/m);
    assert.equal(markdown.match(/— Status: complete/g)?.length, 2);
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
