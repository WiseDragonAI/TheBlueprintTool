/**
 * WHAT: Emits sampled performance telemetry for canvas pan frames.
 * WHY: Pan diagnostics must expose first-frame and slow-frame costs without logging every pointermove.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function emitPanPerformanceTelemetry(input: { dx: number; dy: number; durationMs: number; frameStartedAt: number }): void {
  const frame = Number(state.pointer.panFrameCount ?? 0) + 1;
  state.pointer.panFrameCount = frame;
  const pointerStartedAt = Number(state.pointer.startedAt ?? input.frameStartedAt);
  const firstFrameDelayMs = frame === 1 ? input.frameStartedAt - pointerStartedAt : 0;
  const shouldEmit = frame === 1 || input.durationMs >= 8 || frame % 12 === 0;
  if (!shouldEmit) return;
  telemetry('canvas-pointer-move', { intent: 'pan', dx: input.dx, dy: input.dy, sampled: true, frame });
  telemetry('calculate-viewport-transform', { kind: 'pan', viewport: state.viewport, sampled: true, frame });
  telemetry('pan-frame-performance', {
    frame,
    durationMs: Number(input.durationMs.toFixed(2)),
    firstFrameDelayMs: Number(firstFrameDelayMs.toFixed(2))
  });
}
