/**
 * WHAT: Consumes a viewport entry request only for its exact thread, surface, and generation.
 * WHY: A stale render must not apply another thread transition's scroll decision.
 */
import { state, type ThreadPanelTab, type ThreadViewportPinRequest } from '../../state.js';

export function consumeThreadViewportEntry(threadId: string, surface: ThreadPanelTab): ThreadViewportPinRequest | null {
  const request = state.threadViewportPinRequest as ThreadViewportPinRequest | null;
  // WHAT: Leave unmatched intent available for the render that owns it.
  // WHY: Thread and surface renders may interleave during responsive transitions.
  if (!request
    || request.threadId !== threadId
    || request.surface !== surface
    || request.openGeneration !== Number(state.threadViewportOpenGeneration ?? 0)) return null;
  state.threadViewportPinRequest = null;
  return request;
}
