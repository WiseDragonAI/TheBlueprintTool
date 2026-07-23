/**
 * WHAT: Resolves and validates the operating-system identity of one Codex child.
 * WHY: PID reuse must not let cancellation or recovery attach to an unrelated process.
 */
import { readFileSync } from 'node:fs';

function procStartTime(pid: number): string {
  if (pid <= 0 || process.platform !== 'linux') return '';
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const close = stat.lastIndexOf(')');
    return close >= 0 ? stat.slice(close + 2).trim().split(/\s+/)[19] ?? '' : '';
  } catch {
    return '';
  }
}

export function codexProcessIdentity(pid: number): string {
  if (pid <= 0) return '';
  const identity = procStartTime(pid);
  if (process.platform === 'linux') return identity;
  try {
    process.kill(pid, 0);
    return String(pid);
  } catch {
    return '';
  }
}

export function isSameCodexProcess(pid: number, startTime: string): boolean {
  if (pid <= 0 || !startTime) return false;
  return codexProcessIdentity(pid) === startTime;
}
