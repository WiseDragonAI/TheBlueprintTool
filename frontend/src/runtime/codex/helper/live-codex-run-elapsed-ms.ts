/**
 * WHAT: Resolves displayed Codex run elapsed time from the last server sample and the local clock.
 * WHY: Active run timers must keep advancing between status responses without changing terminal durations.
 */
export type CodexRunTiming = {
  status: string;
  startedAt: string;
  elapsedMs: number;
};

export function liveCodexRunElapsedMs(timing: CodexRunTiming, nowMs = Date.now()): number {
  const sampledElapsedMs = Math.max(0, Number(timing.elapsedMs) || 0);
  if (timing.status !== 'running') return sampledElapsedMs;
  const startedAtMs = Date.parse(timing.startedAt);
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return sampledElapsedMs;
  return Math.max(sampledElapsedMs, nowMs - startedAtMs);
}

export function codexRunDurationLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
