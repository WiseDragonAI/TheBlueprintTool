/**
 * WHAT: Verifies that one runtime Codex run still owns a live child process.
 * WHY: Persisted run status and queue claims cannot veto an authoritative operator launch.
 */
type AnyRecord = Record<string, unknown>;

export function runtimeCodexRunOwnsLiveProcess(runtime: AnyRecord, runId: string): boolean {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  const run = runs[runId];
  const child = run?.child && typeof run.child === 'object' ? run.child as AnyRecord : null;
  return run?.status === 'running'
    && typeof child?.pid === 'number'
    && child.pid > 0
    && child.exitCode === null
    && child.killed !== true;
}
