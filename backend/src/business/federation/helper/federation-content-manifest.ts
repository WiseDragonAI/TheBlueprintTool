import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { resolveThreadContentFile } from '../../ledger/helper/thread-content-file.js';

type AnyRecord = Record<string, unknown>;
export type FederationContentResourceType = 'card-markdown' | 'thread-markdown' | 'managed-asset';
export type FederationContentManifestEntry = { type: FederationContentResourceType; key: string; hash: string; bytes: number; changedAt: string };
export type FederationContentManifest = { version: 1; projectId: string; generatedAt: string; resources: FederationContentManifestEntry[] };

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
  const sources = [...markdown.matchAll(/!\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g)].map((match) => match[1] ?? match[2] ?? '');
  return sources.flatMap((source) => {
    let decoded = source;
    try { decoded = decodeURIComponent(source); } catch { /* Keep the original source. */ }
    const normalized = decoded.split(/[?#]/)[0].replace(/^\//, '');
    if (!normalized.startsWith('.decision-os/')) return [];
    const file = resolve(decisionOsRoot, normalized.slice('.decision-os/'.length));
    if (!inside(decisionOsRoot, file) || !['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extname(file).toLowerCase()) || !existsSync(file)) return [];
    return [file];
  });
}

function entry(decisionOsRoot: string, file: string, type: FederationContentResourceType): FederationContentManifestEntry {
  const bytes = readFileSync(file);
  return { type, key: resourceKey(decisionOsRoot, file), hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength, changedAt: statSync(file).mtime.toISOString() };
}

export function buildFederationContentManifest(input: { projectId: string; decisionOsRoot: string; ledger: AnyRecord }): FederationContentManifest {
  const files = new Map<string, FederationContentResourceType>();
  for (const card of records(input.ledger.cards)) {
    const comment = card.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
    const file = resolveCardContentFile(input.decisionOsRoot, comment.contentFile);
    if (!file || !existsSync(file)) continue;
    files.set(file, 'card-markdown');
    for (const asset of assetFiles(input.decisionOsRoot, readFileSync(file, 'utf8'))) files.set(asset, 'managed-asset');
  }
  const threadFiles = input.ledger.threadFiles && typeof input.ledger.threadFiles === 'object' ? input.ledger.threadFiles as AnyRecord : {};
  for (const ref of Object.values(threadFiles)) {
    const file = resolveThreadContentFile(input.decisionOsRoot, ref);
    if (!file || !existsSync(file)) continue;
    files.set(file, 'thread-markdown');
    for (const asset of assetFiles(input.decisionOsRoot, readFileSync(file, 'utf8'))) files.set(asset, 'managed-asset');
  }
  return {
    version: 1,
    projectId: input.projectId,
    generatedAt: new Date().toISOString(),
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

