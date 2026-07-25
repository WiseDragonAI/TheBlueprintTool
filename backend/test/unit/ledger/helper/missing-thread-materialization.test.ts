/**
 * WHAT: Defines the local note-mutation contract when an authoritative thread sidecar is absent.
 * WHY: A non-materialized Epoch 4 resource must never be converted into an intentional partial thread.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation, type LedgerMutation } from '../../../../src/business/ledger/helper/apply-ledger-mutation.js';

const threadId = 'thread-card-a';
const threadRef = `.decision-os/threads/tasks/${threadId}.md`;

function fixture() {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-missing-thread-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const ledgerPath = resolve(decisionOsRoot, 'tasks.json');
  const threadFile = resolve(workspace, threadRef);
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  return { workspace, decisionOsRoot, ledgerPath, threadFile };
}

const mutations: Array<{ name: string; mutation: LedgerMutation }> = [
  {
    name: 'append-note',
    mutation: { action: 'append-note', note: { id: 'note-new', threadId, role: 'agent', body: 'New answer.' } },
  },
  {
    name: 'update-note',
    mutation: { action: 'update-note', note: { id: 'note-existing', threadId, role: 'operator', body: 'Edited question.' } },
  },
  {
    name: 'delete-note',
    mutation: { action: 'delete-note', note: { id: 'note-existing', threadId } },
  },
  {
    name: 'restore-note',
    mutation: { action: 'restore-note', note: { id: 'note-existing', threadId, role: 'operator', body: 'Restored question.' } },
  },
];

for (const entry of mutations) {
  test(`${entry.name} fails closed without creating a missing authoritative thread sidecar`, () => {
    const context = fixture();
    try {
      const ledger = {
        cards: [],
        annotations: [],
        relationships: [],
        notes: {},
        threadFiles: { [threadId]: threadRef },
      };

      const result = applyLedgerMutation({
        decisionOsRoot: context.decisionOsRoot,
        ledgerPath: context.ledgerPath,
        ledger,
        mutation: structuredClone(entry.mutation),
      });

      assert.equal(result.ok, false);
      assert.equal(result.error?.statusCode, 503);
      assert.equal(existsSync(context.threadFile), false);
    } finally {
      rmSync(context.workspace, { recursive: true, force: true });
    }
  });
}

test('append-note preserves existing sidecar notes before writing the intended mutation', () => {
  const context = fixture();
  try {
    mkdirSync(dirname(context.threadFile), { recursive: true });
    writeFileSync(context.threadFile, [
      '# OPERATOR',
      '<!-- decision-os:note {"id":"note-existing","timestamp":"2026-07-26T00:00:00.000Z"} -->',
      '',
      'Existing question.',
      '',
    ].join('\n'));
    const ledger = {
      cards: [],
      annotations: [],
      relationships: [],
      notes: {},
      threadFiles: { [threadId]: threadRef },
    };

    const result = applyLedgerMutation({
      decisionOsRoot: context.decisionOsRoot,
      ledgerPath: context.ledgerPath,
      ledger,
      mutation: { action: 'append-note', note: { id: 'note-new', threadId, role: 'agent', body: 'New answer.' } },
    });

    assert.equal(result.ok, true);
    const markdown = readFileSync(context.threadFile, 'utf8');
    assert.match(markdown, /Existing question\./);
    assert.match(markdown, /New answer\./);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});
