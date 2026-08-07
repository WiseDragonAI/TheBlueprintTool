/**
 * WHAT: Exposes the shared epoch-4 entity algebra through the established backend import path.
 * WHY: Node, relay, migration, and tests must execute one validation, hashing, and join implementation.
 */
export {
  assertTaskCurrentEntity,
  clockCovers,
  dotKey,
  finalizeTaskCurrentEntity,
  hashTaskCurrentEntity,
  joinTaskClocks,
  joinTaskEntities,
  joinTaskRegisters,
  taskEntityDotCollisions,
} from '../../../../../shared/task-current-state-core.js';
