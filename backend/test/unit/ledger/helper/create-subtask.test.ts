import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation } from '../../../../src/business/ledger/helper/apply-ledger-mutation.js';

const master = { id: 'card-master', title: 'Master', labels: ['master-task'], comment: { what: '' } };
const card = { id: 'card-new', title: 'New subtask', labels: ['subtask'], comment: { what: '', contentFile: '.decision-os/cards/tasks/card-new.md' } };
const relationship = { id: 'rel-new', from: 'card-master', to: 'card-new', label: 'subtask', position: 0 };

test('create-subtask atomically materializes one card, thread owner, and canonical relationship', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-create-subtask-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  try {
    const ledger = { cards: [structuredClone(master)], annotations: [], relationships: [], threadFiles: {} };
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath: join(decisionOsRoot, 'tasks.json'),
      ledger,
      mutation: { action: 'create-subtask', masterTaskId: 'card-master', card: structuredClone(card), relationship: structuredClone(relationship) },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(ledger.cards.map((entry) => entry.id), ['card-master', 'card-new']);
    assert.deepEqual(ledger.relationships, [relationship]);
    assert.deepEqual(result.changedContentFiles.sort(), [
      '.decision-os/cards/tasks/card-new.md',
      '.decision-os/threads/tasks/thread-card-new.md',
    ]);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('create-subtask rejects a graph edge that does not target the new card', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-reject-subtask-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  try {
    const ledger = { cards: [structuredClone(master)], annotations: [], relationships: [], threadFiles: {} };
    const result = applyLedgerMutation({
      decisionOsRoot,
      ledgerPath: join(decisionOsRoot, 'tasks.json'),
      ledger,
      mutation: { action: 'create-subtask', masterTaskId: 'card-master', card: structuredClone(card), relationship: { ...relationship, to: 'card-other' } },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.error?.body, { ok: false, error: 'invalid_subtask_creation_payload' });
    assert.deepEqual(ledger.cards.map((entry) => entry.id), ['card-master']);
    assert.deepEqual(ledger.relationships, []);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
