/**
 * WHAT: Moves complete master-task zones from one Decision OS ledger to another.
 * WHY: Task identity belongs to the canonical tasks ledger without breaking card, thread, or run ownership.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import type { Result } from '../../../lib/types.js';

type JsonRecord = Record<string, any>;
type SidecarCopy = { from: string; to: string; content: string };
type MigrationReport = {
  cards: number;
  zones: number;
  relationships: number;
  cardFiles: number;
  threadFiles: number;
  missingCardFiles: string[];
  missingThreadFiles: string[];
  queueItems: number;
  pipelineRuns: number;
  sourceLedger: string;
  targetLedger: string;
  write: boolean;
  manifest: {
    cardIds: string[];
    zoneIds: string[];
    retainedSourceZoneIds: string[];
    relationshipIds: string[];
    cardFiles: Array<{ from: string; to: string }>;
    threadFiles: Array<{ from: string; to: string }>;
    queueItemIds: string[];
    pipelineRunIds: string[];
  };
};

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is JsonRecord => Boolean(entry) && typeof entry === 'object') : [];
}

function rect(entry: JsonRecord): { x: number; y: number; width: number; height: number } | null {
  const width = Number(entry.w ?? entry.width);
  const height = Number(entry.h ?? entry.height);
  if (![entry.x, entry.y, width, height].every((value) => Number.isFinite(Number(value)))) return null;
  return { x: Number(entry.x), y: Number(entry.y), width, height };
}

function overlapArea(left: JsonRecord, right: JsonRecord): number {
  const a = rect(left);
  const b = rect(right);
  if (!a || !b) return 0;
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function ownerZone(card: JsonRecord, zones: JsonRecord[]): JsonRecord | null {
  let owner: JsonRecord | null = null;
  let bestArea = 0;
  for (const zone of zones) {
    const area = overlapArea(card, zone);
    if (area > bestArea) {
      owner = zone;
      bestArea = area;
    }
  }
  return bestArea > 0 ? owner : null;
}

function atomicWrite(path: string, value: unknown): void {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

function decisionOsRoot(ledgerFile: string): string {
  return dirname(resolve(ledgerFile));
}

function ledgerId(ledgerFile: string): string {
  return resolve(ledgerFile).split('/').at(-1)!.replace(/\.json$/, '');
}

function referencedFile(root: string, reference: string): string {
  const relative = reference.replace(/^\.decision-os\//, '');
  return resolve(root, relative);
}

function isMasterTaskCard(root: string, card: JsonRecord): boolean {
  const labels = Array.isArray(card.labels) ? card.labels.map(String) : [];
  if (labels.includes('master-task')) return true;
  if (labels.includes('subtask')) return false;
  const reference = String(card.comment?.contentFile ?? '');
  const file = reference ? referencedFile(root, reference) : '';
  const markdown = file && existsSync(file) ? readFileSync(file, 'utf8') : String(card.comment?.what ?? '');
  const labelLines = markdown.split('\n').filter((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line));
  const legacyLabels = new Set(Array.from(labelLines.join('\n').matchAll(/#([a-z][a-z0-9-]*)\b/gi), (match) => match[1].toLowerCase()));
  return legacyLabels.has('master-task');
}

function replaceDomainReference(reference: string, fromId: string, toId: string, kind: 'cards' | 'threads'): string {
  const prefix = `.decision-os/${kind}/`;
  if (!reference.startsWith(prefix)) return reference.replace(`${prefix}${fromId}/`, `${prefix}${toId}/`);
  const relative = reference.slice(prefix.length);
  const separator = relative.indexOf('/');
  if (separator < 0) return reference;
  return `${prefix}${toId}/${relative.slice(separator + 1)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function recoverEmptyTargetSidecars(input: {
  root: string;
  target: JsonRecord;
  targetId: string;
  kind: 'cards' | 'threads';
}): Result<SidecarCopy[]> {
  const references = input.kind === 'cards'
    ? records(input.target.cards).map((card) => String(card.comment?.contentFile ?? '')).filter(Boolean)
    : Object.values(input.target.threadFiles && typeof input.target.threadFiles === 'object' ? input.target.threadFiles : {}).map(String).filter(Boolean);
  const domainRoot = resolve(input.root, input.kind);
  if (!existsSync(domainRoot)) return { ok: true, value: [] };
  const sourceDomains = readdirSync(domainRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== input.targetId)
    .map((entry) => resolve(domainRoot, entry.name));
  const copies: SidecarCopy[] = [];
  for (const reference of references) {
    const to = referencedFile(input.root, reference);
    if (existsSync(to) && readFileSync(to, 'utf8').length > 0) continue;
    const candidates = sourceDomains.map((directory) => resolve(directory, basename(reference)))
      .filter((file) => existsSync(file))
      .map((file) => ({ file, content: readFileSync(file, 'utf8') }))
      .filter((candidate) => candidate.content.length > 0);
    const contents = new Set(candidates.map((candidate) => candidate.content));
    if (contents.size > 1) return { ok: false, error: `Conflicting source sidecars for ${reference}.` };
    if (candidates[0]) copies.push({ from: candidates[0].file, to, content: candidates[0].content });
  }
  return { ok: true, value: copies };
}

export function migrateMasterTasks(input: { sourceLedger: string; targetLedger: string; write: boolean }): Result<MigrationReport> {
  const sourceFile = resolve(input.sourceLedger);
  const targetFile = resolve(input.targetLedger);
  const sourceRoot = decisionOsRoot(sourceFile);
  const targetRoot = decisionOsRoot(targetFile);
  if (sourceRoot !== targetRoot) return { ok: false, error: 'Source and target ledgers must share one Decision OS root.' };
  const sourceId = ledgerId(sourceFile);
  const targetId = ledgerId(targetFile);
  if (sourceId === targetId) return { ok: false, error: 'Source and target ledgers must be different.' };

  const sourceOriginal = JSON.parse(readFileSync(sourceFile, 'utf8')) as JsonRecord;
  const targetOriginal = JSON.parse(readFileSync(targetFile, 'utf8')) as JsonRecord;
  const source = clone(sourceOriginal);
  const target = clone(targetOriginal);
  const recoveredCards = recoverEmptyTargetSidecars({ root: sourceRoot, target, targetId, kind: 'cards' });
  if (!recoveredCards.ok) return recoveredCards;
  const recoveredThreads = recoverEmptyTargetSidecars({ root: sourceRoot, target, targetId, kind: 'threads' });
  if (!recoveredThreads.ok) return recoveredThreads;
  const cards = records(source.cards);
  const relationships = records(source.relationships);
  const zones = records(source.annotations).filter((entry) => String(entry.variant ?? 'zone') === 'zone');
  const cardsById = new Map(cards.map((card) => [String(card.id ?? ''), card]));
  const movedIds = new Set(cards.filter((card) => isMasterTaskCard(sourceRoot, card))
    .map((card) => String(card.id ?? '')));
  const masterIds = new Set(movedIds);
  if (movedIds.size === 0) {
    if (input.write) {
      const recoveryCopies = [...recoveredCards.value, ...recoveredThreads.value];
      const snapshots = new Map(recoveryCopies.map((copy) => [copy.to, existsSync(copy.to) ? readFileSync(copy.to, 'utf8') : null] as const));
      try {
        for (const copy of recoveryCopies) {
          mkdirSync(dirname(copy.to), { recursive: true });
          writeFileSync(copy.to, copy.content, 'utf8');
        }
      } catch (error) {
        for (const [file, content] of snapshots) {
          if (content === null) rmSync(file, { force: true });
          else writeFileSync(file, content, 'utf8');
        }
        return { ok: false, error: error instanceof Error ? error.message : 'Master-task sidecar recovery failed.' };
      }
      if (recoveredCards.value.length > 0 || recoveredThreads.value.length > 0) rmSync(resolve(sourceRoot, 'cache'), { recursive: true, force: true });
    }
    return { ok: true, value: {
    cards: 0,
    zones: 0,
    relationships: 0,
    cardFiles: recoveredCards.value.length,
    threadFiles: recoveredThreads.value.length,
    missingCardFiles: [],
    missingThreadFiles: [],
    queueItems: 0,
    pipelineRuns: 0,
    sourceLedger: sourceFile,
    targetLedger: targetFile,
    write: input.write,
    manifest: { cardIds: [], zoneIds: [], retainedSourceZoneIds: [], relationshipIds: [], cardFiles: [], threadFiles: [], queueItemIds: [], pipelineRunIds: [] },
  } };
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const relationship of relationships) {
      const from = String(relationship.from ?? '');
      const to = String(relationship.to ?? '');
      if (relationship.label === 'subtask' && movedIds.has(from) && !movedIds.has(to)) {
        movedIds.add(to);
        changed = true;
        continue;
      }
      const fromMoved = movedIds.has(from);
      const toMoved = movedIds.has(to);
      if (fromMoved === toMoved) continue;
      const executionCardId = fromMoved ? to : from;
      if (String(cardsById.get(executionCardId)?.cardType ?? '') === 'codex-skill-run') {
        movedIds.add(executionCardId);
        changed = true;
      }
    }
  }

  const movedCards = cards.filter((card) => movedIds.has(String(card.id ?? '')));
  // Geometry locates the master task's visual container only; it never grants task membership to another card.
  const movedZoneIds = new Set(cards.filter((card) => masterIds.has(String(card.id ?? '')))
    .map((card) => String(ownerZone(card, zones)?.id ?? '')).filter(Boolean));
  const retainedSourceZoneIds = new Set(cards.filter((card) => !movedIds.has(String(card.id ?? '')))
    .map((card) => String(ownerZone(card, zones)?.id ?? '')).filter((id) => movedZoneIds.has(id)));
  const crossRelationships = relationships.filter((relationship) => movedIds.has(String(relationship.from ?? '')) !== movedIds.has(String(relationship.to ?? '')));
  if (crossRelationships.length > 0) return { ok: false, error: `Migration would break ${crossRelationships.length} cross-ledger relationships.` };
  const movedRelationships = relationships.filter((relationship) => movedIds.has(String(relationship.from ?? '')) && movedIds.has(String(relationship.to ?? '')));
  const movedZones = records(source.annotations).filter((entry) => movedZoneIds.has(String(entry.id ?? '')));

  for (const [kind, entries] of [['card', movedCards], ['zone', movedZones], ['relationship', movedRelationships]] as const) {
    const targetIds = new Set(records(target[kind === 'card' ? 'cards' : kind === 'zone' ? 'annotations' : 'relationships']).map((entry) => String(entry.id ?? '')));
    const collision = entries.find((entry) => targetIds.has(String(entry.id ?? '')));
    if (collision) return { ok: false, error: `Target ${kind} id collision: ${String(collision.id ?? '')}` };
  }

  const cardCopies: SidecarCopy[] = [];
  const threadCopies: SidecarCopy[] = [];
  const missingCardFiles: string[] = [];
  const missingThreadFiles: string[] = [];
  for (const card of movedCards) {
    card.domainId = targetId;
    const reference = String(card.comment?.contentFile ?? '');
    if (reference) {
      const nextReference = replaceDomainReference(reference, sourceId, targetId, 'cards');
      const from = referencedFile(sourceRoot, reference);
      const to = referencedFile(sourceRoot, nextReference);
      if (existsSync(to)) return { ok: false, error: `Target card content already exists: ${nextReference}` };
      card.comment.contentFile = nextReference;
      if (existsSync(from)) cardCopies.push({ from, to, content: readFileSync(from, 'utf8') });
      else missingCardFiles.push(reference);
    }
    if (typeof card.codexRunOutputFile === 'string') {
      card.codexRunOutputFile = replaceDomainReference(card.codexRunOutputFile, sourceId, targetId, 'cards');
    }
  }

  const sourceThreadFiles = source.threadFiles && typeof source.threadFiles === 'object' ? source.threadFiles as Record<string, string> : {};
  const targetThreadFiles = target.threadFiles && typeof target.threadFiles === 'object' ? target.threadFiles as Record<string, string> : {};
  for (const cardId of movedIds) {
    const threadId = `thread-${cardId}`;
    const reference = sourceThreadFiles[threadId];
    if (!reference) continue;
    const nextReference = replaceDomainReference(reference, sourceId, targetId, 'threads');
    const from = referencedFile(sourceRoot, reference);
    const to = referencedFile(sourceRoot, nextReference);
    if (existsSync(to)) return { ok: false, error: `Target thread already exists: ${nextReference}` };
    if (targetThreadFiles[threadId]) return { ok: false, error: `Target thread id collision: ${threadId}` };
    targetThreadFiles[threadId] = nextReference;
    delete sourceThreadFiles[threadId];
    if (existsSync(from)) threadCopies.push({ from, to, content: readFileSync(from, 'utf8') });
    else missingThreadFiles.push(reference);
  }

  source.cards = cards.filter((card) => !movedIds.has(String(card.id ?? '')));
  source.annotations = records(source.annotations).filter((entry) => !movedZoneIds.has(String(entry.id ?? '')) || retainedSourceZoneIds.has(String(entry.id ?? '')));
  source.relationships = relationships.filter((relationship) => !movedIds.has(String(relationship.from ?? '')) && !movedIds.has(String(relationship.to ?? '')));
  target.cards = records(target.cards).concat(movedCards);
  target.annotations = records(target.annotations).concat(movedZones);
  target.relationships = records(target.relationships).concat(movedRelationships);
  source.threadFiles = sourceThreadFiles;
  target.threadFiles = targetThreadFiles;

  for (const key of ['notes', 'deletedNoteIds'] as const) {
    const sourceValues = source[key] && typeof source[key] === 'object' ? source[key] as Record<string, unknown> : {};
    const targetValues = target[key] && typeof target[key] === 'object' ? target[key] as Record<string, unknown> : {};
    for (const cardId of movedIds) {
      const threadId = `thread-${cardId}`;
      if (!(threadId in sourceValues)) continue;
      targetValues[threadId] = sourceValues[threadId];
      delete sourceValues[threadId];
    }
    source[key] = sourceValues;
    target[key] = targetValues;
  }
  source.selection = { cardId: '', cardIds: [], zoneId: '', zoneIds: [] };
  target.diagramSize = source.diagramSize ?? target.diagramSize;
  source.updatedAt = new Date().toISOString();
  target.updatedAt = source.updatedAt;

  const queueFile = resolve(sourceRoot, 'codex-process-queue.json');
  const pipelineFile = resolve(sourceRoot, 'codex-pipelines.json');
  const queueOriginal = existsSync(queueFile) ? JSON.parse(readFileSync(queueFile, 'utf8')) as JsonRecord : null;
  const queue = queueOriginal ? clone(queueOriginal) : null;
  let queueItems = 0;
  const queueItemIds: string[] = [];
  for (const [index, item] of records(queue?.items).entries()) {
    if (!movedIds.has(String(item.payload?.cardId ?? ''))) continue;
    item.payload.ledgerId = targetId;
    queueItems += 1;
    queueItemIds.push(String(item.id ?? item.payload?.runId ?? `queue:${index}`));
  }
  const pipelineOriginal = existsSync(pipelineFile) ? JSON.parse(readFileSync(pipelineFile, 'utf8')) as JsonRecord : null;
  const pipeline = pipelineOriginal ? clone(pipelineOriginal) : null;
  let pipelineRuns = 0;
  const pipelineRunIds: string[] = [];
  for (const [index, run] of records(pipeline?.runs).entries()) {
    if (!movedIds.has(String(run.sourceCardId ?? ''))) continue;
    run.ledgerId = targetId;
    pipelineRuns += 1;
    pipelineRunIds.push(String(run.id ?? run.runId ?? `pipeline:${index}`));
  }

  const report: MigrationReport = {
    cards: movedCards.length,
    zones: movedZones.length,
    relationships: movedRelationships.length,
    cardFiles: cardCopies.length + recoveredCards.value.length,
    threadFiles: threadCopies.length + recoveredThreads.value.length,
    missingCardFiles,
    missingThreadFiles,
    queueItems,
    pipelineRuns,
    sourceLedger: sourceFile,
    targetLedger: targetFile,
    write: input.write,
    manifest: {
      cardIds: [...movedIds].sort(),
      zoneIds: [...movedZoneIds].sort(),
      retainedSourceZoneIds: [...retainedSourceZoneIds].sort(),
      relationshipIds: movedRelationships.map((relationship) => String(relationship.id ?? '')).sort(),
      cardFiles: cardCopies.map((copy) => ({ from: copy.from, to: copy.to })),
      threadFiles: threadCopies.map((copy) => ({ from: copy.from, to: copy.to })),
      queueItemIds,
      pipelineRunIds,
    },
  };
  if (!input.write) return { ok: true, value: report };

  const createdFiles: string[] = [];
  const recoveredSnapshots = new Map([...recoveredCards.value, ...recoveredThreads.value]
    .map((copy) => [copy.to, existsSync(copy.to) ? readFileSync(copy.to, 'utf8') : null] as const));
  try {
    for (const copy of [...recoveredCards.value, ...recoveredThreads.value, ...cardCopies, ...threadCopies]) {
      const existed = existsSync(copy.to);
      mkdirSync(dirname(copy.to), { recursive: true });
      writeFileSync(copy.to, copy.content, 'utf8');
      if (!existed) createdFiles.push(copy.to);
    }
    atomicWrite(targetFile, target);
    atomicWrite(sourceFile, source);
    if (queue) atomicWrite(queueFile, queue);
    if (pipeline) atomicWrite(pipelineFile, pipeline);
    for (const copy of [...cardCopies, ...threadCopies]) rmSync(copy.from);
    rmSync(resolve(sourceRoot, 'cache'), { recursive: true, force: true });
  } catch (error) {
    atomicWrite(sourceFile, sourceOriginal);
    atomicWrite(targetFile, targetOriginal);
    if (queueOriginal) atomicWrite(queueFile, queueOriginal);
    if (pipelineOriginal) atomicWrite(pipelineFile, pipelineOriginal);
    for (const file of createdFiles) rmSync(file, { force: true });
    for (const [file, content] of recoveredSnapshots) {
      if (content === null) rmSync(file, { force: true });
      else writeFileSync(file, content, 'utf8');
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Master-task migration failed.' };
  }
  return { ok: true, value: report };
}
