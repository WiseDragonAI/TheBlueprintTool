import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dispatchLedgerCliCommandController, parseLedgerCliArgv } from '../../src/index.js';
import { createJsonFile } from '../fixture/scenario.js';

test('ledger-cli parses and persists todo and done card status commands', async () => {
  const parsed = parseLedgerCliArgv(['done', '--ledger', '.blueprinttool/specs.json', '--card-id', 'card-a']);
  assert.equal(parsed.mode, 'done');
  assert.deepEqual(parsed.statusOperation, { cardId: 'card-a', status: 'done' });

  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Card A' }],
  });

  const done = await dispatchLedgerCliCommandController(['done', '--ledger', ledgerFile, '--card-id', 'card-a']);
  const todo = await dispatchLedgerCliCommandController(['todo', '--ledger', ledgerFile, '--card-id', 'card-a']);

  assert.equal(done.ok, true);
  assert.equal(todo.ok, true);
  assert.equal(JSON.parse(await readFile(ledgerFile, 'utf8')).cards[0].status, 'todo');
});
