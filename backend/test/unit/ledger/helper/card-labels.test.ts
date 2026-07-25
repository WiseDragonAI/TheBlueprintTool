import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';

test('patch-card persists labels while retaining canonical task labels from the graph', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-labels-'));
  try {
    const ledger = {
      cards: [
        { id: 'master', labels: ['master-task', 'old'] },
        { id: 'subtask', labels: ['subtask', 'old'] },
      ],
      relationships: [{ id: 'rel-a', from: 'master', to: 'subtask', label: 'subtask', position: 0 }],
    };
    const masterResult = applyLedgerMutation({
      decisionOsRoot: join(workspace, '.decision-os'),
      ledgerPath: join(workspace, '.decision-os', 'tasks.json'),
      ledger,
      mutation: { action: 'patch-card', cardPatch: { id: 'master', labels: ['analysis', 'subtask'] } },
    });
    const subtaskResult = applyLedgerMutation({
      decisionOsRoot: join(workspace, '.decision-os'),
      ledgerPath: join(workspace, '.decision-os', 'tasks.json'),
      ledger,
      mutation: { action: 'patch-card', cardPatch: { id: 'subtask', labels: ['verified', 'master-task'] } },
    });

    assert.equal(masterResult.error, undefined);
    assert.equal(subtaskResult.error, undefined);
    assert.deepEqual(ledger.cards[0].labels, ['analysis', 'master-task']);
    assert.deepEqual(ledger.cards[1].labels, ['verified', 'subtask']);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('patch-card rejects empty labels without mutating the card', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-labels-'));
  try {
    const ledger = { cards: [{ id: 'card-a', labels: ['existing'] }] };
    const result = applyLedgerMutation({
      decisionOsRoot: join(workspace, '.decision-os'),
      ledgerPath: join(workspace, '.decision-os', 'tasks.json'),
      ledger,
      mutation: { action: 'patch-card', cardPatch: { id: 'card-a', labels: [''] } },
    });

    assert.equal(result.error?.statusCode, 400);
    assert.deepEqual(ledger.cards[0].labels, ['existing']);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
