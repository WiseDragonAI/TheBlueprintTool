/**
 * WHAT: Stores the current hover-owned canvas control target.
 * WHY: Low-detail entry must clear stale detail-era hover state before later viewport updates can place card controls.
 */
export type CanvasControlTarget = {
  kind: 'card' | 'zone' | 'group';
  id: string;
};

export const canvasControlOverlayHoverState = {
  target: null as CanvasControlTarget | null
};
