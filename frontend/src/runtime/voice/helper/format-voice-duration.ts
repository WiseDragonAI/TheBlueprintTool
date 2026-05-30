/**
 * WHAT: Formats a voice recording duration for the compact waveform timer.
 * WHY: the timer must roll total seconds into minutes instead of rendering 00:102.
 */
export function formatVoiceDuration(durationMs: unknown): string {
  const totalSeconds = Math.max(0, Math.floor(Number(durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
