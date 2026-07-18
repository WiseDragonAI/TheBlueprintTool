/**
 * WHAT: Resolves the project that owns the active voice lifecycle.
 * WHY: Control Room card views retain project ownership in runtime state while the browser URL stays global.
 */
import { projectIdFromLocation } from '../../project/helper/project-request-scope.js';
import { state } from '../../state.js';

export function voiceProjectId(explicitProjectId?: string): string {
  return String(explicitProjectId ?? '').trim()
    || String(state.projectId ?? '').trim()
    || projectIdFromLocation();
}
