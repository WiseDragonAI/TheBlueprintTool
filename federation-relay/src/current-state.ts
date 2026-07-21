/**
 * WHAT: Joins and validates causal current-state entities inside the federation relay.
 * WHY: Relay durability must use the same delivery-order-independent algebra as application nodes.
 */
export type RelayClock = Record<string, number>;
export type RelayCandidate = { dot: { replicaId: string; counter: number }; operation: string; value?: unknown };
export type RelayRegister = { clock: RelayClock; candidates: RelayCandidate[] };
export type RelayEntity = {
  version: 2;
  projectId: string;
  entityType: string;
  entityId: string;
  fields: Record<string, RelayRegister>;
  activationTaskId?: string;
  replication: 'active' | 'held';
  stateHash: string;
};

const entityTypes = new Set(['ledger', 'card', 'annotation', 'relationship', 'resource', 'thread-note']);
const fieldOperations = new Set(['set', 'add', 'remove', 'tombstone']);
const unsafePathSegments = new Set(['__proto__', 'prototype', 'constructor']);

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function dotKey(candidate: RelayCandidate): string {
  return `${candidate.dot.replicaId}\u0000${String(candidate.dot.counter).padStart(16, '0')}`;
}

function covers(clock: RelayClock, candidate: RelayCandidate): boolean {
  return (clock[candidate.dot.replicaId] ?? 0) >= candidate.dot.counter;
}

function joinClock(left: RelayClock, right: RelayClock): RelayClock {
  const result = { ...left };
  for (const [replicaId, counter] of Object.entries(right)) result[replicaId] = Math.max(result[replicaId] ?? 0, counter);
  return result;
}

function joinRegister(left: RelayRegister, right: RelayRegister): RelayRegister {
  const a = new Map(left.candidates.map((candidate) => [dotKey(candidate), candidate]));
  const b = new Map(right.candidates.map((candidate) => [dotKey(candidate), candidate]));
  const retained = new Map<string, RelayCandidate>();
  for (const [key, candidate] of a) if (b.has(key) || !covers(right.clock, candidate)) retained.set(key, structuredClone(candidate));
  for (const [key, candidate] of b) if (a.has(key) || !covers(left.clock, candidate)) retained.set(key, structuredClone(candidate));
  return { clock: joinClock(left.clock, right.clock), candidates: [...retained.values()].sort((x, y) => dotKey(x).localeCompare(dotKey(y))) };
}

async function hashEntity(entity: RelayEntity): Promise<string> {
  const { stateHash: _stateHash, ...body } = entity;
  return digest(canonical(body));
}

export async function assertRelayEntity(entity: RelayEntity, projectId: string): Promise<void> {
  if (entity?.version !== 2 || entity.projectId !== projectId || !entityTypes.has(entity.entityType) || !entity.entityId || entity.replication !== 'active') throw new Error('invalid_state_entity');
  if (!entity.fields || typeof entity.fields !== 'object' || Array.isArray(entity.fields) || !/^[a-f0-9]{64}$/.test(entity.stateHash)) throw new Error('invalid_state_entity');
  for (const [path, register] of Object.entries(entity.fields)) {
    if (!path || path.split('/').some((segment) => unsafePathSegments.has(segment))) throw new Error('invalid_state_path');
    if (!register || !register.clock || !Array.isArray(register.candidates)) throw new Error('invalid_state_register');
    for (const [replicaId, counter] of Object.entries(register.clock)) {
      if (!replicaId || !Number.isSafeInteger(counter) || counter < 0) throw new Error('invalid_state_clock');
    }
    for (const candidate of register.candidates) {
      if (!candidate.dot?.replicaId || !Number.isSafeInteger(candidate.dot.counter) || candidate.dot.counter < 1) throw new Error('invalid_state_dot');
      if (!fieldOperations.has(candidate.operation) || !covers(register.clock, candidate)) throw new Error('invalid_state_candidate');
    }
  }
  if (await hashEntity(entity) !== entity.stateHash) throw new Error('invalid_state_entity_hash');
}

export async function joinRelayEntity(left: RelayEntity | undefined, right: RelayEntity): Promise<RelayEntity> {
  if (!left) return structuredClone(right);
  if (left.projectId !== right.projectId || left.entityType !== right.entityType || left.entityId !== right.entityId) throw new Error('state_entity_identity_collision');
  const fields: Record<string, RelayRegister> = {};
  for (const path of [...new Set([...Object.keys(left.fields), ...Object.keys(right.fields)])].sort()) {
    const a = left.fields[path];
    const b = right.fields[path];
    fields[path] = a && b ? joinRegister(a, b) : structuredClone(a ?? b!);
  }
  const joined: RelayEntity = { ...left, fields, replication: 'active', stateHash: '' };
  joined.stateHash = await hashEntity(joined);
  return joined;
}
