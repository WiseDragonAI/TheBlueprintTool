/**
 * WHAT: Spec a598989d test for committed architecture ledger JSON storage.
 * WHY: ledger commands must read and write durable JSON files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJsonFile } from '../fixture/scenario.js';
import { manageLedgerJsonController } from '../../src/index.js';

test('CLI architecture ledger JSON storage reads and writes committed ledger files', async () => {
  const file = await createJsonFile({ cards: [] });
  const result = await manageLedgerJsonController({ ledgerCommand: 'mutate', ledgerJsonFile: file, mutation: { cards: [{ id: 'a' }] } });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { cards: [{ id: 'a' }] });
});
