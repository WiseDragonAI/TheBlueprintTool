import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';

test('completes a linked subtask and synchronizes the master-task Markdown', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-subtask-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const ledger = {
    cards: [
      {
        id: 'master-a',
        comment: {
          what: '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-07-12T00:00:00.000Z\nActive since: 2026-07-12T00:01:00.000Z\n\n## B. Subtasks\n\n1. [Build](card:subtask-a) — Status: active',
        },
      },
      { id: 'subtask-a', status: 'todo' },
    ],
  };

  try {
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath,
      ledger,
      mutation: { action: 'complete-master-subtask', masterTaskId: 'master-a', subtaskCardId: 'subtask-a' },
    });
    assert.equal(result.error, undefined);
    assert.equal(ledger.cards[1]?.status, 'done');
    assert.match(readFileSync(join(decisionOsRoot, 'cards', 'specs', 'master-a.md'), 'utf8'), /\[Build\]\(card:subtask-a\) — Status: complete/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects completion when the subtask is not linked from the master task', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-subtask-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    const ledger = {
      cards: [
        { id: 'master-a', comment: { what: '#master-task #task-active\n\n## B. Subtasks' } },
        { id: 'subtask-a', status: 'todo' },
      ],
    };
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath: join(decisionOsRoot, 'specs.json'),
      ledger,
      mutation: { action: 'complete-master-subtask', masterTaskId: 'master-a', subtaskCardId: 'subtask-a' },
    });
    assert.equal(result.error?.statusCode, 400);
    assert.equal(ledger.cards[1]?.status, 'todo');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
