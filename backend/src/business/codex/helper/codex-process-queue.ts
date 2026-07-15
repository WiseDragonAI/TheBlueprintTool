/**
 * WHAT: Persists non-pipeline Codex launch requests and exposes their FIFO order.
 * WHY: Thread runs must wait durably beside pipeline runs when project process capacity is full.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;
export type CodexProcessQueueItem = {
  id: string;
  kind: 'thread' | 'continuation';
  status: 'pending' | 'running' | 'interrupted';
  createdAt: string;
  startedAt: string | null;
  interruptedAt: string | null;
  interruptionReason: string;
  processId: number;
  processStartTime: string;
  stdoutFile: string;
  stderrFile: string;
  payload: AnyRecord;
};

export const codexProcessRestartInterruptionReason = 'Decision OS server restarted while this Codex process was running.';

function filePath(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'codex-process-queue.json');
}

function normalizeItem(value: unknown): CodexProcessQueueItem | null {
  const item = value && typeof value === 'object' ? value as AnyRecord : {};
  const id = String(item.id ?? '').trim();
  if (!id || (item.kind !== 'thread' && item.kind !== 'continuation')) return null;
  const status = item.status === 'running' || item.status === 'interrupted' ? item.status : 'pending';
  return {
    id,
    kind: item.kind,
    status,
    createdAt: String(item.createdAt ?? ''),
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
    interruptedAt: status === 'interrupted' && typeof item.interruptedAt === 'string' ? item.interruptedAt : null,
    interruptionReason: status === 'interrupted' ? String(item.interruptionReason ?? codexProcessRestartInterruptionReason) : '',
    processId: Math.max(0, Number(item.processId ?? 0) || 0),
    processStartTime: String(item.processStartTime ?? ''),
    stdoutFile: String(item.stdoutFile ?? ''),
    stderrFile: String(item.stderrFile ?? ''),
    payload: item.payload && typeof item.payload === 'object' ? item.payload as AnyRecord : {},
  };
}

export function readCodexProcessQueue(decisionOsRoot: string): CodexProcessQueueItem[] {
  if (!existsSync(filePath(decisionOsRoot))) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath(decisionOsRoot), 'utf8')) as AnyRecord;
    return (Array.isArray(raw.items) ? raw.items : []).map(normalizeItem).filter((item): item is CodexProcessQueueItem => Boolean(item));
  } catch {
    return [];
  }
}

export function writeCodexProcessQueue(decisionOsRoot: string, items: readonly CodexProcessQueueItem[]): void {
  const target = filePath(decisionOsRoot);
  const temporary = resolve(decisionOsRoot, `.codex-process-queue-${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify({ version: 1, items }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

export function enqueueCodexThreadProcess(input: { decisionOsRoot: string; id: string; createdAt: string; payload: AnyRecord }): CodexProcessQueueItem {
  const item: CodexProcessQueueItem = { id: input.id, kind: 'thread', status: 'pending', createdAt: input.createdAt, startedAt: null, interruptedAt: null, interruptionReason: '', processId: 0, processStartTime: '', stdoutFile: '', stderrFile: '', payload: input.payload };
  writeCodexProcessQueue(input.decisionOsRoot, [...readCodexProcessQueue(input.decisionOsRoot), item]);
  return item;
}

export function enqueueCodexContinuation(input: { decisionOsRoot: string; id: string; createdAt: string; payload: AnyRecord }): CodexProcessQueueItem {
  const item: CodexProcessQueueItem = { id: input.id, kind: 'continuation', status: 'pending', createdAt: input.createdAt, startedAt: null, interruptedAt: null, interruptionReason: '', processId: 0, processStartTime: '', stdoutFile: '', stderrFile: '', payload: input.payload };
  writeCodexProcessQueue(input.decisionOsRoot, [...readCodexProcessQueue(input.decisionOsRoot), item]);
  return item;
}

export function markCodexProcessQueueItemRunning(decisionOsRoot: string, id: string): CodexProcessQueueItem | null {
  let selected: CodexProcessQueueItem | null = null;
  const now = new Date().toISOString();
  const items = readCodexProcessQueue(decisionOsRoot).map((item) => {
    if (item.id !== id || item.status !== 'pending') return item;
    selected = { ...item, status: 'running', startedAt: now, interruptedAt: null, interruptionReason: '' };
    return selected;
  });
  if (selected) writeCodexProcessQueue(decisionOsRoot, items);
  return selected;
}

export function removeCodexProcessQueueItem(decisionOsRoot: string, id: string): void {
  const before = readCodexProcessQueue(decisionOsRoot);
  const after = before.filter((item) => item.id !== id);
  if (after.length !== before.length) writeCodexProcessQueue(decisionOsRoot, after);
}

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

export function recordCodexProcessQueueItemProcess(input: { decisionOsRoot: string; id: string; processId: number; stdoutFile: string; stderrFile: string }): CodexProcessQueueItem | null {
  let selected: CodexProcessQueueItem | null = null;
  const items = readCodexProcessQueue(input.decisionOsRoot).map((item) => {
    if (item.id !== input.id || item.status !== 'running') return item;
    selected = {
      ...item,
      processId: input.processId,
      processStartTime: codexProcessIdentity(input.processId),
      stdoutFile: input.stdoutFile,
      stderrFile: input.stderrFile,
    };
    return selected;
  });
  if (selected) writeCodexProcessQueue(input.decisionOsRoot, items);
  return selected;
}

function terminalStatus(stdoutFile: string): 'complete' | 'failed' | 'cancelled' | null {
  if (!stdoutFile || !existsSync(stdoutFile)) return null;
  let status: 'complete' | 'failed' | 'cancelled' | null = null;
  for (const line of readFileSync(stdoutFile, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as AnyRecord;
      const type = String(event.type ?? '');
      if (type === 'turn.completed') status = 'complete';
      else if (/cancelled|canceled/i.test(type)) status = 'cancelled';
      else if (/^(?:thread|turn|run)\.failed$/i.test(type)) status = 'failed';
    } catch {
      // A partial final line is not a terminal event.
    }
  }
  return status;
}

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function runFiles(decisionOsRoot: string, item: CodexProcessQueueItem): { stdoutFile: string; stderrFile: string } {
  const runId = String(item.payload.runId ?? item.id);
  const ledgerId = String(item.payload.ledgerId ?? 'untitled');
  const directory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerId));
  return {
    stdoutFile: item.stdoutFile || resolve(directory, `${safeSegment(runId)}.jsonl`),
    stderrFile: item.stderrFile || resolve(directory, `${safeSegment(runId)}.log`),
  };
}

function recoveredContinuation(item: CodexProcessQueueItem): CodexProcessQueueItem {
  if (item.kind === 'continuation') return {
    ...item,
    status: 'pending',
    startedAt: null,
    interruptedAt: null,
    interruptionReason: '',
    processId: 0,
    processStartTime: '',
    payload: { ...item.payload, restartRecovery: true },
  };
  return {
    ...item,
    kind: 'continuation',
    status: 'pending',
    startedAt: null,
    interruptedAt: null,
    interruptionReason: '',
    processId: 0,
    processStartTime: '',
    payload: {
      ledgerId: item.payload.ledgerId,
      cardId: item.payload.cardId,
      runId: item.id,
      newSession: false,
      codexModel: item.payload.codexModel,
      codexEffort: item.payload.codexEffort,
      traceId: item.payload.traceId,
      restartRecovery: true,
    },
  };
}

function stopAdoptedMonitor(runtime: AnyRecord, id: string): void {
  const monitors = runtime.codexAdoptedProcessMonitors instanceof Map
    ? runtime.codexAdoptedProcessMonitors as Map<string, NodeJS.Timeout>
    : null;
  const timer = monitors?.get(id);
  if (timer) clearInterval(timer);
  monitors?.delete(id);
}

function scheduleAfterAdoptedSettlement(runtime: AnyRecord): void {
  const schedule = runtime.scheduleCodexProcesses;
  if (typeof schedule === 'function') void Promise.resolve(schedule()).catch(() => undefined);
}

function monitorAdoptedProcess(decisionOsRoot: string, runtime: AnyRecord, item: CodexProcessQueueItem): void {
  let monitors = runtime.codexAdoptedProcessMonitors instanceof Map
    ? runtime.codexAdoptedProcessMonitors as Map<string, NodeJS.Timeout>
    : null;
  if (!monitors) {
    monitors = new Map<string, NodeJS.Timeout>();
    Object.defineProperty(runtime, 'codexAdoptedProcessMonitors', { value: monitors, writable: true, configurable: true, enumerable: false });
  }
  if (monitors.has(item.id)) return;
  const runId = String(item.payload.runId ?? item.id);
  const timer = setInterval(() => {
    const current = readCodexProcessQueue(decisionOsRoot).find((entry) => entry.id === item.id && entry.status === 'running');
    if (!current) {
      stopAdoptedMonitor(runtime, item.id);
      return;
    }
    const settled = terminalStatus(current.stdoutFile);
    const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
      ? runtime.codexSkillRuns as Record<string, AnyRecord>
      : {};
    runtime.codexSkillRuns = runs;
    if (settled) {
      runs[runId] = { ...(runs[runId] ?? {}), status: settled, adopted: false, finishedAt: new Date().toISOString() };
      removeCodexProcessQueueItem(decisionOsRoot, current.id);
      stopAdoptedMonitor(runtime, current.id);
      if (typeof runtime.onCodexRunSettled === 'function') runtime.onCodexRunSettled({
        ledgerId: current.payload.ledgerId,
        cardId: current.payload.cardId,
        outputCardId: current.payload.cardId,
        threadId: `thread-${String(current.payload.cardId ?? '')}`,
        runId,
        status: settled,
      });
      scheduleAfterAdoptedSettlement(runtime);
      return;
    }
    if (isSameCodexProcess(current.processId, current.processStartTime)) return;
    writeCodexProcessQueue(decisionOsRoot, readCodexProcessQueue(decisionOsRoot).map((entry) => entry.id === current.id ? recoveredContinuation(entry) : entry));
    delete runs[runId];
    stopAdoptedMonitor(runtime, current.id);
    scheduleAfterAdoptedSettlement(runtime);
  }, 250);
  timer.unref?.();
  monitors.set(item.id, timer);
}

export function recoverCodexProcessQueue(decisionOsRoot: string, runtime?: AnyRecord): void {
  const items = readCodexProcessQueue(decisionOsRoot);
  if (!items.some((item) => item.status === 'running')) return;
  const runs = runtime && runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  if (runtime) runtime.codexSkillRuns = runs;
  const recovered = items.flatMap((item): CodexProcessQueueItem[] => {
    if (item.status !== 'running') return [item];
    const runId = String(item.payload.runId ?? item.id);
    const files = runFiles(decisionOsRoot, item);
    const settled = terminalStatus(files.stdoutFile);
    if (settled) {
      runs[runId] = { ...(runs[runId] ?? {}), id: runId, status: settled, pid: item.processId, adopted: false, finishedAt: new Date().toISOString() };
      return [];
    }
    if (isSameCodexProcess(item.processId, item.processStartTime)) {
      runs[runId] = {
        ...(runs[runId] ?? {}),
        id: runId,
        ledgerId: item.payload.ledgerId,
        outputCardId: item.payload.cardId,
        stdoutFile: files.stdoutFile,
        stderrFile: files.stderrFile,
        pid: item.processId,
        status: 'running',
        startedAt: item.startedAt,
        adopted: true,
        queueItemId: item.id,
      };
      if (runtime) monitorAdoptedProcess(decisionOsRoot, runtime, item);
      return [item];
    }
    return [recoveredContinuation(item)];
  });
  writeCodexProcessQueue(decisionOsRoot, recovered);
}

export function codexProcessQueuePosition(decisionOsRoot: string, id: string): number | null {
  const index = readCodexProcessQueue(decisionOsRoot).filter((item) => item.status === 'pending').findIndex((item) => item.id === id);
  return index < 0 ? null : index + 1;
}
