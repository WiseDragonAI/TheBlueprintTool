/**
 * WHAT: Stores mutable scheduler state for viewport-driven card detail mounting.
 * WHY: The mount policy spans zoom, pan, and rerender edges without hiding state inside implementation files.
 */
export const detailMountState = {
  settleTimer: 0,
  mountFrame: 0,
  unmountTimers: new Map<string, number>()
};
