import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  MarkdownEditorTargetError,
  markdownEditorTargetLocation,
  resolveMarkdownEditorTarget,
} from '../../src/business/content-authoring/helper/resolve-markdown-editor-target.js';
import type { DecisionOsProject } from '../../src/business/server/helper/project-catalog.js';

function fixture(): {
  root: string;
  decisionOsRoot: string;
  cardFile: string;
  threadFile: string;
  orphanFile: string;
  serverSkillFile: string;
  project: DecisionOsProject;
  ledger: Record<string, unknown>;
} {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-markdown-target-'));
  const decisionOsRoot = join(root, '.decision-os');
  const cardFile = join(decisionOsRoot, 'cards', 'specs', 'card-a.md');
  const threadFile = join(decisionOsRoot, 'threads', 'specs', 'thread-card-a.md');
  const orphanFile = join(decisionOsRoot, 'threads', 'specs', 'thread-orphan.md');
  const serverSkillFile = join(root, '.skills', 'server-skill', 'SKILL.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'specs'), { recursive: true });
  mkdirSync(join(serverSkillFile, '..'), { recursive: true });
  writeFileSync(cardFile, '# Card\n');
  writeFileSync(threadFile, '# OPERATOR\n\nQuestion\n');
  writeFileSync(orphanFile, '# OPERATOR\n\nOrphan\n');
  writeFileSync(serverSkillFile, '---\nname: server-skill\ndescription: Server skill\n---\n\n# Instructions\n\nUse the server skill.\n');
  const ledger = {
    cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/specs/card-a.md' } }],
    threadFiles: {
      'thread-card-a': '.decision-os/threads/specs/thread-card-a.md',
      'thread-orphan': '.decision-os/threads/specs/thread-orphan.md',
    },
  };
  const project: DecisionOsProject = {
    id: 'project-a',
    name: 'Project A',
    relativePath: '.',
    root,
    decisionOsRoot,
    description: '',
    color: '#38d9e8',
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/ledgers/specs.json' }],
    available: true,
    diagnostic: '',
  };
  return { root, decisionOsRoot, cardFile, threadFile, orphanFile, serverSkillFile, project, ledger };
}

test('resolver maps current card and note-owned thread files to path-free canonical locations', () => {
  const value = fixture();
  try {
    const readLedger = () => value.ledger;
    const card = resolveMarkdownEditorTarget({
      targetPath: value.cardFile,
      projects: [value.project],
      serverRoot: value.root,
      readLedger,
    });
    assert.deepEqual(card, { kind: 'card', projectId: 'project-a', ledgerId: 'specs', cardId: 'card-a' });
    assert.equal(markdownEditorTargetLocation(card), '/p/project-a/ledgers/specs/cards/card-a?editor=markdown');
    const thread = resolveMarkdownEditorTarget({
      targetPath: value.threadFile,
      projects: [value.project],
      serverRoot: value.root,
      readLedger,
    });
    assert.deepEqual(thread, {
      kind: 'thread',
      projectId: 'project-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      threadId: 'thread-card-a',
    });
    assert.equal(markdownEditorTargetLocation(thread), '/p/project-a/ledgers/specs/cards/card-a?thread=open');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('shared skill direct routes require and retain one project request context', () => {
  const value = fixture();
  try {
    const projectB: DecisionOsProject = {
      ...value.project,
      id: 'project-b',
      name: 'Project B',
      relativePath: 'project-b',
      root: join(value.root, 'project-b'),
      decisionOsRoot: join(value.root, 'project-b', '.decision-os'),
      ledgers: [],
    };
    mkdirSync(projectB.decisionOsRoot, { recursive: true });
    assert.throws(() => resolveMarkdownEditorTarget({
      targetPath: value.serverSkillFile,
      projects: [value.project, projectB],
      serverRoot: value.root,
    }), (error: unknown) => {
      assert.equal((error as MarkdownEditorTargetError).code, 'markdown_editor_target_ambiguous');
      return true;
    });
    const target = resolveMarkdownEditorTarget({
      targetPath: value.serverSkillFile,
      projects: [value.project, projectB],
      serverRoot: value.root,
      projectId: 'project-b',
    });
    assert.deepEqual(target, { kind: 'skill', name: 'server-skill', source: 'server', projectId: 'project-b' });
    assert.equal(markdownEditorTargetLocation(target), '/skills?editor=skill&name=server-skill&projectId=project-b');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('resolver rejects orphan, stale, symlinked, and ambiguous Markdown ownership', () => {
  const value = fixture();
  try {
    const resolveTarget = (targetPath: string, ledger = value.ledger) => resolveMarkdownEditorTarget({
      targetPath,
      projects: [value.project],
      serverRoot: value.root,
      readLedger: () => ledger,
    });
    assert.throws(() => resolveTarget(value.orphanFile), (error: unknown) => {
      assert.equal((error as MarkdownEditorTargetError).code, 'markdown_editor_target_not_found');
      return true;
    });
    const symlink = join(value.decisionOsRoot, 'cards', 'specs', 'alias.md');
    symlinkSync(value.cardFile, symlink);
    assert.throws(() => resolveTarget(symlink), (error: unknown) => {
      assert.equal((error as MarkdownEditorTargetError).statusCode, 404);
      return true;
    });
    assert.throws(() => resolveTarget(value.cardFile, {
      ...value.ledger,
      cards: [
        ...(value.ledger.cards as Array<Record<string, unknown>>),
        { id: 'card-b', comment: { contentFile: '.decision-os/cards/specs/card-a.md' } },
      ],
    }), (error: unknown) => {
      assert.equal((error as MarkdownEditorTargetError).code, 'markdown_editor_target_ambiguous');
      assert.equal((error as MarkdownEditorTargetError).statusCode, 409);
      return true;
    });
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});
