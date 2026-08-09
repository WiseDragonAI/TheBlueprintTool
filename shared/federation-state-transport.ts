/**
 * WHAT: Defines and validates additive epoch-4 terminal state-repair rejections.
 * WHY: Relay and nodes must agree on exact collision coordinates without exposing retained entity evidence on the wire.
 */
import { taskEntityTypes, type TaskCurrentDotCollision, type TaskRepairCollisionRejection } from './task-current-state-core.js';

export type FederationStateRejection = TaskRepairCollisionRejection;

const hashPattern = /^[a-f0-9]{64}$/;
const entityTypes = new Set<string>(taskEntityTypes);

function collisionSortKey(collision: TaskCurrentDotCollision): string {
  return `${collision.entityType}\u0000${collision.entityId}\u0000${collision.path}\u0000${collision.dot.replicaId}\u0000${String(collision.dot.counter).padStart(16, '0')}`;
}

export function normalizeFederationStateRejection(input: unknown): FederationStateRejection {
  // WHAT: Reject non-object and array inputs before reading the wire rejection fields.
  // WHY: Network admission must not coerce malformed envelopes into terminal repair authority.
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_federation_state_rejection');
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expectedKeys = ['code', 'collisions', 'key', 'receiverStateHash', 'stateHash'];
  // WHAT: Reject missing and additive unknown fields from the epoch-4 rejection object.
  // WHY: A strict object prevents participants from interpreting incompatible evidence differently.
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error('invalid_federation_state_rejection');
  // WHAT: Reject a non-collision code and malformed entity identity or hash coordinates.
  // WHY: Only an exact same-dot conflict may terminate a repair delivery through this contract.
  if (value.code !== 'task_current_dot_collision' || typeof value.key !== 'string' || !value.key.includes('\u0000')
    || typeof value.stateHash !== 'string' || !hashPattern.test(value.stateHash)
    || typeof value.receiverStateHash !== 'string' || !hashPattern.test(value.receiverStateHash)
    || !Array.isArray(value.collisions) || value.collisions.length < 1) throw new Error('invalid_federation_state_rejection');
  const collisions = value.collisions.map((candidate): TaskCurrentDotCollision => {
    // WHAT: Reject malformed collision coordinate containers.
    // WHY: Each coordinate must identify one independently verifiable causal candidate.
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid_federation_state_rejection');
    const collision = candidate as Record<string, unknown>;
    // WHAT: Reject collision coordinates with missing, extra, or invalid identity fields.
    // WHY: Canonical sorting and deduplication require one exact epoch-4 coordinate shape.
    if (JSON.stringify(Object.keys(collision).sort()) !== JSON.stringify(['dot', 'entityId', 'entityType', 'path'])
      || !entityTypes.has(String(collision.entityType ?? '')) || typeof collision.entityId !== 'string' || !collision.entityId
      || typeof collision.path !== 'string' || !collision.path || !collision.dot || typeof collision.dot !== 'object' || Array.isArray(collision.dot)) {
      throw new Error('invalid_federation_state_rejection');
    }
    const dot = collision.dot as Record<string, unknown>;
    // WHAT: Reject a malformed causal dot before normalizing its collision coordinate.
    // WHY: Replica identity and a positive safe counter are required to locate the conflicting candidate.
    if (JSON.stringify(Object.keys(dot).sort()) !== JSON.stringify(['counter', 'replicaId'])
      || typeof dot.replicaId !== 'string' || !dot.replicaId || !Number.isSafeInteger(dot.counter) || Number(dot.counter) < 1) {
      throw new Error('invalid_federation_state_rejection');
    }
    return { entityType: collision.entityType as TaskCurrentDotCollision['entityType'], entityId: collision.entityId, path: collision.path, dot: { replicaId: dot.replicaId, counter: Number(dot.counter) } };
  }).sort((left, right) => collisionSortKey(left).localeCompare(collisionSortKey(right)));
  // WHAT: Reject repeated collision coordinates after canonical ordering.
  // WHY: A stable unique list gives every participant the same rejection hash input and operator evidence.
  if (collisions.some((collision, index) => index > 0 && collisionSortKey(collision) === collisionSortKey(collisions[index - 1]))) {
    throw new Error('invalid_federation_state_rejection');
  }
  return { code: 'task_current_dot_collision', key: value.key, stateHash: value.stateHash, receiverStateHash: value.receiverStateHash, collisions };
}

export function assertFederationStateRejection(input: unknown): asserts input is FederationStateRejection {
  normalizeFederationStateRejection(input);
}
