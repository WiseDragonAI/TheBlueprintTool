/**
 * WHAT: Exposes the complete platform-neutral epoch-3 task CRDT contract.
 * WHY: Nodes, relay, migration, and tests need one stable import boundary.
 */
export * from './task-current-state-core/model.js';
export * from './task-current-state-core/canonical-json.js';
export * from './task-current-state-core/sha256.js';
export * from './task-current-state-core/register-join.js';
export * from './task-current-state-core/entity.js';
export * from './task-current-state-core/bucket.js';
