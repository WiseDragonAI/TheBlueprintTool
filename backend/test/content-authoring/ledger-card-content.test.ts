import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  readLedgerCardRevisionContentController,
  readLedgerCardRevisionHistoryController,
} from '../../src/business/ledger/controller/read-ledger-card-revisions-controller.js';
import { retryLedgerCardRevisionController } from '../../src/business/ledger/controller/retry-ledger-card-revision-controller.js';
import { saveLedgerCardContentController } from '../../src/business/ledger/controller/save-ledger-card-content-controller.js';
import { sha256AuthoredBytes } from '../../src/business/content-authoring/helper/authored-file-git-revisions.js';
import { ensureDecisionOsGitRepository } from '../../src/business/server/helper/ensure-decision-os-git-repository.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function fixture(): {
  root: string;
  decisionOsRoot: string;
  file: string;
  ledger: Record<string, unknown>;
  parentHead: string;
  parentIndex: string;
  cleanup(): void;
} {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-card-content-'));
  const decisionOsRoot = join(root, '.decision-os');
  const file = join(decisionOsRoot, 'cards', 'specs', 'card-a.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'specs'), { recursive: true });
  writeFileSync(file, '# Initial\n');
  const ledger = {
    cards: [{
      id: 'card-a',
      comment: { contentFile: '.decision-os/cards/specs/card-a.md' },
    }],
  };
  git(root, ['init', '-q']);
  writeFileSync(join(root, 'README.md'), '# Parent\n');
  git(root, ['add', 'README.md']);
  git(root, ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'Initial']);
  writeFileSync(join(root, 'operator.txt'), 'approved staged bytes\n');
  git(root, ['add', 'operator.txt']);
  const parentHead = git(root, ['rev-parse', 'HEAD']);
  const parentIndex = git(root, ['diff', '--cached', '--binary']);
  ensureDecisionOsGitRepository(decisionOsRoot);
  return {
    root,
    decisionOsRoot,
    file,
    ledger,
    parentHead,
    parentIndex,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function assertParentUnchanged(value: ReturnType<typeof fixture>): void {
  assert.equal(git(value.root, ['rev-parse', 'HEAD']), value.parentHead);
  assert.equal(git(value.root, ['diff', '--cached', '--binary']), value.parentIndex);
}

function patchOwner(value: ReturnType<typeof fixture>, counter: { count: number }) {
  return async ({ markdown }: { markdown: string; mutationId: string }) => {
    counter.count += 1;
    writeFileSync(value.file, markdown);
    const changedCard = {
      id: 'card-a',
      comment: {
        contentFile: '.decision-os/cards/specs/card-a.md',
        what: markdown,
      },
      contentRevision: sha256AuthoredBytes(markdown),
    };
    value.ledger.cards = [changedCard];
    return { changedCard };
  };
}

function taskPatchOwner(
  value: ReturnType<typeof fixture>,
  counter: { count: number },
  resourceId = '.decision-os/cards/specs/card-a.md',
) {
  return async ({ markdown, mutationId }: { markdown: string; mutationId: string }) => {
    const patched = await patchOwner(value, counter)({ markdown, mutationId });
    const taskClock = { node: counter.count };
    return {
      ...patched,
      taskClock,
      receipt: {
        mutationId,
        clock: taskClock,
        entities: [{ entityType: 'resource', entityId: resourceId }],
      },
    };
  };
}

test('task card save accepts only the exact card Markdown resource receipt', async () => {
  const accepted = fixture();
  const rejected = fixture();
  try {
    const acceptedCounter = { count: 0 };
    const saved = await saveLedgerCardContentController({
      projectId: 'project-a',
      ledgerId: 'tasks',
      cardId: 'card-a',
      decisionOsRoot: accepted.decisionOsRoot,
      ledger: accepted.ledger,
      markdown: '# Accepted resource\n',
      expectedContentRevision: sha256AuthoredBytes('# Initial\n'),
      patchCard: taskPatchOwner(accepted, acceptedCounter),
      reloadLedger: () => accepted.ledger,
    });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    assert.equal(acceptedCounter.count, 1);
    assert.equal(readFileSync(accepted.file, 'utf8'), '# Accepted resource\n');
    assert.equal(git(accepted.decisionOsRoot, ['show', '--name-only', '--format=', 'HEAD']), 'cards/specs/card-a.md');
    assertParentUnchanged(accepted);

    const rejectedCounter = { count: 0 };
    const failed = await saveLedgerCardContentController({
      projectId: 'project-a',
      ledgerId: 'tasks',
      cardId: 'card-a',
      decisionOsRoot: rejected.decisionOsRoot,
      ledger: rejected.ledger,
      markdown: '# Wrong resource\n',
      expectedContentRevision: sha256AuthoredBytes('# Initial\n'),
      patchCard: taskPatchOwner(rejected, rejectedCounter, '.decision-os/cards/specs/card-other.md'),
      reloadLedger: () => rejected.ledger,
    });
    assert.equal(failed.statusCode, 500);
    assert.equal(failed.code, 'card_content_save_failed');
    assert.match(String(failed.error), /task mutation receipt/);
    assert.equal(rejectedCounter.count, 1);
    assert.equal(git(rejected.decisionOsRoot, ['rev-list', '--count', 'HEAD']), '1');
    assertParentUnchanged(rejected);
  } finally {
    accepted.cleanup();
    rejected.cleanup();
  }
});

test('card save mutates once, creates a focused revision, rejects stale/no-op writes, and exposes path-free history', async () => {
  const value = fixture();
  const counter = { count: 0 };
  try {
    const initialRevision = sha256AuthoredBytes('# Initial\n');
    const saved = await saveLedgerCardContentController({
      projectId: 'project-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      markdown: '# Revised\n',
      expectedContentRevision: initialRevision,
      patchCard: patchOwner(value, counter),
      reloadLedger: () => value.ledger,
    });
    assert.equal(saved.ok, true);
    assert.equal((saved.snapshot as { markdown?: string }).markdown, '# Revised\n');
    assert.equal((saved.snapshot as { baseMarkdown?: string }).baseMarkdown, '# Initial\n');
    assert.equal(counter.count, 1);
    assert.equal(readFileSync(value.file, 'utf8'), '# Revised\n');
    assert.equal(git(value.decisionOsRoot, ['log', '-1', '--format=%s']), 'Revise card card-a');
    assert.equal(git(value.decisionOsRoot, ['show', '--name-only', '--format=', 'HEAD']), 'cards/specs/card-a.md');
    assertParentUnchanged(value);

    const noOp = await saveLedgerCardContentController({
      projectId: 'project-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      markdown: '# Revised\n',
      expectedContentRevision: String(saved.contentRevision),
      patchCard: patchOwner(value, counter),
      reloadLedger: () => value.ledger,
    });
    assert.equal(noOp.statusCode, 422);
    const stale = await saveLedgerCardContentController({
      projectId: 'project-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      markdown: '# Other\n',
      expectedContentRevision: initialRevision,
      patchCard: patchOwner(value, counter),
      reloadLedger: () => value.ledger,
    });
    assert.equal(stale.statusCode, 409);
    assert.equal((stale.snapshot as { markdown?: string }).markdown, '# Revised\n');
    assert.equal(counter.count, 1);

    const history = await readLedgerCardRevisionHistoryController({
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      cardId: 'card-a',
    });
    assert.equal(history.ok, true);
    assert.ok(Array.isArray((history.history as { revisions?: unknown[] }).revisions));
    assert.equal(JSON.stringify(history).includes(value.root), false);
    const current = await readLedgerCardRevisionContentController({
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      cardId: 'card-a',
      commit: 'current',
    });
    assert.equal(current.ok, true);
    assert.equal((current.revision as { markdown?: string }).markdown, '# Revised\n');
    assert.equal((current.revision as { baseMarkdown?: string }).baseMarkdown, '# Initial\n');
  } finally {
    value.cleanup();
  }
});

test('pending card Git revision retries without issuing a second card mutation', async () => {
  const value = fixture();
  const counter = { count: 0 };
  try {
    const saved = await saveLedgerCardContentController({
      projectId: 'project-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      markdown: '# Preserved\n',
      expectedContentRevision: sha256AuthoredBytes('# Initial\n'),
      patchCard: patchOwner(value, counter),
      reloadLedger: () => value.ledger,
      gitFailureAt: 'commit-tree',
    });
    assert.equal(saved.statusCode, 503);
    assert.equal(saved.authoredBytesPreserved, true);
    assert.equal(counter.count, 1);
    const retried = await retryLedgerCardRevisionController({
      projectId: 'project-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      decisionOsRoot: value.decisionOsRoot,
      ledger: value.ledger,
      recoveryToken: saved.recoveryToken,
      contentRevision: saved.contentRevision,
    });
    assert.equal(retried.ok, true);
    assert.equal(counter.count, 1);
    assert.equal(readFileSync(value.file, 'utf8'), '# Preserved\n');
    assert.equal(git(value.decisionOsRoot, ['rev-list', '--count', 'HEAD']), '2');
    assertParentUnchanged(value);
  } finally {
    value.cleanup();
  }
});
