/**
 * WHAT: Encodes relay-originated epoch-3 entity batches within count and byte transport ceilings.
 * WHY: Live forwarding and durable replay must use the same bounded frame contract as node publication.
 */
import { taskCurrentEntityKey, taskCurrentStateVersion } from '../../shared/task-current-state-core';
import type { RelayEntity } from './current-state';
import { maximumStateFrameBytes, type RelayFrame } from './protocol';
import { stateEntityBatchSize, type StateEntry } from './state-storage';

const encoder = new TextEncoder();

export function stateEntityFrames(projectId: string, entities: RelayEntity[]): RelayFrame[] {
  const frameFor = (entries: StateEntry[]): RelayFrame => ({
    version: 1,
    type: 'state-entity-batch',
    from: 'relay',
    projectId,
    stateVersion: taskCurrentStateVersion,
    payload: { stateVersion: taskCurrentStateVersion, deliveryId: crypto.randomUUID(), entries },
  });
  const frames: RelayFrame[] = [];
  let entries: StateEntry[] = [];
  for (const entity of entities) {
    const entry = { key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity };
    const candidate = [...entries, entry];
    const candidateBytes = encoder.encode(JSON.stringify(frameFor(candidate))).byteLength;
    // WHAT: Complete the current frame before either transport ceiling is crossed.
    // WHY: Every emitted frame must remain independently admissible by a receiving node.
    if (entries.length > 0 && (candidate.length > stateEntityBatchSize || candidateBytes > maximumStateFrameBytes)) {
      frames.push(frameFor(entries));
      entries = [entry];
    } else {
      entries = candidate;
    }
    if (encoder.encode(JSON.stringify(frameFor(entries))).byteLength > maximumStateFrameBytes) throw new Error('state_frame_too_large');
  }
  if (entries.length > 0) frames.push(frameFor(entries));
  return frames;
}
