/**
 * WHAT: Resolves displayed Codex run elapsed time from the last server sample and the local clock.
 * WHY: Active run timers must keep advancing between status responses without changing terminal durations.
 */
export type CodexRunTiming = {
  status: string;
  startedAt: string;
  elapsedMs: number;
};

export { codexRunDurationLabel } from './codex-run-duration-label.js';

export function liveCodexRunElapsedMs(timing: CodexRunTiming, nowMs = Date.now()): number {
  const sampledElapsedMs = Math.max(0, Number(timing.elapsedMs) || 0);
  // WHAT: Freeze the displayed duration after the server reports a terminal state.
  // WHY: Local wall-clock time must not extend a completed run.
  if (timing.status !== 'running') return sampledElapsedMs;
  const startedAtMs = Date.parse(timing.startedAt);
  // WHAT: Retain the latest server sample when no valid wall-clock anchor exists.
  // WHY: A missing producer timestamp must not manufacture elapsed time from the Unix epoch.
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return sampledElapsedMs;
  return Math.max(sampledElapsedMs, nowMs - startedAtMs);
}
