/**
 * WHAT: Unit coverage for parse-ledger-cli-argv.
 * WHY: the separated ledger CLI owns ledger command argument parsing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLedgerCliArgv } from '../../../../src/business/command/helper/parse-ledger-cli-argv.js';

test('parse-ledger-cli-argv parses help requests', () => {
  assert.equal(parseLedgerCliArgv([]).mode, 'help');
  assert.equal(parseLedgerCliArgv(['help']).mode, 'help');
  assert.equal(parseLedgerCliArgv(['--help']).mode, 'help');
  assert.equal(parseLedgerCliArgv(['-h']).mode, 'help');
  assert.equal(parseLedgerCliArgv(['unanswered', '--help']).mode, 'help');
});

test('parse-ledger-cli-argv parses targeted ledger mutations', () => {
  const command = parseLedgerCliArgv([
    'mutate',
    '--ledger',
    '.decision-os/specs.json',
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
  assert.equal(command.ledgerJsonFile, '.decision-os/specs.json');
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
    '.decision-os/data.json',
  ]);

  assert.equal(command.mode, 'overview');
  assert.equal(command.ledgerJsonFile, '.decision-os/data.json');
});

test('parse-ledger-cli-argv parses ledger export command', () => {
  const command = parseLedgerCliArgv([
    'export',
    '--ledger',
    '.decision-os/data.json',
    '--output',
    'ledger-export.md',
  ]);

  assert.equal(command.mode, 'export');
  assert.equal(command.ledgerJsonFile, '.decision-os/data.json');
  assert.equal(command.exportOperation?.outputFile, 'ledger-export.md');
});

test('parse-ledger-cli-argv parses answer commands', () => {
  const command = parseLedgerCliArgv([
    'answer',
    '--ledger',
    '.decision-os/specs.json',
    '--thread-id',
    'thread-card-a',
    '--message',
    'Agent answer.',
  ]);

  assert.equal(command.mode, 'answer');
  assert.equal(command.ledgerJsonFile, '.decision-os/specs.json');
  assert.equal(command.answerOperation?.threadId, 'thread-card-a');
  assert.equal(command.answerOperation?.message, 'Agent answer.');
});

test('parse-ledger-cli-argv parses asset commands', () => {
  const command = parseLedgerCliArgv([
    'assets',
    'gc',
    '--root',
    '/workspace',
    '--dry-run',
    '--include-risky',
    'ui-mockups',
    '--write-plan',
    '.decision-os/assets-gc-plan.json',
    '--write',
  ]);

  assert.equal(command.mode, 'assets');
  assert.equal(command.assetOperation?.action, 'gc');
  assert.equal(command.assetOperation?.root, '/workspace');
  assert.equal(command.assetOperation?.dryRun, true);
  assert.deepEqual(command.assetOperation?.includeRisky, ['ui-mockups']);
  assert.equal(command.assetOperation?.writePlanFile, '.decision-os/assets-gc-plan.json');
  assert.equal(command.assetOperation?.write, true);
});

test('parse-ledger-cli-argv parses asset GC plan application', () => {
  const command = parseLedgerCliArgv([
    'assets',
    'apply-gc-plan',
    '--root',
    '/workspace',
    '--plan',
    '.decision-os/assets-gc-plan.json',
  ]);

  assert.equal(command.mode, 'assets');
  assert.equal(command.assetOperation?.action, 'apply-gc-plan');
  assert.equal(command.assetOperation?.root, '/workspace');
  assert.equal(command.assetOperation?.planFile, '.decision-os/assets-gc-plan.json');
});

test('parse-ledger-cli-argv parses decision-os migration commands', () => {
  const dryRun = parseLedgerCliArgv(['migrate-decision-os', '--root', '/workspace', '--json']);
  const write = parseLedgerCliArgv(['migrate-decision-os', '--root', '/workspace', '--write', '--allow-dirty']);

  assert.equal(dryRun.mode, 'migrate-decision-os');
  assert.equal(dryRun.migrationOperation?.root, '/workspace');
  assert.equal(dryRun.migrationOperation?.dryRun, true);
  assert.equal(dryRun.migrationOperation?.write, false);
  assert.equal(dryRun.migrationOperation?.json, true);
  assert.equal(write.migrationOperation?.dryRun, false);
  assert.equal(write.migrationOperation?.write, true);
  assert.equal(write.migrationOperation?.allowDirty, true);
});
