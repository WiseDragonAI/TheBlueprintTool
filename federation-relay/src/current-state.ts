/**
 * WHAT: Exposes the shared epoch-3 entity algebra to the Cloudflare relay.
 * WHY: The relay must validate, hash, and join entities with the exact node implementation.
 */
import {
  assertTaskCurrentEntity,
  joinTaskEntities,
  type TaskCurrentEntity,
} from '../../shared/task-current-state-core.js';

export type RelayEntity = TaskCurrentEntity;

export function assertRelayEntity(entity: RelayEntity, projectId: string): void {
  if (entity.projectId !== projectId) throw new Error('invalid_state_project');
  assertTaskCurrentEntity(entity);
}

export function joinRelayEntity(left: RelayEntity | undefined, right: RelayEntity): RelayEntity {
  return joinTaskEntities(left, right);
}
