import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchLedgerCliCommandController, parseLedgerCliArgv } from '../../src/index.js';
import { createJsonFile } from '../fixture/scenario.js';

test('validates canonical master tasks and rejects stale lifecycle metadata', async () => {
  assert.equal(parseLedgerCliArgv(['validate-master-tasks', '--ledger', 'tasks.json']).mode, 'validate-master-tasks');
  const validFile = await createJsonFile({
    cards: [{ id: 'valid', comment: { what: '#master-task #task-waiting\n\nLedger: Tasks\nWaiting since: 2026-07-12T00:00:00.000Z' } }],
  });
  const invalidFile = await createJsonFile({
    cards: [{ id: 'stale', comment: { what: '#master-task #task-waiting #task-active\n\nLedger: Tasks' } }],
  });

  const valid = await dispatchLedgerCliCommandController(['validate-master-tasks', '--ledger', validFile]);
  const invalid = await dispatchLedgerCliCommandController(['validate-master-tasks', '--ledger', invalidFile]);
  assert.deepEqual(valid, { ok: true, value: 'Validated 1 master task.' });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.error, /stale: expected exactly one task status label, invalid Waiting since/);
});
