/**
 * WHAT: Stores zoom debug overlay mutable runtime state.
 * WHY: One-function implementation files need shared state without hiding private helpers beside public functions.
 */
export const zoomDebugStorageKey = 'corev2.zoomDebug';

export const zoomDebugState: {
  overlay: HTMLElement | null;
  initialized: boolean;
  enabled: boolean;
} = {
  overlay: null,
  initialized: false,
  enabled: false
};
