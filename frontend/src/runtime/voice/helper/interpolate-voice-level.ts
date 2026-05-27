/**
 * WHAT: Interpolates the displayed voice level between committed value ticks.
 * WHY: Audio values update below render FPS, but the meter and waveform should render smoothly at frame rate.
 */
export const voiceValueFrameMs = 1000 / 30;

export function interpolateVoiceLevel(input: { from?: number; to?: number; startedAt?: number; now: number }): number {
  const from = clampLevel(input.from ?? input.to ?? 0);
  const to = clampLevel(input.to ?? from);
  const startedAt = Number(input.startedAt ?? input.now);
  const progress = Math.max(0, Math.min(1, (input.now - startedAt) / voiceValueFrameMs));
  return from + (to - from) * progress;
}

function clampLevel(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
