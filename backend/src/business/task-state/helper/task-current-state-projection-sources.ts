/**
 * WHAT: Converts projection-only node captures into explicit epoch-4 migration contributions.
 * WHY: A writable legacy node may expose a complete projection and content manifest without epoch-2 current shards.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import type { FederationContentManifest, FederationContentManifestEntry } from '../../federation/helper/federation-content-manifest.js';
import { buildFederationContentManifest } from '../../federation/helper/federation-content-manifest.js';
import { parseThreadMarkdown } from '../../ledger/helper/thread-content-file.js';
import { taskCurrentBaselineChanges } from './task-current-state-baseline.js';
import { finalizeTaskCurrentEntity } from './task-current-state-join.js';
import { prepareTaskCurrentStateMigration } from './prepare-task-current-state-migration.js';
import { taskCurrentStateVersion, taskEntityTypes, type TaskCurrentEntity, type TaskProjectionConflict } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;
type ProjectionDocument = { projectId?: string; sourceNodeId?: string; ledger?: AnyRecord; conflicts?: TaskProjectionConflict[] };
export type ProjectionSourceContent = { key: string; bytes: Buffer };
export type PreparedProjectionSource = {
  sourceNodeId: string;
  ledger: AnyRecord;
  conflicts: TaskProjectionConflict[];
  entities: TaskCurrentEntity[];
  resourceEntities: TaskCurrentEntity[];
  content: ProjectionSourceContent[];
  sourceEntityCount: number;
};

function hasCurrentEntities(stateRoot: string): boolean {
  return taskEntityTypes.some((entityType) => {
    const directory = resolve(stateRoot, 'current', entityType);
    return existsSync(directory) && readdirSync(directory).some((name) => name.endsWith('.json'));
  });
}

function sourceDecisionOsRoot(stateRoot: string): string {
  const taskStateRoot = dirname(stateRoot);
  if (basename(taskStateRoot) !== 'task-state') throw new Error(`projection_source_must_be_under_task_state:${stateRoot}`);
  return dirname(taskStateRoot);
}

function manifestFor(stateRoot: string, decisionOsRoot: string, projectId: string, ledger: AnyRecord): FederationContentManifest {
  const manifestFile = resolve(stateRoot, 'content-manifest.json');
  const manifest = existsSync(manifestFile)
    ? JSON.parse(readFileSync(manifestFile, 'utf8')) as FederationContentManifest
    : buildFederationContentManifest({ projectId, decisionOsRoot, ledger });
  if (manifest.version !== 1 || manifest.projectId !== projectId || manifest.complete !== true || !Array.isArray(manifest.resources)) throw new Error(`invalid_projection_content_manifest:${stateRoot}`);
  const keys = new Set<string>();
  for (const resource of manifest.resources) {
    if (!resource || !['card-markdown', 'thread-markdown', 'managed-asset'].includes(resource.type) || !Number.isInteger(resource.bytes) || resource.bytes < 0 || !Number.isFinite(Date.parse(resource.changedAt))) throw new Error(`invalid_projection_content_resource:${stateRoot}`);
    if (keys.has(resource.key)) throw new Error(`duplicate_projection_content_key:${resource.key}`);
    keys.add(resource.key);
  }
  const cards = Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [];
  const required = cards.flatMap((card) => {
    const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment) ? card.comment as AnyRecord : {};
    const ref = String(comment.contentFile ?? '');
    return ref ? [ref.replace(/^\//, '')] : [];
  });
  const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles) ? ledger.threadFiles as AnyRecord : {};
  required.push(...Object.values(threadFiles).map(String).filter(Boolean).map((ref) => ref.replace(/^\//, '')));
  for (const key of required) if (!keys.has(key)) throw new Error(`missing_projection_content_resource:${key}`);
  return manifest;
}

function resourceBytes(stateRoot: string, decisionOsRoot: string, resource: FederationContentManifestEntry): Buffer {
  if (!/^[a-f0-9]{64}$/.test(resource.hash)) throw new Error(`invalid_projection_content_hash:${resource.hash}:${resource.key}`);
  const object = resolve(stateRoot, 'objects', resource.hash.slice(0, 2), resource.hash);
  const source = resolve(decisionOsRoot, resource.key.replace(/^\/?\.decision-os\//, ''));
  const inner = relative(decisionOsRoot, source);
  if (!/^\/?\.decision-os\//.test(resource.key) || !inner || inner.startsWith('..') || isAbsolute(inner)) throw new Error(`invalid_projection_content_key:${resource.key}`);
  const bytes = existsSync(object) ? readFileSync(object) : existsSync(source) ? readFileSync(source) : null;
  if (!bytes) throw new Error(`missing_projection_content_object:${resource.hash}:${resource.key}`);
  if (createHash('sha256').update(bytes).digest('hex') !== resource.hash) throw new Error(`invalid_projection_content_object:${resource.hash}:${resource.key}`);
  return bytes;
}

function sourceEntity(input: { projectId: string; sourceNodeId: string; entityType: TaskCurrentEntity['entityType']; entityId: string; changes: Array<{ path: string; operation: 'set' | 'remove' | 'add' | 'tombstone'; value?: unknown }> }): TaskCurrentEntity {
  const replicaId = input.sourceNodeId;
  const clock = { [replicaId]: 1 };
  const changes = input.changes.some((change) => change.path === '$entity')
    ? input.changes
    : [{ path: '$entity', operation: 'set' as const, value: true }, ...input.changes];
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: input.projectId,
    entityType: input.entityType,
    entityId: input.entityId,
    fields: Object.fromEntries(changes.map((change) => [change.path, {
      clock,
      candidates: [{ dot: { replicaId, counter: 1 }, operation: change.operation, ...(Object.hasOwn(change, 'value') ? { value: structuredClone(change.value) } : {}) }],
    }])),
  });
}

function hydrateNotes(ledger: AnyRecord, content: Map<string, Buffer>): void {
  const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles) ? ledger.threadFiles as AnyRecord : {};
  const notes = ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? ledger.notes as AnyRecord : {};
  for (const [threadId, rawRef] of Object.entries(threadFiles)) {
    const bytes = content.get(String(rawRef).replace(/^\//, ''));
    if (bytes) notes[threadId] = parseThreadMarkdown(bytes.toString('utf8'));
  }
  ledger.notes = notes;
}

function mergeRecords(target: AnyRecord, source: AnyRecord, collection: 'cards' | 'annotations' | 'relationships'): void {
  const values = Array.isArray(target[collection]) ? target[collection] as AnyRecord[] : [];
  const known = new Set(values.map((entry) => String(entry.id ?? '')));
  for (const entry of Array.isArray(source[collection]) ? source[collection] as AnyRecord[] : []) {
    const id = String(entry.id ?? '');
    if (id && !known.has(id)) { values.push(structuredClone(entry)); known.add(id); }
  }
  target[collection] = values;
}

/** Adds source facts without treating an omitted projection value as a deletion. */
export function mergeProjectionSourceLedger(target: AnyRecord, source: AnyRecord): void {
  for (const collection of ['cards', 'annotations', 'relationships'] as const) mergeRecords(target, source, collection);
  for (const mapping of ['threadFiles'] as const) {
    const left = target[mapping] && typeof target[mapping] === 'object' && !Array.isArray(target[mapping]) ? target[mapping] as AnyRecord : {};
    const right = source[mapping] && typeof source[mapping] === 'object' && !Array.isArray(source[mapping]) ? source[mapping] as AnyRecord : {};
    for (const [key, value] of Object.entries(right)) if (!Object.hasOwn(left, key)) left[key] = structuredClone(value);
    target[mapping] = left;
  }
  const targetNotes = target.notes && typeof target.notes === 'object' && !Array.isArray(target.notes) ? target.notes as Record<string, AnyRecord[]> : {};
  const sourceNotes = source.notes && typeof source.notes === 'object' && !Array.isArray(source.notes) ? source.notes as Record<string, AnyRecord[]> : {};
  for (const [threadId, rawNotes] of Object.entries(sourceNotes)) {
    const current = Array.isArray(targetNotes[threadId]) ? targetNotes[threadId] : [];
    const known = new Set(current.map((note) => String(note.id ?? '')));
    for (const note of Array.isArray(rawNotes) ? rawNotes : []) {
      const id = String(note.id ?? '');
      if (id && !known.has(id)) { current.push(structuredClone(note)); known.add(id); }
    }
    targetNotes[threadId] = current;
  }
  target.notes = targetNotes;
  const targetDeleted = target.deletedNoteIds && typeof target.deletedNoteIds === 'object' && !Array.isArray(target.deletedNoteIds) ? target.deletedNoteIds as Record<string, string[]> : {};
  const sourceDeleted = source.deletedNoteIds && typeof source.deletedNoteIds === 'object' && !Array.isArray(source.deletedNoteIds) ? source.deletedNoteIds as Record<string, string[]> : {};
  for (const [threadId, ids] of Object.entries(sourceDeleted)) targetDeleted[threadId] = [...new Set([...(targetDeleted[threadId] ?? []), ...(Array.isArray(ids) ? ids.map(String) : [])])].sort();
  target.deletedNoteIds = targetDeleted;
  const owned = new Set(['cards', 'annotations', 'relationships', 'threadFiles', 'notes', 'deletedNoteIds']);
  for (const [path, value] of Object.entries(source)) if (!owned.has(path) && target[path] === undefined) target[path] = structuredClone(value);
}

export function prepareProjectionSources(input: { stateRoots: string[]; projectId: string; decisionOsRoot: string; defaultAssignedNodeId: string }): PreparedProjectionSource[] {
  const sources = input.stateRoots.flatMap((stateRoot, sourceIndex): PreparedProjectionSource[] => {
    const projectionFile = resolve(stateRoot, 'projection.json');
    if (!existsSync(projectionFile) || hasCurrentEntities(stateRoot)) return [];
    const document = JSON.parse(readFileSync(projectionFile, 'utf8')) as ProjectionDocument;
    if (document.projectId && document.projectId !== input.projectId) throw new Error(`projection_source_project_mismatch:${stateRoot}`);
    if (!document.ledger || typeof document.ledger !== 'object') throw new Error(`invalid_projection_source:${stateRoot}`);
    const nodeId = String(document.sourceNodeId ?? `projection-${sourceIndex}`).replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!nodeId) throw new Error(`invalid_projection_source_node_id:${stateRoot}`);
    const decisionOsRoot = sourceDecisionOsRoot(stateRoot);
    const manifest = manifestFor(stateRoot, decisionOsRoot, input.projectId, document.ledger);
    const originalContent = new Map(manifest.resources.map((resource) => [resource.key, resourceBytes(stateRoot, decisionOsRoot, resource)]));
    const hydrated = structuredClone(document.ledger);
    hydrateNotes(hydrated, originalContent);
    const prepared = prepareTaskCurrentStateMigration({
      decisionOsRoot: input.decisionOsRoot,
      ledger: hydrated,
      defaultAssignedNodeId: input.defaultAssignedNodeId,
      readContent: (ref) => originalContent.get(ref.replace(/^\//, ''))?.toString('utf8') ?? null,
      deferRelationshipValidation: true,
    });
    const rewrites = new Map(prepared.bodyRewrites.map((rewrite) => [rewrite.contentFile, Buffer.from(rewrite.after)]));
    const content = manifest.resources.map((resource) => ({ key: resource.key, bytes: rewrites.get(resource.key) ?? originalContent.get(resource.key)! }));
    const subtaskRelationships = new Set((Array.isArray(prepared.ledger.relationships) ? prepared.ledger.relationships as AnyRecord[] : []).filter((entry) => entry.label === 'subtask').map((entry) => String(entry.id ?? '')));
    const entities = taskCurrentBaselineChanges(prepared.ledger).map((change) => ({
      ...change,
      entityId: change.entityType === 'ledger' ? `${change.entityId}:${change.changes[0]?.path ?? ''}` : change.entityId,
      changes: change.entityType === 'relationship' && subtaskRelationships.has(change.entityId) ? change.changes.filter((field) => field.path !== 'position') : change.changes,
    })).filter((change) => change.changes.length > 0).map((change) => sourceEntity({ projectId: input.projectId, sourceNodeId: nodeId, ...change }));
    const resourceEntities = manifest.resources.map((resource) => {
      const bytes = rewrites.get(resource.key) ?? originalContent.get(resource.key)!;
      const hash = createHash('sha256').update(bytes).digest('hex');
      return sourceEntity({ projectId: input.projectId, sourceNodeId: nodeId, entityType: 'resource', entityId: resource.key, changes: [{ path: 'head', operation: 'set', value: { ...resource, hash, bytes: bytes.byteLength } }] });
    });
    return [{ sourceNodeId: nodeId, ledger: prepared.ledger, conflicts: document.conflicts ?? [], entities, resourceEntities, content, sourceEntityCount: entities.length }];
  });
  const nodeIds = new Set<string>();
  for (const source of sources) {
    if (nodeIds.has(source.sourceNodeId)) throw new Error(`duplicate_projection_source_node_id:${source.sourceNodeId}`);
    nodeIds.add(source.sourceNodeId);
  }
  return sources;
}
