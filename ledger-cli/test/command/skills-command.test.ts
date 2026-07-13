/**
 * WHAT: Command-level proof for synchronized server skill creation, update, tagging, commits, and rollback.
 * WHY: The CLI transaction is the only supported writer for the server Skills ledger and package root.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchLedgerCliCommandController } from '../../src/index.js';
import { synchronizeServerSkillController } from '../../src/business/skills/controller/synchronize-server-skill.js';
import { tempDir } from '../fixture/scenario.js';

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function writeSkill(root: string, name: string, references: Record<string, string>): string {
  const directory = join(root, name);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(join(directory, 'agents'), { recursive: true });
  mkdirSync(join(directory, 'references'), { recursive: true });
  mkdirSync(join(directory, 'scripts'), { recursive: true });
  mkdirSync(join(directory, 'assets'), { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), [
    '---', `name: ${name}`, `description: Run ${name} with shared references.`, '---', '', '# Workflow', '', 'Read [the guide](references/guide.md).', '',
  ].join('\n'));
  writeFileSync(join(directory, 'agents', 'openai.yaml'), [
    'interface:', `  display_name: "${name}"`, '  short_description: "Shared test skill"', `  default_prompt: "Use ${name}."`, '',
  ].join('\n'));
  for (const [path, content] of Object.entries(references)) {
    const file = join(directory, 'references', path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  }
  writeFileSync(join(directory, 'scripts', 'run.sh'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(directory, 'scripts', 'run.sh'), 0o755);
  writeFileSync(join(directory, 'assets', 'data.bin'), Buffer.from([0, 1, 2, 3]));
  return directory;
}

async function fixture(): Promise<{ root: string; sourceRoot: string }> {
  const root = await tempDir('decision-os-server-skills-');
  const sourceRoot = await tempDir('decision-os-skill-source-');
  mkdirSync(join(root, '.decision-os'), { recursive: true });
  writeFileSync(join(root, '.decision-os', 'skills.json'), JSON.stringify({
    modelName: 'skills', cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {},
  }, null, 2));
  git(root, 'init');
  git(root, 'config', 'user.name', 'Decision OS Test');
  git(root, 'config', 'user.email', 'decision-os@example.test');
  git(root, 'add', '.decision-os/skills.json');
  git(root, 'commit', '-m', 'test: initialize skills ledger');
  return { root, sourceRoot };
}

test('skills create and update synchronize exact mirrors, tags, stable ids, resources, and focused commits', async () => {
  const { root, sourceRoot } = await fixture();
  const source = writeSkill(sourceRoot, 'shared-review', { 'guide.md': '# Guide v1\n', 'nested/policy.md': '# Policy\n' });
  const messages: string[] = [];
  const created = await dispatchLedgerCliCommandController([
    'skills', 'create', '--root', root, '--source', source, '--json',
  ], { emit: (message) => messages.push(message) });
  assert.equal(created.ok, true);
  assert.match(messages.join('\n'), /"skillName": "shared-review"/);
  const firstLedger = JSON.parse(readFileSync(join(root, '.decision-os', 'skills.json'), 'utf8'));
  const firstCards = firstLedger.cards.filter((card: Record<string, unknown>) => card.skillName === 'shared-review');
  assert.equal(firstCards.length, 3);
  assert.equal(firstLedger.annotations.filter((zone: Record<string, unknown>) => zone.skillName === 'shared-review').length, 1);
  assert.equal(firstLedger.relationships.filter((relationship: Record<string, unknown>) => firstCards.some((card: Record<string, unknown>) => card.id === relationship.from)).length, 2);
  assert.deepEqual(firstCards[0].labels, ['skill', 'shared-review', 'skill-main']);
  assert.deepEqual(firstCards.slice(1).map((card: Record<string, unknown>) => card.labels), [
    ['skill', 'shared-review', 'skill-reference'], ['skill', 'shared-review', 'skill-reference'],
  ]);
  for (const card of firstCards) {
    assert.equal(readFileSync(join(root, card.comment.contentFile.replace(/^\.decision-os\//, '.decision-os/')), 'utf8'), readFileSync(join(root, card.skillFile), 'utf8'));
  }
  assert.equal(readFileSync(join(root, '.skills', 'shared-review', 'assets', 'data.bin')).equals(Buffer.from([0, 1, 2, 3])), true);
  assert.equal(
    statSync(join(root, '.skills', 'shared-review', 'scripts', 'run.sh')).mode & 0o777,
    statSync(join(source, 'scripts', 'run.sh')).mode & 0o777,
  );
  const createFiles = git(root, 'show', '--pretty=format:', '--name-only', 'HEAD').split('\n').filter(Boolean);
  assert.equal(createFiles.every((file) => file === '.decision-os/skills.json' || file.startsWith('.decision-os/cards/skills/') || file.startsWith('.decision-os/threads/skills/') || file.startsWith('.skills/shared-review/')), true);

  const mainId = firstCards.find((card: Record<string, unknown>) => card.skillRole === 'main').id;
  const guideId = firstCards.find((card: Record<string, unknown>) => card.skillFile === '.skills/shared-review/references/guide.md').id;
  writeFileSync(join(root, 'unrelated.txt'), 'keep staged\n');
  git(root, 'add', 'unrelated.txt');
  writeSkill(sourceRoot, 'shared-review', { 'guide.md': '# Guide v2\n', 'new.md': '# New\n' });
  const updated = await dispatchLedgerCliCommandController(['skills', 'update', '--root', root, '--source', source]);
  assert.equal(updated.ok, true);
  assert.equal(git(root, 'diff', '--cached', '--name-only'), 'unrelated.txt');
  const secondLedger = JSON.parse(readFileSync(join(root, '.decision-os', 'skills.json'), 'utf8'));
  const secondCards = secondLedger.cards.filter((card: Record<string, unknown>) => card.skillName === 'shared-review');
  assert.equal(secondCards.length, 3);
  assert.equal(secondCards.find((card: Record<string, unknown>) => card.skillRole === 'main').id, mainId);
  assert.equal(secondCards.find((card: Record<string, unknown>) => card.skillFile === '.skills/shared-review/references/guide.md').id, guideId);
  assert.equal(secondCards.some((card: Record<string, unknown>) => card.skillFile === '.skills/shared-review/references/nested/policy.md'), false);
  assert.equal(existsSync(join(root, '.skills', 'shared-review', 'references', 'nested', 'policy.md')), false);
  assert.equal(readFileSync(join(root, '.skills', 'shared-review', 'references', 'guide.md'), 'utf8'), '# Guide v2\n');
  const updateFiles = git(root, 'show', '--pretty=format:', '--name-only', 'HEAD').split('\n').filter(Boolean);
  assert.equal(updateFiles.includes('unrelated.txt'), false);
});

test('skills commands reject invalid identities, symlinks, dirty targets, and restore files after commit failure', async () => {
  const { root, sourceRoot } = await fixture();
  const source = writeSkill(sourceRoot, 'safe-sync', { 'guide.md': '# Guide\n' });
  assert.equal((await dispatchLedgerCliCommandController(['skills', 'create', '--root', root, '--source', source])).ok, true);
  const duplicate = await dispatchLedgerCliCommandController(['skills', 'create', '--root', root, '--source', source]);
  assert.equal(duplicate.ok, false);
  const missingSource = writeSkill(sourceRoot, 'missing-sync', { 'guide.md': '# Guide\n' });
  assert.equal((await dispatchLedgerCliCommandController(['skills', 'update', '--root', root, '--source', missingSource])).ok, false);
  const symlinkSource = writeSkill(sourceRoot, 'linked-sync', { 'guide.md': '# Guide\n' });
  symlinkSync(join(symlinkSource, 'references', 'guide.md'), join(symlinkSource, 'references', 'linked.md'));
  assert.equal((await dispatchLedgerCliCommandController(['skills', 'create', '--root', root, '--source', symlinkSource])).ok, false);
  const missingReference = writeSkill(sourceRoot, 'missing-reference', {});
  assert.equal((await dispatchLedgerCliCommandController(['skills', 'create', '--root', root, '--source', missingReference])).ok, false);
  const invalidOpenAi = writeSkill(sourceRoot, 'invalid-openai', { 'guide.md': '# Guide\n' });
  writeFileSync(join(invalidOpenAi, 'agents', 'openai.yaml'), 'interface:\n  display_name: Invalid\n');
  assert.equal((await dispatchLedgerCliCommandController(['skills', 'create', '--root', root, '--source', invalidOpenAi])).ok, false);

  const beforeWriteFailureLedger = readFileSync(join(root, '.decision-os', 'skills.json'));
  const beforeWriteFailurePackage = readFileSync(join(root, '.skills', 'safe-sync', 'references', 'guide.md'));
  writeSkill(sourceRoot, 'safe-sync', { 'guide.md': '# Write failure candidate\n' });
  const writeFailed = await synchronizeServerSkillController(
    { action: 'update', json: false, root, source },
    { afterWrites: () => { throw new Error('Injected transaction write failure.'); } },
  );
  assert.equal(writeFailed.ok, false);
  assert.equal(readFileSync(join(root, '.decision-os', 'skills.json')).equals(beforeWriteFailureLedger), true);
  assert.equal(readFileSync(join(root, '.skills', 'safe-sync', 'references', 'guide.md')).equals(beforeWriteFailurePackage), true);

  writeFileSync(join(root, '.skills', 'safe-sync', 'SKILL.md'), 'dirty\n');
  assert.equal((await dispatchLedgerCliCommandController(['skills', 'update', '--root', root, '--source', source])).ok, false);
  git(root, 'restore', '.skills/safe-sync/SKILL.md');
  const beforeHead = git(root, 'rev-parse', 'HEAD');
  const beforeLedger = readFileSync(join(root, '.decision-os', 'skills.json'));
  const beforeGuide = readFileSync(join(root, '.skills', 'safe-sync', 'references', 'guide.md'));
  writeSkill(sourceRoot, 'safe-sync', { 'guide.md': '# Changed but rejected\n' });
  const hook = join(root, '.git', 'hooks', 'pre-commit');
  writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const failed = await dispatchLedgerCliCommandController(['skills', 'update', '--root', root, '--source', source]);
  assert.equal(failed.ok, false);
  assert.equal(git(root, 'rev-parse', 'HEAD'), beforeHead);
  assert.equal(readFileSync(join(root, '.decision-os', 'skills.json')).equals(beforeLedger), true);
  assert.equal(readFileSync(join(root, '.skills', 'safe-sync', 'references', 'guide.md')).equals(beforeGuide), true);
  assert.equal(git(root, 'status', '--porcelain', '--', '.decision-os/skills.json', '.skills/safe-sync'), '');
});
