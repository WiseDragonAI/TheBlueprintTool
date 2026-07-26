/**
 * WHAT: Produces causal successor writes for concurrent task values whose union is lossless.
 * WHY: Equivalent lifecycle refreshes and missing-versus-present artifact heads must converge without operator recovery.
 */
import { canonicalJson } from './task-current-state-codec.js';
import type {
  TaskCurrentEntity,
  TaskEntityChange,
  TaskExecutionArtifactHead,
  TaskExecutionArtifacts,
  TaskRegisterCandidate,
} from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;
type CardLifecycle = {
  status: 'todo' | 'backlog' | 'done';
  changedAt: string;
  waitingAt: string | null;
  closedAt: string | null;
};

const artifactKinds = ['jsonl', 'stderr', 'telemetry', 'result'] as const;

function exactKeys(value: AnyRecord, keys: string[]): boolean {
  return Object.keys(value).sort().join('\u0000') === keys.slice().sort().join('\u0000');
}

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function isoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function distinctSetValues(candidates: TaskRegisterCandidate[]): unknown[] | null {
  if (candidates.length < 2 || candidates.some((candidate) => candidate.operation !== 'set' || !Object.hasOwn(candidate, 'value'))) return null;
  const values = new Map<string, unknown>();
  for (const candidate of candidates) values.set(canonicalJson(candidate.value), candidate.value);
  return values.size > 1 ? [...values.values()] : null;
}

function cardLifecycle(value: unknown): CardLifecycle | null {
  const candidate = record(value);
  if (!candidate || !exactKeys(candidate, ['status', 'changedAt', 'waitingAt', 'closedAt'])) return null;
  const status = String(candidate.status ?? '');
  if (!['todo', 'backlog', 'done'].includes(status) || !isoTimestamp(candidate.changedAt)) return null;
  if (status === 'todo' && (!isoTimestamp(candidate.waitingAt) || candidate.closedAt !== null)) return null;
  if (status === 'backlog' && (candidate.waitingAt !== null || candidate.closedAt !== null)) return null;
  if (status === 'done' && (candidate.waitingAt !== null || !isoTimestamp(candidate.closedAt))) return null;
  return structuredClone(candidate) as CardLifecycle;
}

function resolvedCardLifecycle(candidates: TaskRegisterCandidate[]): CardLifecycle | null {
  const values = distinctSetValues(candidates)?.map(cardLifecycle) ?? [];
  if (values.length < 2 || values.some((value) => value === null)) return null;
  const lifecycles = values as CardLifecycle[];
  if (new Set(lifecycles.map((value) => value.status)).size !== 1) return null;
  return lifecycles.slice().sort((left, right) => (
    Date.parse(right.changedAt) - Date.parse(left.changedAt)
    || canonicalJson(right).localeCompare(canonicalJson(left))
  ))[0];
}

function artifactHead(value: unknown): TaskExecutionArtifactHead | null | undefined {
  if (value === null) return null;
  const candidate = record(value);
  if (!candidate || !exactKeys(candidate, ['hash', 'bytes', 'mediaType'])) return undefined;
  if (!/^[a-f0-9]{64}$/.test(String(candidate.hash ?? ''))
    || !Number.isSafeInteger(candidate.bytes) || Number(candidate.bytes) < 0
    || typeof candidate.mediaType !== 'string' || !candidate.mediaType) return undefined;
  return structuredClone(candidate) as TaskExecutionArtifactHead;
}

function executionArtifacts(value: unknown): TaskExecutionArtifacts | null {
  const candidate = record(value);
  if (!candidate || !exactKeys(candidate, [...artifactKinds, 'changedAt', 'revision'])
    || !isoTimestamp(candidate.changedAt)
    || !Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 1) return null;
  for (const kind of artifactKinds) if (artifactHead(candidate[kind]) === undefined) return null;
  return structuredClone(candidate) as TaskExecutionArtifacts;
}

function resolvedExecutionArtifacts(candidates: TaskRegisterCandidate[]): TaskExecutionArtifacts | null {
  const values = distinctSetValues(candidates)?.map(executionArtifacts) ?? [];
  if (values.length < 2 || values.some((value) => value === null)) return null;
  const artifacts = values as TaskExecutionArtifacts[];
  const merged = {} as Pick<TaskExecutionArtifacts, typeof artifactKinds[number]>;
  for (const kind of artifactKinds) {
    const nonNull = new Map<string, TaskExecutionArtifactHead>();
    for (const value of artifacts) {
      const head = value[kind];
      if (head) nonNull.set(canonicalJson(head), head);
    }
    // Two different immutable heads require an operator decision; absence never overrides evidence.
    if (nonNull.size > 1) return null;
    merged[kind] = nonNull.size === 1 ? structuredClone([...nonNull.values()][0]) : null;
  }
  return {
    ...merged,
    changedAt: artifacts.slice().sort((left, right) => Date.parse(right.changedAt) - Date.parse(left.changedAt))[0].changedAt,
    revision: Math.max(...artifacts.map((value) => value.revision)),
  };
}

export function mergeableTaskConflictChanges(entities: TaskCurrentEntity[]): TaskEntityChange[] {
  const changes: TaskEntityChange[] = [];
  for (const entity of entities) {
    const lifecycle = entity.entityType === 'card'
      ? resolvedCardLifecycle(entity.fields.lifecycle?.candidates ?? [])
      : null;
    if (lifecycle) {
      changes.push({
        entityType: 'card',
        entityId: entity.entityId,
        changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle }],
      });
    }
    const artifacts = entity.entityType === 'execution'
      ? resolvedExecutionArtifacts(entity.fields.artifacts?.candidates ?? [])
      : null;
    if (artifacts) {
      changes.push({
        entityType: 'execution',
        entityId: entity.entityId,
        changes: [{ path: 'artifacts', operation: 'set', value: artifacts }],
      });
    }
  }
  return changes;
}
