/**
 * WHAT: Unit coverage for generated function parse-cli-argv.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgv } from '../../../../src/business/command/helper/parse-cli-argv.js';

test('parse-cli-argv exports an implemented function', () => {
  assert.equal(typeof parseCliArgv, 'function');
});

test('parse-cli-argv parses targeted ledger mutations', () => {
  const command = parseCliArgv([
    'ledger',
    'mutate',
    '--ledger',
    '.blueprinttool/ardaria-data-model.json',
    '--card-id',
    'note_spawnable_vs_inventory_item',
    '--card-comment-file',
    'tmp/comment.md',
    '--add-card-file',
    'tmp/card.json',
    '--remove-relationship',
    'rel-a',
    '--remove-relationship',
    'rel-b',
    '--add-relationship',
    'rel-c:from-card:to-card:label text',
  ]);

  assert.equal(command.mode, 'ledger');
  assert.equal(command.ledgerCommand, 'mutate');
  assert.equal(command.ledgerJsonFile, '.blueprinttool/ardaria-data-model.json');
  assert.equal(command.mutationOperation.cardId, 'note_spawnable_vs_inventory_item');
  assert.equal(command.mutationOperation.cardCommentFile, 'tmp/comment.md');
  assert.equal(command.mutationOperation.addCardFile, 'tmp/card.json');
  assert.deepEqual(command.mutationOperation.removeRelationshipIds, ['rel-a', 'rel-b']);
  assert.deepEqual(command.mutationOperation.addRelationships, [{ id: 'rel-c', from: 'from-card', to: 'to-card', label: 'label text' }]);
});
