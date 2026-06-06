/**
 * WHAT: Stores cancellable detail-runtime follow-up work handles.
 * WHY: Leaving detail mode must tear down delayed tab-frame measurement instead of letting it leak into low-detail.
 */
export const detailRuntimeState = {
  tabFrameRafA: 0,
  tabFrameRafB: 0,
  tabFrameFontsEpoch: 0,
  tabFrameObserver: null as ResizeObserver | null
};
