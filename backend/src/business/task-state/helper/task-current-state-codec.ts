/**
 * WHAT: Exposes shared canonical encoding and hashing through the established backend import path.
 * WHY: Existing node callers must execute the platform-neutral epoch-3 implementation.
 */
export { canonicalJson, sha256 } from '../../../../../shared/task-current-state-core.js';
