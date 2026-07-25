/**
 * WHAT: Defines card Markdown materialization and atomic replacement behavior.
 * WHY: Missing authoritative bytes and interrupted writes must not publish empty or truncated card content.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { externalizeCardContent, writeCardDescriptionFile } from '../../../../src/business/ledger/helper/card-content-file.js';

function fixture() {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-card-materialization-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const ledgerPath = resolve(decisionOsRoot, 'tasks.json');
  const contentRef = '.decision-os/cards/tasks/card-a.md';
  const contentFile = resolve(workspace, contentRef);
  mkdirSync(decisionOsRoot, { recursive: true });
  return { workspace, decisionOsRoot, ledgerPath, contentRef, contentFile };
}

test('externalization fails closed when an authoritative card sidecar is missing', () => {
  const context = fixture();
  try {
    const card = { id: 'card-a', comment: { contentFile: context.contentRef } };

    assert.throws(
      () => externalizeCardContent({ decisionOsRoot: context.decisionOsRoot, card, ledgerPath: context.ledgerPath }),
      /task_content_not_materialized/,
    );
    assert.equal(existsSync(context.contentFile), false);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('embedded card Markdown is atomically externalized with exact bytes', () => {
  const context = fixture();
  try {
    const card = { id: 'card-a', comment: { what: '# Exact card bytes\n' } };
    externalizeCardContent({ decisionOsRoot: context.decisionOsRoot, card, ledgerPath: context.ledgerPath });

    assert.equal(readFileSync(context.contentFile, 'utf8'), '# Exact card bytes\n');
    assert.deepEqual(card.comment, { contentFile: context.contentRef });
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('card description replacement leaves no temporary files after success', () => {
  const context = fixture();
  try {
    const card = { id: 'card-a', comment: { contentFile: context.contentRef } };
    writeCardDescriptionFile({
      decisionOsRoot: context.decisionOsRoot,
      card,
      description: '# Replacement\n',
      ledgerPath: context.ledgerPath,
    });

    assert.equal(readFileSync(context.contentFile, 'utf8'), '# Replacement\n');
    assert.deepEqual(
      readdirSync(resolve(context.decisionOsRoot, 'cards', 'tasks')).filter((entry) => entry.startsWith('card-a.md.tmp-')),
      [],
    );
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});
