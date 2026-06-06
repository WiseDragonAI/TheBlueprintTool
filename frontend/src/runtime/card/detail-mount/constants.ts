/**
 * WHAT: Shared timing and padding constants for viewport-driven detail mounting.
 * WHY: Detail virtualization needs stable thresholds without spreading magic numbers across scheduler files.
 */
export const DETAIL_MOUNT_SETTLE_MS = 120;
export const DETAIL_MOUNT_OPACITY_MS = 160;
