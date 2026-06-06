/**
 * WHAT: Stores pending viewport transform scheduling state.
 * WHY: Wheel zoom can enqueue faster than paint, so the runtime needs one shared RAF gate.
 */
export const scheduledViewportTransformState = {
  scheduled: false
};
