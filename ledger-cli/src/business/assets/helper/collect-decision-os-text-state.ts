import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { ClassifiedTextFile } from '../../../lib/types.js';
import { walkFiles } from './walk-files.js';
import { resolveWorkspacePath, workspaceRelativePath } from './workspace-paths.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

async function textFile(path: string, workspaceRoot: string, kind: ClassifiedTextFile['kind'], referencedBy: string[] = []): Promise<ClassifiedTextFile | null> {
  const resolved = resolveWorkspacePath(workspaceRoot, path);
  if (!resolved || !await exists(resolved)) return null;
  const stat = await fs.stat(resolved);
  return { path, bytes: stat.size, kind, referencedBy };
}

function normalizeDecisionOsPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const path = value.trim().replace(/^\.\//, '');
  if (path.startsWith('/.decision-os/')) return path.slice(1);
  if (path.startsWith('.decision-os/')) return path;
  return null;
}

function activeLedgerRefs(state: unknown): string[] {
  if (!isRecord(state) || !Array.isArray(state.tabs)) return [];
  return state.tabs
    .filter(isRecord)
    .map((tab) => normalizeDecisionOsPath(tab.ledgerFile))
    .filter((path): path is string => Boolean(path?.endsWith('.json')));
}

function referencedCardContentFiles(ledger: unknown): string[] {
  if (!isRecord(ledger) || !Array.isArray(ledger.cards)) return [];
  return ledger.cards
    .filter(isRecord)
    .map((card) => isRecord(card.comment) ? normalizeDecisionOsPath(card.comment.contentFile) : null)
    .filter((path): path is string => Boolean(path?.endsWith('.md')));
}

function referencedThreadContentFiles(ledger: unknown): string[] {
  if (!isRecord(ledger) || !isRecord(ledger.threadFiles)) return [];
  return Object.values(ledger.threadFiles)
    .map(normalizeDecisionOsPath)
    .filter((path): path is string => Boolean(path?.endsWith('.md')));
}

async function topLevelLedgerJsonFiles(workspaceRoot: string): Promise<string[]> {
  const decisionOsRoot = resolve(workspaceRoot, '.decision-os');
  if (!await exists(decisionOsRoot)) return [];
  const entries = await fs.readdir(decisionOsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('.'))
    .map((entry) => `.decision-os/${entry.name}`)
    .filter((path) => path !== '.decision-os/state.json');
}

export async function collectDecisionOsTextState(input: { domain?: string; workspaceRoot: string }): Promise<{
  activeLedgerFiles: string[];
  referencedTextFiles: ClassifiedTextFile[];
  sourceFiles: string[];
  unusedTextFiles: ClassifiedTextFile[];
}> {
  const statePath = resolve(input.workspaceRoot, '.decision-os/state.json');
  const state = await exists(statePath) ? await readJson(statePath) : { tabs: [] };
  const activeLedgers = activeLedgerRefs(state)
    .filter((path) => !input.domain || path === `.decision-os/${input.domain}.json`);
  const referencedTextFilePaths = new Map<string, { kind: ClassifiedTextFile['kind']; referencedBy: string[] }>();

  for (const ledgerRef of activeLedgers) {
    referencedTextFilePaths.set(ledgerRef, { kind: 'ledger-json', referencedBy: ['.decision-os/state.json'] });
    const ledgerPath = resolveWorkspacePath(input.workspaceRoot, ledgerRef);
    if (!ledgerPath || !await exists(ledgerPath)) continue;
    const ledger = await readJson(ledgerPath);
    for (const cardFile of referencedCardContentFiles(ledger)) {
      const entry = referencedTextFilePaths.get(cardFile) ?? { kind: 'card-markdown' as const, referencedBy: [] };
      entry.referencedBy.push(ledgerRef);
      referencedTextFilePaths.set(cardFile, entry);
    }
    for (const threadFile of referencedThreadContentFiles(ledger)) {
      const entry = referencedTextFilePaths.get(threadFile) ?? { kind: 'thread-markdown' as const, referencedBy: [] };
      entry.referencedBy.push(ledgerRef);
      referencedTextFilePaths.set(threadFile, entry);
    }
  }

  const referencedTextFiles = (await Promise.all(Array.from(referencedTextFilePaths.entries()).map(([path, entry]) => {
    return textFile(path, input.workspaceRoot, entry.kind, Array.from(new Set(entry.referencedBy)).sort());
  }))).filter((file): file is ClassifiedTextFile => Boolean(file));

  const sourceFiles = referencedTextFiles.map((file) => {
    const resolved = resolveWorkspacePath(input.workspaceRoot, file.path);
    return resolved ?? '';
  }).filter(Boolean).sort();

  const allLedgerFiles = input.domain ? [`.decision-os/${input.domain}.json`] : await topLevelLedgerJsonFiles(input.workspaceRoot);
  const markdownRoots = input.domain
    ? [resolve(input.workspaceRoot, '.decision-os/cards', input.domain), resolve(input.workspaceRoot, '.decision-os/threads', input.domain)]
    : [resolve(input.workspaceRoot, '.decision-os/cards'), resolve(input.workspaceRoot, '.decision-os/threads')];
  const allMarkdownFiles = (await Promise.all(markdownRoots.map((root) => walkFiles(root, (path) => path.endsWith('.md')))))
    .flat()
    .map((path) => workspaceRelativePath(input.workspaceRoot, path));

  const referencedSet = new Set(referencedTextFiles.map((file) => file.path));
  const unusedTextFiles = (await Promise.all([...allLedgerFiles, ...allMarkdownFiles]
    .filter((path) => !referencedSet.has(path))
    .map((path) => {
      const kind: ClassifiedTextFile['kind'] = path.endsWith('.json') ? 'ledger-json' : path.includes('/threads/') ? 'thread-markdown' : 'card-markdown';
      return textFile(path, input.workspaceRoot, kind);
    }))).filter((file): file is ClassifiedTextFile => Boolean(file))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    activeLedgerFiles: activeLedgers,
    referencedTextFiles,
    sourceFiles,
    unusedTextFiles,
  };
}
