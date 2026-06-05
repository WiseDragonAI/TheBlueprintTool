declare global {
  interface Window {
    __corev2DragTraceSpan?: <T>(label: string, callback: () => T) => T;
  }
}

export function dragTraceHook(): Window['__corev2DragTraceSpan'] {
  return window.__corev2DragTraceSpan;
}
