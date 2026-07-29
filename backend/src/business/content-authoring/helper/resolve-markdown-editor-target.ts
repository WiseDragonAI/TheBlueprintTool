/**
 * WHAT: Resolves one direct Markdown path to its current registered Decision OS owner.
 * WHY: Compatibility URLs must authorize canonical identities without exposing filesystem paths.
 */
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { resolveThreadContentFile } from '../../ledger/helper/thread-content-file.js';
import { scanPipelinePrompts } from '../../codex/helper/pipeline-prompt-library.js';
import { scanCodexSkills } from '../../codex/helper/scan-codex-skills.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';

type AnyRecord = Record<string, unknown>;

export type MarkdownEditorTarget =
  | { kind: 'card'; projectId: string; ledgerId: string; cardId: string }
  | { kind: 'thread'; projectId: string; ledgerId: string; cardId: string; threadId: string }
  | { kind: 'skill'; name: string; source: string; projectId: string }
  | { kind: 'prompt'; name: string; projectId: string };

export class MarkdownEditorTargetError extends Error {
  constructor(
    readonly code: 'markdown_editor_target_not_found' | 'markdown_editor_target_ambiguous',
    readonly statusCode: 404 | 409,
  ) {
    super(code === 'markdown_editor_target_ambiguous'
      ? 'The Markdown file has multiple current owners.'
      : 'The Markdown file has no current registered owner.');
    this.name = 'MarkdownEditorTargetError';
  }
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)))
    : [];
}

function contained(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

function canonicalRegularFile(file: string, ownerRoot?: string): string | null {
  try {
    if (!existsSync(file) || lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile()) return null;
    const canonical = realpathSync(file);
    if (ownerRoot && !contained(realpathSync(ownerRoot), canonical)) return null;
    return canonical;
  } catch {
    return null;
  }
}

function readPersistedLedger(project: DecisionOsProject, ledgerFile: string): AnyRecord | null {
  try {
    const file = resolve(project.decisionOsRoot, ledgerFile.replace(/^\.decision-os\//, ''));
    if (!contained(realpathSync(project.decisionOsRoot), realpathSync(file))) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
  } catch {
    return null;
  }
}

function targetKey(target: MarkdownEditorTarget): string {
  if (target.kind === 'card') return `card:${target.projectId}:${target.ledgerId}:${target.cardId}`;
  if (target.kind === 'thread') return `thread:${target.projectId}:${target.ledgerId}:${target.cardId}:${target.threadId}`;
  if (target.kind === 'prompt') return `prompt:${target.projectId}:${target.name}`;
  return `skill:${target.source}:${target.projectId}:${target.name}`;
}

export function markdownEditorTargetLocation(target: MarkdownEditorTarget): string {
  if (target.kind === 'card') {
    return `/p/${encodeURIComponent(target.projectId)}/ledgers/${encodeURIComponent(target.ledgerId)}/cards/${encodeURIComponent(target.cardId)}?editor=markdown`;
  }
  if (target.kind === 'thread') {
    return `/p/${encodeURIComponent(target.projectId)}/ledgers/${encodeURIComponent(target.ledgerId)}/cards/${encodeURIComponent(target.cardId)}?thread=open`;
  }
  const query = new URLSearchParams({ editor: 'skill', name: target.name });
  query.set('projectId', target.projectId);
  return `/skills?${query.toString()}`;
}

export function resolveMarkdownEditorTarget(input: {
  targetPath: string;
  projects: readonly DecisionOsProject[];
  serverRoot: string;
  projectId?: string;
  readLedger?: (project: DecisionOsProject, ledgerId: string, ledgerFile: string) => AnyRecord | null;
}): MarkdownEditorTarget {
  const requested = resolve(input.targetPath);
  if (!isAbsolute(input.targetPath) || !requested.toLowerCase().endsWith('.md')) {
    throw new MarkdownEditorTargetError('markdown_editor_target_not_found', 404);
  }
  const canonicalTarget = canonicalRegularFile(requested);
  if (!canonicalTarget) throw new MarkdownEditorTargetError('markdown_editor_target_not_found', 404);

  const matches = new Map<string, MarkdownEditorTarget>();
  const add = (file: string | null, target: MarkdownEditorTarget, ownerRoot?: string): void => {
    if (!file) return;
    const canonical = canonicalRegularFile(file, ownerRoot);
    if (canonical === canonicalTarget) matches.set(targetKey(target), target);
  };
  const projects = input.projects.filter((project) => (
    project.available && (!input.projectId || project.id === input.projectId)
  ));

  for (const project of projects) {
    for (const ledger of project.ledgers) {
      const document = input.readLedger?.(project, ledger.id, ledger.ledgerFile)
        ?? readPersistedLedger(project, ledger.ledgerFile);
      if (!document) continue;
      const cards = records(document.cards);
      for (const card of cards) {
        const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
          ? card.comment as AnyRecord
          : {};
        add(
          resolveCardContentFile(project.decisionOsRoot, comment.contentFile),
          { kind: 'card', projectId: project.id, ledgerId: ledger.id, cardId: String(card.id ?? '') },
          project.decisionOsRoot,
        );
      }
      const cardIds = new Set(cards.map((card) => String(card.id ?? '')).filter(Boolean));
      const threadFiles = document.threadFiles && typeof document.threadFiles === 'object' && !Array.isArray(document.threadFiles)
        ? document.threadFiles as AnyRecord
        : {};
      for (const [threadId, contentFile] of Object.entries(threadFiles)) {
        const cardId = threadId.startsWith('thread-') ? threadId.slice('thread-'.length) : '';
        if (!cardId || !cardIds.has(cardId)) continue;
        add(
          resolveThreadContentFile(project.decisionOsRoot, contentFile),
          { kind: 'thread', projectId: project.id, ledgerId: ledger.id, cardId, threadId },
          project.decisionOsRoot,
        );
      }
    }

    for (const skill of scanCodexSkills({ workspaceRoot: project.root, serverRoot: input.serverRoot })) {
      add(skill.skillFile, {
        kind: 'skill',
        name: skill.name,
        source: skill.source,
        projectId: project.id,
      });
    }
    for (const prompt of scanPipelinePrompts(project.decisionOsRoot)) {
      add(prompt.skillFile, { kind: 'prompt', name: prompt.name, projectId: project.id }, project.decisionOsRoot);
    }
  }

  if (matches.size === 0) throw new MarkdownEditorTargetError('markdown_editor_target_not_found', 404);
  if (matches.size > 1) throw new MarkdownEditorTargetError('markdown_editor_target_ambiguous', 409);
  return [...matches.values()][0];
}
