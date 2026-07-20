import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, resolveThreadContentFile } from '../../ledger/helper/thread-content-file.js';

type AnyRecord = Record<string, unknown>;
export type FederationContentResourceType = 'card-markdown' | 'thread-markdown' | 'managed-asset';
export type FederationContentManifestEntry = { type: FederationContentResourceType; key: string; hash: string; bytes: number; changedAt: string };
export type FederationContentManifest = { version: 1; projectId: string; generatedAt: string; complete?: boolean; resources: FederationContentManifestEntry[] };

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function inside(parent: string, file: string): boolean {
  const path = relative(parent, file);
  return Boolean(path) && !path.startsWith('..') && !isAbsolute(path);
}

function resourceKey(decisionOsRoot: string, file: string): string {
  return `.decision-os/${relative(decisionOsRoot, file).replaceAll('\\', '/')}`;
}

function assetFiles(decisionOsRoot: string, markdown: string): string[] {
  const sources = [...markdown.matchAll(/!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g)].map((match) => match[1] ?? match[2] ?? '');
  return sources.flatMap((source) => {
    let decoded = source;
    try { decoded = decodeURIComponent(source); } catch { /* Keep the original source. */ }
    const normalized = decoded.split(/[?#]/)[0].replace(/^\//, '');
    if (!normalized.startsWith('.decision-os/')) return [];
    const file = resolve(decisionOsRoot, normalized.slice('.decision-os/'.length));
    if (!inside(decisionOsRoot, file) || !existsSync(file)) return [];
    return [file];
  });
}

function voiceFiles(decisionOsRoot: string, markdown: string): string[] {
  return parseThreadMarkdown(markdown).flatMap((note) => {
    const source = String(note.voiceFileRef ?? '');
    if (!source) return [];
    const file = isAbsolute(source) ? resolve(source) : resolve(decisionOsRoot, source.replace(/^\/?\.decision-os\//, ''));
    return inside(decisionOsRoot, file) && existsSync(file) ? [file] : [];
  });
}

function entry(decisionOsRoot: string, file: string, type: FederationContentResourceType): FederationContentManifestEntry {
  const bytes = readFileSync(file);
  return { type, key: resourceKey(decisionOsRoot, file), hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength, changedAt: statSync(file).mtime.toISOString() };
}

export function buildFederationContentManifest(input: { projectId: string; decisionOsRoot: string; ledger?: AnyRecord; ledgers?: AnyRecord[] }): FederationContentManifest {
  const files = new Map<string, FederationContentResourceType>();
  for (const ledger of input.ledgers ?? (input.ledger ? [input.ledger] : [])) {
    for (const card of records(ledger.cards)) {
      const comment = card.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
      const file = resolveCardContentFile(input.decisionOsRoot, comment.contentFile);
      if (!file || !existsSync(file)) continue;
      files.set(file, 'card-markdown');
      for (const asset of assetFiles(input.decisionOsRoot, readFileSync(file, 'utf8'))) files.set(asset, 'managed-asset');
    }
    const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' ? ledger.threadFiles as AnyRecord : {};
    for (const ref of Object.values(threadFiles)) {
      const file = resolveThreadContentFile(input.decisionOsRoot, ref);
      if (!file || !existsSync(file)) continue;
      files.set(file, 'thread-markdown');
      const markdown = readFileSync(file, 'utf8');
      for (const asset of [...assetFiles(input.decisionOsRoot, markdown), ...voiceFiles(input.decisionOsRoot, markdown)]) files.set(asset, 'managed-asset');
    }
  }
  return {
    version: 1,
    projectId: input.projectId,
    generatedAt: new Date().toISOString(),
    complete: true,
    resources: [...files].map(([file, type]) => entry(input.decisionOsRoot, file, type)).sort((left, right) => left.key.localeCompare(right.key)),
  };
}

export function readManifestResource(input: { decisionOsRoot: string; manifest: FederationContentManifest; hash: string }): Buffer | null {
  const resource = input.manifest.resources.find((entry) => entry.hash === input.hash);
  if (!resource) return null;
  const file = resolve(input.decisionOsRoot, resource.key.replace(/^\.decision-os\//, ''));
  if (!inside(input.decisionOsRoot, file) || !existsSync(file)) return null;
  const bytes = readFileSync(file);
  return createHash('sha256').update(bytes).digest('hex') === resource.hash ? bytes : null;
}
