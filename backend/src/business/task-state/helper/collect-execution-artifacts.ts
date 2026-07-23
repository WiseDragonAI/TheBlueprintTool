/**
 * WHAT: Removes bytes owned only by converged, retention-eligible session tombstones.
 * WHY: Causal deletion state must survive forever while its unreferenced process artifacts need a deliberate collection boundary.
 */
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { TaskCurrentEntity } from './task-current-state-types.js';
import type { TaskCurrentStateStore } from './task-current-state-store.js';
import { canonicalJson } from './task-current-state-codec.js';
import { createTaskCurrentStatePersistence } from './task-current-state-persistence.js';

type SelectedField = {
  conflict: boolean;
  operation: string;
  value: unknown;
};

export type ExecutionArtifactCollectionReport = {
  ok: true;
  projectId: string;
  nodeId: string;
  convergedRoot: string;
  eligibleBefore: string;
  eligibleSessionIds: string[];
  deletedObjectHashes: string[];
  retainedObjectHashes: string[];
  absentObjectHashes: string[];
  deletedRawFiles: string[];
  absentRawFiles: string[];
};

const hashPattern = /^[a-f0-9]{64}$/;
const safeSessionPattern = /^[a-zA-Z0-9._-]+$/;
const rawSuffixes = ['.jsonl', '.log', '.md', '.jsonl.telemetry.jsonl'] as const;

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return Boolean(path) && !path.startsWith('..') && !isAbsolute(path);
}

function selectedField(entity: TaskCurrentEntity, path: string): SelectedField {
  const effects = new Map<string, { operation: string; value: unknown }>();
  for (const candidate of entity.fields[path]?.candidates ?? []) {
    const value = Object.hasOwn(candidate, 'value') ? candidate.value : undefined;
    effects.set(`${candidate.operation}\u0000${value === undefined ? '' : canonicalJson(value)}`, {
      operation: candidate.operation,
      value,
    });
  }
  const selected = effects.size === 1 ? [...effects.values()][0] : null;
  return {
    conflict: effects.size > 1,
    operation: selected?.operation ?? '',
    value: selected?.value,
  };
}

function stringField(entity: TaskCurrentEntity, path: string): string {
  const field = selectedField(entity, path);
  if (field.conflict || field.operation !== 'set') throw new Error(`artifact_gc_session_field_conflict:${entity.entityId}:${path}`);
  return String(field.value ?? '');
}

function stringArrayField(entity: TaskCurrentEntity, path: string): string[] {
  const field = selectedField(entity, path);
  if (field.conflict || field.operation !== 'set' || !Array.isArray(field.value)) {
    throw new Error(`artifact_gc_session_field_conflict:${entity.entityId}:${path}`);
  }
  return field.value.map(String);
}

function artifactHashes(entity: TaskCurrentEntity): string[] {
  return (entity.fields.artifacts?.candidates ?? []).flatMap((candidate) => {
    if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object') return [];
    const value = candidate.value as Record<string, unknown>;
    return ['jsonl', 'stderr', 'telemetry', 'result'].flatMap((kind) => {
      const head = value[kind];
      if (!head || typeof head !== 'object') return [];
      const hash = String((head as Record<string, unknown>).hash ?? '').toLowerCase();
      return hashPattern.test(hash) ? [hash] : [];
    });
  });
}

function resourceHashes(entity: TaskCurrentEntity): string[] {
  return (entity.fields.head?.candidates ?? []).flatMap((candidate) => {
    if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object') return [];
    const hash = String((candidate.value as Record<string, unknown>).hash ?? '').toLowerCase();
    return hashPattern.test(hash) ? [hash] : [];
  });
}

function rawFiles(decisionOsRoot: string, sessionId: string): string[] {
  if (!safeSessionPattern.test(sessionId)) throw new Error(`artifact_gc_unsafe_session_id:${sessionId}`);
  const root = resolve(decisionOsRoot, 'runs', 'codex-skills');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => rawSuffixes.map((suffix) => resolve(root, entry.name, `${sessionId}${suffix}`)))
    .filter((file) => inside(root, file));
}

export async function collectExecutionArtifacts(input: {
  store: TaskCurrentStateStore;
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  eligibleBefore: string;
  convergedRoot: string;
}): Promise<ExecutionArtifactCollectionReport> {
  const cutoff = Date.parse(input.eligibleBefore);
  if (!Number.isFinite(cutoff)) throw new Error('artifact_gc_invalid_eligible_before');
  if (!hashPattern.test(input.convergedRoot)) throw new Error('artifact_gc_invalid_converged_root');
  if (!safeSessionPattern.test(input.nodeId)) throw new Error('artifact_gc_invalid_node_id');
  if (input.store.activeDelta().projectId !== input.projectId) throw new Error('artifact_gc_project_mismatch');
  if (input.store.diagnostics().journalCount !== 0) throw new Error('artifact_gc_journal_pending');
  await input.store.flush();
  const localRoot = input.store.rootHash();
  if (localRoot !== input.convergedRoot) throw new Error(`artifact_gc_root_mismatch:${localRoot}`);

  const entities = input.store.activeDelta().entities;
  const executions = new Map(
    entities.filter((entity) => entity.entityType === 'execution').map((entity) => [entity.entityId, entity]),
  );
  const eligibleSessions: Array<{ sessionId: string; executionIds: string[] }> = [];
  for (const entity of entities.filter((candidate) => (
    candidate.entityType === 'resource' && candidate.entityId.startsWith('codex-session:')
  ))) {
    const presence = selectedField(entity, '$entity');
    if (presence.conflict || presence.operation !== 'set') {
      throw new Error(`artifact_gc_session_presence_conflict:${entity.entityId}`);
    }
    if (stringField(entity, 'kind') !== 'codex-session-deletion') continue;
    const sessionId = stringField(entity, 'sessionId');
    if (!safeSessionPattern.test(sessionId)) throw new Error(`artifact_gc_unsafe_session_id:${sessionId}`);
    if (entity.entityId !== `codex-session:${sessionId}`) throw new Error(`artifact_gc_session_identity_mismatch:${entity.entityId}`);
    const deletedAt = stringField(entity, 'deletedAt');
    const deletedTimestamp = Date.parse(deletedAt);
    if (!Number.isFinite(deletedTimestamp)) throw new Error(`artifact_gc_invalid_deleted_at:${sessionId}`);
    if (deletedTimestamp > cutoff) continue;
    const executionIds = stringArrayField(entity, 'executionIds');
    if (executionIds.length === 0 || new Set(executionIds).size !== executionIds.length) {
      throw new Error(`artifact_gc_invalid_execution_ids:${sessionId}`);
    }
    for (const executionId of executionIds) {
      const execution = executions.get(executionId);
      if (!execution) throw new Error(`artifact_gc_execution_missing:${executionId}`);
      const presence = selectedField(execution, '$entity');
      if (presence.conflict || presence.operation !== 'tombstone') {
        throw new Error(`artifact_gc_execution_not_tombstoned:${executionId}`);
      }
    }
    eligibleSessions.push({ sessionId, executionIds });
  }

  const eligibleExecutionIds = new Set(eligibleSessions.flatMap((session) => session.executionIds));
  const retainedHashes = new Set<string>();
  for (const entity of entities) {
    if (entity.entityType === 'execution' && !eligibleExecutionIds.has(entity.entityId)) {
      for (const hash of artifactHashes(entity)) retainedHashes.add(hash);
    }
    if (entity.entityType === 'resource') {
      for (const hash of resourceHashes(entity)) retainedHashes.add(hash);
    }
  }
  const candidateHashes = new Set(
    [...eligibleExecutionIds].flatMap((executionId) => artifactHashes(executions.get(executionId)!)),
  );
  const orderedEligibleSessions = [...eligibleSessions].sort((left, right) => left.sessionId.localeCompare(right.sessionId));
  // WHAT: Resolve every raw target before deleting any object.
  // WHY: An unreadable run namespace must fail closed without producing a partially collected session.
  const rawTargets = orderedEligibleSessions.flatMap((session) => rawFiles(input.decisionOsRoot, session.sessionId));
  const persistence = createTaskCurrentStatePersistence(input.store.root);
  const deletedObjectHashes: string[] = [];
  const retainedObjectHashes: string[] = [];
  const absentObjectHashes: string[] = [];
  for (const hash of [...candidateHashes].sort()) {
    if (retainedHashes.has(hash)) {
      // WHAT: Keep bytes reachable from any non-eligible candidate.
      // WHY: Content addressing allows unrelated executions and resources to share the same object.
      retainedObjectHashes.push(hash);
      continue;
    }
    const file = resolve(input.store.root, 'objects', hash.slice(0, 2), hash);
    if (!existsSync(file)) {
      // WHAT: Treat an already absent eligible object as an idempotent result.
      // WHY: A prior collection attempt may have completed this unlink before interruption.
      absentObjectHashes.push(hash);
      continue;
    }
    await persistence.durableRemove(file);
    deletedObjectHashes.push(hash);
  }

  const deletedRawFiles: string[] = [];
  const absentRawFiles: string[] = [];
  for (const file of rawTargets) {
    const ref = relative(input.decisionOsRoot, file).replaceAll('\\', '/');
    if (!existsSync(file)) {
      // WHAT: Make raw-file collection retryable after partial process interruption.
      // WHY: Causal tombstones remain durable and may legitimately outlive already removed local files.
      absentRawFiles.push(ref);
      continue;
    }
    await persistence.durableRemove(file);
    deletedRawFiles.push(ref);
  }

  return {
    ok: true,
    projectId: input.projectId,
    nodeId: input.nodeId,
    convergedRoot: input.convergedRoot,
    eligibleBefore: new Date(cutoff).toISOString(),
    eligibleSessionIds: orderedEligibleSessions.map((session) => session.sessionId),
    deletedObjectHashes,
    retainedObjectHashes,
    absentObjectHashes,
    deletedRawFiles: deletedRawFiles.sort(),
    absentRawFiles: absentRawFiles.sort(),
  };
}
