/**
 * WHAT: Unit coverage for parse-ledger-cli-argv.
 * WHY: the separated ledger CLI owns ledger command argument parsing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLedgerCliArgv } from '../../../../src/business/command/helper/parse-ledger-cli-argv.js';

test('parse-ledger-cli-argv parses targeted ledger mutations', () => {
  const command = parseLedgerCliArgv([
    'mutate',
    '--ledger',
    '.blueprinttool/specs.json',
    '--card-id',
    'note_spawnable_vs_inventory_item',
    '--card-comment-file',
    'tmp/comment.md',
    '--card-title',
    'TABLE: character',
    '--card-labels',
    'visual,validated',
    '--add-card-file',
    'tmp/card.json',
    '--remove-card',
    'card-old',
    '--remove-relationship',
    'rel-a',
    '--remove-relationship',
    'rel-b',
    '--add-relationship',
    'rel-c:from-card:to-card:label text',
  ]);

  assert.equal(command.mode, 'mutate');
  assert.equal(command.ledgerJsonFile, '.blueprinttool/specs.json');
  assert.equal(command.mutationOperation.cardId, 'note_spawnable_vs_inventory_item');
  assert.equal(command.mutationOperation.cardCommentFile, 'tmp/comment.md');
  assert.equal(command.mutationOperation.cardTitle, 'TABLE: character');
  assert.deepEqual(command.mutationOperation.cardLabels, ['visual', 'validated']);
  assert.equal(command.mutationOperation.addCardFile, 'tmp/card.json');
  assert.deepEqual(command.mutationOperation.removeCardIds, ['card-old']);
  assert.deepEqual(command.mutationOperation.removeRelationshipIds, ['rel-a', 'rel-b']);
  assert.deepEqual(command.mutationOperation.addRelationships, [{ id: 'rel-c', from: 'from-card', to: 'to-card', label: 'label text' }]);
});

test('parse-ledger-cli-argv parses ledger overview command', () => {
  const command = parseLedgerCliArgv([
    'overview',
    '--ledger',
    '.blueprinttool/data.json',
  ]);

  assert.equal(command.mode, 'overview');
  assert.equal(command.ledgerJsonFile, '.blueprinttool/data.json');
});
