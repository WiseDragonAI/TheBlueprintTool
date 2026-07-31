/**
 * WHAT: Command-level coverage for ledger-cli.
 * WHY: the separated executable path must parse argv and call ledger mutation/overview controllers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { dispatchLedgerCliCommandController } from '../../src/index.js';
import { createJsonFile, tempDir } from '../fixture/scenario.js';

const execFileAsync = promisify(execFile);

test('ledger-cli command emits help without reading a ledger', async () => {
  const messages: string[] = [];
  const result = await dispatchLedgerCliCommandController(['help'], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /Usage: ledger-cli <command> \[options\]/);
  assert.match(messages.join('\n'), /unanswered --ledger <file> \[--json\]/);
  assert.match(messages.join('\n'), /card-context --ledger <file> --card-id <id> --json/);
  assert.match(messages.join('\n'), /card-read --card-id <id> \[--card-id <id>\]\.\.\./);
  assert.match(messages.join('\n'), /zone-cards --ledger <file> --zone-id <id> --json/);
  assert.match(messages.join('\n'), /answer --ledger <file> --thread-id <id>/);
  assert.match(messages.join('\n'), /--message-file <file>/);
  assert.match(messages.join('\n'), /codex-run-events --run-id <id> --item-type <type>/);
  assert.match(messages.join('\n'), /master-task-complete --card-id <id> \[--ledger <file>\]/);
  assert.match(messages.join('\n'), /"sections":\[/);
});

test('ledger-cli command mutates a ledger and emits overview text', async () => {
  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Old title' }],
    relationships: [],
  });
  const mutate = await dispatchLedgerCliCommandController([
    'mutate',
    '--ledger',
    ledgerFile,
    '--card-id',
    'card-a',
    '--card-title',
    'New title',
  ]);
  const messages: string[] = [];
  const overview = await dispatchLedgerCliCommandController(['overview', '--ledger', ledgerFile], { emit: (message) => messages.push(message) });

  assert.equal(mutate.ok, true);
  assert.equal(overview.ok, true);
  assert.equal(JSON.parse(await readFile(ledgerFile, 'utf8')).cards[0].title, 'New title');
  assert.match(messages.join('\n'), /card-a :: New title/);
});

test('ledger-cli command lists unanswered threads and posts an answer', async () => {
  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Card A' }],
    notes: {
      'thread-card-a': [{ role: 'operator', message: 'Question' }]
    }
  });
  const messages: string[] = [];
  const unanswered = await dispatchLedgerCliCommandController(['unanswered', '--ledger', ledgerFile], { emit: (message) => messages.push(message) });
  const answer = await dispatchLedgerCliCommandController(['answer', '--ledger', ledgerFile, '--thread-id', 'thread-card-a', '--message', 'Answer.']);

  assert.equal(unanswered.ok, true);
  assert.match(messages.join('\n'), /thread-card-a/);
  assert.match(messages.join('\n'), /\.decision-os\/threads\/ledger\/thread-card-a\.md/);
  assert.match(messages.join('\n'), /Patch .* directly/);
  assert.match(messages.join('\n'), /# AGENT/);
  assert.match(messages.join('\n'), /Only # OPERATOR and # AGENT/);
  assert.match(messages.join('\n'), /ledger-cli answer/);
  assert.equal(answer.ok, true);
  const persisted = JSON.parse(await readFile(ledgerFile, 'utf8')) as { notes: Record<string, unknown>; threadFiles: Record<string, string> };
  assert.equal(persisted.notes['thread-card-a'], undefined);
  const threadMarkdown = await readFile(join(dirname(dirname(ledgerFile)), persisted.threadFiles['thread-card-a']), 'utf8');
  assert.match(threadMarkdown, /^# AGENT/m);
  assert.match(threadMarkdown, /Answer\./);
});

test('ledger-cli command exports a markdown file', async () => {
  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Card A', x: 10, y: 10, w: 80, h: 80, comment: { what: 'Body.' } }],
    annotations: [{ id: 'zone-a', label: 'Zone A', x: 0, y: 0, width: 100, height: 100 }],
  });
  const outputFile = join(ledgerFile, '..', 'export.md');
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController(['export', '--ledger', ledgerFile, '--output', outputFile], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /Exported markdown/);
  assert.match(await readFile(outputFile, 'utf8'), /# Zone A\n\n## Card A/);
});

test('ledger-cli command emits card and zone context JSON', async () => {
  const root = await tempDir('decision-os-zone-command-');
  const decisionOs = join(root, '.decision-os');
  await mkdir(join(decisionOs, 'cards', 'skills'), { recursive: true });
  const ledgerFile = join(decisionOs, 'skills.json');
  await writeFile(join(decisionOs, 'cards', 'skills', 'card-a.md'), 'Card A body.', 'utf8');
  await writeFile(ledgerFile, JSON.stringify({
    cards: [
      { id: 'card-a', title: 'Card A', x: 10, y: 10, w: 80, h: 80, comment: { contentFile: '.decision-os/cards/skills/card-a.md' } },
    ],
    annotations: [{ id: 'zone-a', label: 'Zone A', variant: 'zone', x: 0, y: 0, width: 100, height: 100 }],
    relationships: [],
  }, null, 2));
  const messages: string[] = [];

  const card = await dispatchLedgerCliCommandController(['card-context', '--ledger', ledgerFile, '--card-id', 'card-a', '--json'], { emit: (message) => messages.push(message) });
  const zone = await dispatchLedgerCliCommandController(['zone-cards', '--ledger', ledgerFile, '--zone-id', 'zone-a', '--json'], { emit: (message) => messages.push(message) });

  assert.equal(card.ok, true);
  assert.equal(zone.ok, true);
  assert.match(messages.join('\n'), /"zone":/);
  assert.match(messages.join('\n'), /"id": "card-a"/);
  assert.match(messages.join('\n'), /"contentFile": "\.decision-os\/cards\/skills\/card-a\.md"/);
});

test('ledger-cli migration dry-run reports changes without moving workspace state', async () => {
  const root = await tempDir('decision-os-migrate-dry-');
  await mkdir(join(root, '.blueprinttool', 'threads', 'specs'), { recursive: true });
  await writeFile(join(root, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }],
    corev2FrontendRoot: 'CoreV2/frontend',
  }, null, 2));
  await writeFile(join(root, '.blueprinttool', 'threads', 'specs', 'thread-card-a.md'), [
    '# OPERATOR',
    '<!-- corev2:note {"id":"note-a"} -->',
    '',
    'See .blueprinttool/card-images/a.png',
  ].join('\n'));
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController(['migrate-decision-os', '--root', root, '--dry-run', '--json'], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /"dryRun": true/);
  assert.match(messages.join('\n'), /thread-card-a\.md/);
  assert.equal(await access(join(root, '.blueprinttool', 'state.json')).then(() => true), true);
  await assert.rejects(access(join(root, '.decision-os', 'state.json')));
});

test('ledger-cli migration write moves storage and rewrites settings and note metadata', async () => {
  const root = await tempDir('decision-os-migrate-write-');
  await mkdir(join(root, '.blueprinttool', 'threads', 'specs'), { recursive: true });
  await writeFile(join(root, '.blueprinttool', '.settings.json'), JSON.stringify({
    corev2FrontendRoot: 'CoreV2/frontend',
    OPENAI_API_KEY: 'sk-test-not-printed',
  }, null, 2));
  await writeFile(join(root, '.blueprinttool', 'state.json'), JSON.stringify({
    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }],
  }, null, 2));
  await writeFile(join(root, '.blueprinttool', 'threads', 'specs', 'thread-card-a.md'), '<!-- corev2:note {"voiceFileRef":"/workspace/CoreV2/.blueprinttool/voice-uploads/a.wav"} -->');

  const result = await dispatchLedgerCliCommandController(['migrate-decision-os', '--root', root, '--write']);

  assert.equal(result.ok, true);
  await assert.rejects(access(join(root, '.blueprinttool')));
  const state = await readFile(join(root, '.decision-os', 'state.json'), 'utf8');
  const settings = await readFile(join(root, '.decision-os', '.settings.json'), 'utf8');
  const thread = await readFile(join(root, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'utf8');
  assert.match(state, /\.decision-os\/specs\.json/);
  assert.match(settings, /decisionOsFrontendRoot/);
  assert.doesNotMatch(settings, /corev2FrontendRoot/);
  assert.match(thread, /decision-os:note/);
  assert.match(thread, /\.decision-os\/voice-uploads\/a\.wav/);
});

test('ledger-cli migration rejects mixed and dirty workspaces', async () => {
  const mixed = await tempDir('decision-os-migrate-mixed-');
  await mkdir(join(mixed, '.blueprinttool'), { recursive: true });
  await mkdir(join(mixed, '.decision-os'), { recursive: true });
  const mixedResult = await dispatchLedgerCliCommandController(['migrate-decision-os', '--root', mixed, '--write']);
  assert.equal(mixedResult.ok, false);

  const dirty = await tempDir('decision-os-migrate-dirty-');
  await mkdir(join(dirty, '.blueprinttool'), { recursive: true });
  await writeFile(join(dirty, '.blueprinttool', 'state.json'), '{}');
  await execFileAsync('git', ['-C', dirty, 'init']);
  await execFileAsync('git', ['-C', dirty, 'add', '.blueprinttool/state.json']);
  await writeFile(join(dirty, '.blueprinttool', 'state.json'), '{"changed":true}');

  const dirtyResult = await dispatchLedgerCliCommandController(['migrate-decision-os', '--root', dirty, '--write']);
  const allowedResult = await dispatchLedgerCliCommandController(['migrate-decision-os', '--root', dirty, '--write', '--allow-dirty']);

  assert.equal(dirtyResult.ok, false);
  assert.equal(allowedResult.ok, true);
});
