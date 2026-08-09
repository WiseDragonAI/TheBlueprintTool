/**
 * WHAT: Encodes relay-originated epoch-4 entity batches within count and byte transport ceilings.
 * WHY: Live forwarding and durable replay must use the same bounded frame contract as node publication.
 */
import { taskCurrentEntityKey, taskCurrentStateVersion } from '../../shared/task-current-state-core';
import type { RelayEntity } from './current-state';
import { maximumStateFrameBytes, type RelayFrame } from './protocol';
import { stateEntityBatchSize, type StateEntry } from './state-storage';

const encoder = new TextEncoder();

function frameFor(projectId: string, entries: StateEntry[], payload: Record<string, unknown> = {}, deliveryId = crypto.randomUUID()): RelayFrame {
  return {
    version: 1,
    type: 'state-entity-batch',
    from: 'relay',
    projectId,
    stateVersion: taskCurrentStateVersion,
    payload: { ...payload, stateVersion: taskCurrentStateVersion, deliveryId, entries },
  };
}

export function nextRepairStateEntityFrame(
  projectId: string,
  attemptId: string,
  remaining: Array<{ key: string; stateHash: string }>,
  entityForKey: (key: string) => RelayEntity | undefined,
): { frame: RelayFrame; consumed: number; encodedBytes: number; candidateCount: number } {
  const deliveryId = crypto.randomUUID();
  const payload = { attemptId };
  const emptyFrame = frameFor(projectId, [], payload, deliveryId);
  let encodedBytes = encoder.encode(JSON.stringify(emptyFrame)).byteLength;
  let candidateCount = 0;
  const entries: StateEntry[] = [];
  for (const retained of remaining) {
    const entity = entityForKey(retained.key);
    // WHAT: Reject a repair whose durable selection no longer resolves to its exact entity.
    // WHY: A partial or changed relay cut cannot converge to the advertised root.
    if (!entity || entity.stateHash !== retained.stateHash) throw new Error('missing_repair_entity');
    const entry = { key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity };
    const entryText = JSON.stringify(entry);
    // WHAT: Reject a non-JSON envelope before byte accounting.
    // WHY: The wire-size proof requires the exact serialized entry text.
    if (entryText === undefined) throw new Error('invalid_state_entity_envelope');
    candidateCount += 1;
    const candidateBytes = encodedBytes + encoder.encode(entryText).byteLength + (entries.length > 0 ? 1 : 0);
    // WHAT: Stop at the first later entry crossing the exact wire ceiling.
    // WHY: Repair ordering is a durable prefix and the remaining suffix stays retryable.
    if (entries.length > 0 && candidateBytes > maximumStateFrameBytes) break;
    // WHAT: Reject one entity that cannot fit in an independently admissible frame.
    // WHY: Epoch 4 does not permit splitting a causal entity across frames.
    if (candidateBytes > maximumStateFrameBytes) throw new Error('state_frame_too_large');
    entries.push(entry);
    encodedBytes = candidateBytes;
  }
  // WHAT: Reject an empty repair delivery before assigning window credit.
  // WHY: Every delivery ID must own at least one retained entity.
  if (entries.length === 0) throw new Error('empty_state_frame');
  const frame = frameFor(projectId, entries, payload, deliveryId);
  const finalBytes = encoder.encode(JSON.stringify(frame)).byteLength;
  // WHAT: Enforce the completed frame as the final byte-accounting authority.
  // WHY: Incremental accounting must never weaken the 512 KiB transport ceiling.
  if (finalBytes !== encodedBytes || finalBytes > maximumStateFrameBytes) throw new Error('state_frame_size_mismatch');
  return { frame, consumed: entries.length, encodedBytes, candidateCount };
}

export function nextStateEntityFrame(
  projectId: string,
  entities: RelayEntity[],
  options: { maximumEntities?: number; payload?: Record<string, unknown> } = {},
): { frame: RelayFrame; consumed: number } {
  const maximumEntities = options.maximumEntities ?? stateEntityBatchSize;
  let entries: StateEntry[] = [];
  for (const entity of entities) {
    const entry = { key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity };
    const candidate = [...entries, entry];
    const candidateFrame = frameFor(projectId, candidate, options.payload);
    const candidateBytes = encoder.encode(JSON.stringify(candidateFrame)).byteLength;
    // WHAT: Stop before the first entity that crosses the selected count or wire-byte ceiling.
    // WHY: Relay repair may use the byte ceiling while node publication retains its 128-entry limit.
    if (entries.length > 0 && (candidate.length > maximumEntities || candidateBytes > maximumStateFrameBytes)) break;
    // WHAT: Reject an entity that cannot fit inside one independently admissible frame.
    // WHY: Splitting one causal entity is outside the epoch-4 wire contract.
    if (candidateBytes > maximumStateFrameBytes) throw new Error('state_frame_too_large');
    entries = candidate;
  }
  // WHAT: Reject an empty frame request before assigning transport authority.
  // WHY: A delivery ID must always own at least one entity.
  if (entries.length === 0) throw new Error('empty_state_frame');
  return { frame: frameFor(projectId, entries, options.payload), consumed: entries.length };
}

export function stateEntityFrames(projectId: string, entities: RelayEntity[]): RelayFrame[] {
  const frames: RelayFrame[] = [];
  let offset = 0;
  while (offset < entities.length) {
    const next = nextStateEntityFrame(projectId, entities.slice(offset));
    frames.push(next.frame);
    offset += next.consumed;
  }
  return frames;
}
