/**
 * WHAT: Hard-deletes a ledger through its parent canvas card.
 * WHY: Linked ledger cards own destructive ledger lifecycle in the parent canvas.
 */
import { existsSync, readdirSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { writeCanonicalDecisionOsState } from '../effect/write-canonical-decision-os-state.js';
import { readCanonicalDecisionOsState } from './read-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

const assetPattern = /(?:\/?\.decision-os\/)[A-Za-z0-9._/@:-]+/g;
const deletableExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.html', '.css', '.js', '.mjs', '.wav', '.webm', '.mp3', '.mp4']);

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return Boolean(path) && !path.startsWith('..') && !isAbsolute(path);
}

function readMarkdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const output: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...readMarkdownFiles(path));
    else if (entry.isFile() && path.endsWith('.md')) output.push(readFileSync(path, 'utf8'));
  }
  return output;
}

function referencedWorkspaceAssets(input: { decisionOsRoot: string; markdown: string[] }): string[] {
  const files = new Set<string>();
  for (const markdown of input.markdown) {
    for (const match of markdown.matchAll(assetPattern)) {
      const normalized = match[0].replace(/^\//, '').split(/[)"'\s#?]/)[0] ?? '';
      const relativePath = normalized.replace(/^\.decision-os\//, '');
      const file = resolve(input.decisionOsRoot, relativePath);
      if (isInside(input.decisionOsRoot, file) && deletableExtensions.has(extname(file).toLowerCase())) files.add(file);
    }
  }
  return [...files];
}

export function deleteLinkedLedger(input: {
  decisionOsRoot: string;
  cardId: string;
  overviewDocument: { cards?: AnyRecord[]; relationships?: AnyRecord[]; notes?: AnyRecord; threadFiles?: AnyRecord };
}): { ok: boolean; ledgerId?: string; error?: string } {
  const stateRead = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json'), writeBack: true } });
  const ledger = stateRead.ledgers.find((entry) => entry.cardId === input.cardId || `ledger-card:${entry.id}` === input.cardId);
  if (!ledger) return { ok: false, error: 'Linked ledger not found.' };
  const ledgerPath = resolve(input.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, ''));
  const cardsDir = resolve(input.decisionOsRoot, 'cards', ledger.id);
  const threadsDir = resolve(input.decisionOsRoot, 'threads', ledger.id);
  const assets = referencedWorkspaceAssets({ decisionOsRoot: input.decisionOsRoot, markdown: readMarkdownFiles(cardsDir).concat(readMarkdownFiles(threadsDir)) });

  if (existsSync(ledgerPath)) rmSync(ledgerPath, { force: true });
  if (existsSync(cardsDir)) rmSync(cardsDir, { recursive: true, force: true });
  if (existsSync(threadsDir)) rmSync(threadsDir, { recursive: true, force: true });
  for (const asset of assets) {
    if (existsSync(asset)) unlinkSync(asset);
  }

  writeCanonicalDecisionOsState({
    file: stateRead.file,
    ledgers: stateRead.ledgers.filter((entry) => entry.id !== ledger.id)
  });
  input.overviewDocument.cards = (input.overviewDocument.cards ?? []).filter((entry) => String(entry.id ?? '') !== input.cardId);
  input.overviewDocument.relationships = (input.overviewDocument.relationships ?? []).filter((entry) => {
    const source = String(entry.source ?? entry.from ?? '');
    const target = String(entry.target ?? entry.to ?? '');
    return source !== input.cardId && target !== input.cardId;
  });
  if (input.overviewDocument.notes && typeof input.overviewDocument.notes === 'object') delete input.overviewDocument.notes[`thread-${input.cardId}`];
  if (input.overviewDocument.threadFiles && typeof input.overviewDocument.threadFiles === 'object') delete input.overviewDocument.threadFiles[`thread-${input.cardId}`];
  return { ok: true, ledgerId: ledger.id };
}
