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

test('parse-ledger-cli-argv parses project and master-task creation commands', () => {
  assert.equal(parseLedgerCliArgv(['projects']).mode, 'projects');
  const command = parseLedgerCliArgv([
    'master-task-create',
    '--project', 'project-a',
    '--title', 'Context metrics',
    '--subtask', 'Collect metrics',
    '--subtask', 'Render metrics',
  ]);
  assert.equal(command.mode, 'master-task-create');
  assert.deepEqual(command.masterTaskCreateOperation, {
    projectId: 'project-a',
    title: 'Context metrics',
    subtasks: ['Collect metrics', 'Render metrics'],
  });
});

test('parse-ledger-cli-argv parses dynamic skill queue commands', () => {
  const command = parseLedgerCliArgv([
    'queue-skill',
    '--skill', 'analysis',
    '--model', 'gpt-5.6-sol',
    '--effort', 'ultra',
  ]);
  assert.equal(command.mode, 'queue-skill');
  assert.deepEqual(command.queueSkillOperation, {
    skillName: 'analysis',
    codexModel: 'gpt-5.6-sol',
    codexEffort: 'ultra',
  });
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
    '--card-questionnaires-file',
    'tmp/questions.json',
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
    '--append',
    'Fact, with comma',
    '--append',
    'Second fact',
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
  assert.equal(command.mutationOperation.cardQuestionnairesFile, 'tmp/questions.json');
  assert.equal(command.mutationOperation.cardTitle, 'TABLE: character');
  assert.equal(command.mutationOperation.cardX, 120);
  assert.equal(command.mutationOperation.cardY, -45);
  assert.equal(command.mutationOperation.cardW, 640);
  assert.equal(command.mutationOperation.cardH, 320);
  assert.deepEqual(command.mutationOperation.cardLabels, ['visual', 'validated']);
  assert.deepEqual(command.mutationOperation.cardFactsAppend, ['Fact, with comma', 'Second fact']);
  assert.equal(command.mutationOperation.cardFactsAppendMissingValue, false);
  assert.equal(command.mutationOperation.addCardFile, 'tmp/card.json');
  assert.deepEqual(command.mutationOperation.removeCardIds, ['card-old']);
  assert.deepEqual(command.mutationOperation.removeRelationshipIds, ['rel-a', 'rel-b']);
  assert.deepEqual(command.mutationOperation.addRelationships, [{ id: 'rel-c', from: 'from-card', to: 'to-card', label: 'label text' }]);
});

test('parse-ledger-cli-argv records bare fact flags as invalid required arguments', () => {
  const command = parseLedgerCliArgv(['mutate', '--card-id', 'card-a', '--replace']);
  assert.deepEqual(command.mutationOperation.cardFactsReplace, []);
  assert.equal(command.mutationOperation.cardFactsReplaceMissingValue, true);
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

test('parse-ledger-cli-argv parses card and zone context commands', () => {
  const card = parseLedgerCliArgv([
    'card-context',
    '--ledger',
    '.decision-os/skills.json',
    '--card-id',
    'card-a',
    '--json',
  ]);
  const zone = parseLedgerCliArgv([
    'zone-cards',
    '--ledger',
    '.decision-os/skills.json',
    '--zone-id',
    'zone-a',
    '--json',
  ]);

  assert.equal(card.mode, 'card-context');
  assert.equal(card.ledgerJsonFile, '.decision-os/skills.json');
  assert.equal(card.cardOperation?.cardId, 'card-a');
  assert.equal(card.json, true);
  assert.equal(zone.mode, 'zone-cards');
  assert.equal(zone.ledgerJsonFile, '.decision-os/skills.json');
  assert.equal(zone.zoneOperation?.zoneId, 'zone-a');
  assert.equal(zone.json, true);
});

test('parse-ledger-cli-argv parses ID-only card reads', () => {
  const command = parseLedgerCliArgv([
    'card-read',
    '--card-id',
    'card-a',
    '--card-id',
    'card-b',
  ]);

  assert.equal(command.mode, 'card-read');
  assert.equal(command.ledgerJsonFile, '');
  assert.deepEqual(command.cardOperation?.cardIds, ['card-a', 'card-b']);
  assert.equal(command.json, false);
});

test('parse-ledger-cli-argv parses repeated prompt query names', () => {
  const command = parseLedgerCliArgv([
    'prompt',
    'query',
    '--name',
    'CLI_TOOLS',
    '--name',
    'SYSTEM_PROMPT',
  ]);

  assert.equal(command.mode, 'prompt');
  assert.equal(command.promptOperation?.action, 'query');
  assert.deepEqual(command.promptOperation?.names, ['CLI_TOOLS', 'SYSTEM_PROMPT']);
});

test('parse-ledger-cli-argv parses prompt mutation inputs', () => {
  const create = parseLedgerCliArgv([
    'prompt',
    'create',
    '--project',
    'project-a',
    '--name',
    'ResearchPrompt',
    '--description',
    'Research one source',
    '--markdown-file',
    '/tmp/research.md',
  ]);
  const update = parseLedgerCliArgv([
    'prompt',
    'update',
    '--project',
    'project-a',
    '--name',
    'ResearchPrompt',
  ]);

  assert.deepEqual(create.promptOperation, {
    action: 'create',
    description: 'Research one source',
    markdownFile: '/tmp/research.md',
    name: 'ResearchPrompt',
    names: ['ResearchPrompt'],
    projectId: 'project-a',
  });
  assert.deepEqual(update.promptOperation, {
    action: 'update',
    description: undefined,
    markdownFile: undefined,
    name: 'ResearchPrompt',
    names: ['ResearchPrompt'],
    projectId: 'project-a',
  });
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

test('parse-ledger-cli-argv parses synchronized skill commands', () => {
  const create = parseLedgerCliArgv(['skills', 'create', '--source', '/source/my-skill', '--json']);
  const update = parseLedgerCliArgv(['skills', 'update', '--root', '/server', '--source', '/source/my-skill']);

  assert.equal(create.mode, 'skills');
  assert.deepEqual(create.skillOperation, { action: 'create', json: true, rootFlagProvided: false, source: '/source/my-skill' });
  assert.equal(update.skillOperation?.action, 'update');
  assert.equal(update.skillOperation?.json, false);
  assert.equal(update.skillOperation?.rootFlagProvided, true);
});
