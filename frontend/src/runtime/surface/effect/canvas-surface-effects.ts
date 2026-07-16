type CanvasSurfaceEffects = {
  renderCanvasControlOverlay: (...args: any[]) => any;
  renderCanvasSurface: (...args: any[]) => any;
  scheduleCanvasMediaOverlayRender: (...args: any[]) => any;
};

const inactiveEffects: CanvasSurfaceEffects = {
  renderCanvasControlOverlay: () => undefined,
  renderCanvasSurface: () => undefined,
  scheduleCanvasMediaOverlayRender: () => undefined,
};

let activeEffects = inactiveEffects;

export function installCanvasSurfaceEffects(effects: CanvasSurfaceEffects): void {
  activeEffects = effects;
}

export function renderCanvasControlOverlay(...args: any[]): any {
  return activeEffects.renderCanvasControlOverlay(...args);
}

export function renderCanvasSurface(...args: any[]): any {
  return activeEffects.renderCanvasSurface(...args);
}

export function scheduleCanvasMediaOverlayRender(...args: any[]): any {
  return activeEffects.scheduleCanvasMediaOverlayRender(...args);
}
