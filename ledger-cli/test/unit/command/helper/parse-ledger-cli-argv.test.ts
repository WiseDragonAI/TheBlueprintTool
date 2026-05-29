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
    '--card-comment',
    'inline comment',
    '--card-comment-file',
    'tmp/comment.md',
    '--card-title',
    'TABLE: character',
    '--card-x',
    '120',
    '--card-y',
    '-45',
    '--card-w',
    '640',
    '--card-h',
    '320',
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
  assert.equal(command.mutationOperation.cardComment, 'inline comment');
  assert.equal(command.mutationOperation.cardCommentFile, 'tmp/comment.md');
  assert.equal(command.mutationOperation.cardTitle, 'TABLE: character');
  assert.equal(command.mutationOperation.cardX, 120);
  assert.equal(command.mutationOperation.cardY, -45);
  assert.equal(command.mutationOperation.cardW, 640);
  assert.equal(command.mutationOperation.cardH, 320);
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

test('parse-ledger-cli-argv parses ledger export command', () => {
  const command = parseLedgerCliArgv([
    'export',
    '--ledger',
    '.blueprinttool/data.json',
    '--output',
    'ledger-export.md',
  ]);

  assert.equal(command.mode, 'export');
  assert.equal(command.ledgerJsonFile, '.blueprinttool/data.json');
  assert.equal(command.exportOperation?.outputFile, 'ledger-export.md');
});

test('parse-ledger-cli-argv parses answer commands', () => {
  const command = parseLedgerCliArgv([
    'answer',
    '--ledger',
    '.blueprinttool/specs.json',
    '--thread-id',
    'thread-card-a',
    '--message',
    'Agent answer.',
  ]);

  assert.equal(command.mode, 'answer');
  assert.equal(command.ledgerJsonFile, '.blueprinttool/specs.json');
  assert.equal(command.answerOperation?.threadId, 'thread-card-a');
  assert.equal(command.answerOperation?.message, 'Agent answer.');
});
