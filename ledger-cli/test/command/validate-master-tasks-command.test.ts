import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchLedgerCliCommandController, parseLedgerCliArgv } from '../../src/index.js';
import { createJsonFile } from '../fixture/scenario.js';

test('validates canonical task labels and relationship endpoints while ignoring stale Markdown tokens', async () => {
  assert.equal(parseLedgerCliArgv(['validate-master-tasks', '--ledger', 'tasks.json']).mode, 'validate-master-tasks');
  const validFile = await createJsonFile({
    cards: [{ id: 'valid', status: 'todo', labels: ['master-task'], comment: { what: '#master-task #task-waiting #task-active' } }],
    relationships: [],
  });
  const invalidFile = await createJsonFile({
    cards: [{ id: 'stale', status: 'todo', labels: ['master-task'] }, { id: 'child', status: 'todo' }],
    relationships: [{ id: 'rel-a', from: 'stale', to: 'child', label: 'subtask' }],
  });

  const valid = await dispatchLedgerCliCommandController(['validate-master-tasks', '--ledger', validFile]);
  const invalid = await dispatchLedgerCliCommandController(['validate-master-tasks', '--ledger', invalidFile]);
  assert.deepEqual(valid, { ok: true, value: 'Validated 1 master task.' });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.error, /stale: invalid_subtask_label:child/);
});

test('scopes master-task validation to one card', async () => {
  const ledgerFile = await createJsonFile({
    cards: [
      { id: 'valid', status: 'done', labels: ['master-task'] },
      { id: 'invalid', status: 'invalid', labels: ['master-task'] },
    ],
  });

  const result = await dispatchLedgerCliCommandController(['validate-master-tasks', '--ledger', ledgerFile, '--card-id', 'valid']);
  assert.deepEqual(result, { ok: true, value: 'Validated 1 master task.' });
});
