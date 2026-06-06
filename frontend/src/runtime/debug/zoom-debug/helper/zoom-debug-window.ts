/**
 * WHAT: Declares the browser console hook for the zoom debug overlay.
 * WHY: TypeScript should know the operator-facing debug toggle without colocating declarations with behavior.
 */
declare global {
  interface Window {
    corev2ZoomDebug?: (enabled?: boolean) => boolean;
  }
}

export {};
