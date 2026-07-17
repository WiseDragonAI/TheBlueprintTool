/**
 * WHAT: Verifies that one runtime Codex run still owns a live child process.
 * WHY: Persisted run status and queue claims cannot veto an authoritative operator launch.
 */
import { isSameCodexProcess, readCodexProcessQueue } from './codex-process-queue.js';

type AnyRecord = Record<string, unknown>;

export function runtimeCodexRunOwnsLiveProcess(runtime: AnyRecord, runId: string, decisionOsRoot = ''): boolean {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  const run = runs[runId];
  const child = run?.child && typeof run.child === 'object' ? run.child as AnyRecord : null;
  const runtimeChildIsLive = run?.status === 'running'
    && typeof child?.pid === 'number'
    && child.pid > 0
    && child.exitCode === null
    && child.killed !== true;
  if (runtimeChildIsLive) return true;
  if (!decisionOsRoot || run?.status !== 'running') return false;
  const queued = readCodexProcessQueue(decisionOsRoot).find((item) => (
    item.status === 'running'
    && (item.id === runId || String(item.payload.runId ?? '') === runId)
  ));
  return Boolean(queued && isSameCodexProcess(queued.processId, queued.processStartTime));
}
