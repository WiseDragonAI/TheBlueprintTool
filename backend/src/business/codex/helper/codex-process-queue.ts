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
  const item: CodexProcessQueueItem = { id: input.id, kind: 'thread', status: 'pending', createdAt: input.createdAt, startedAt: null, interruptedAt: null, interruptionReason: '', payload: input.payload };
  writeCodexProcessQueue(input.decisionOsRoot, [...readCodexProcessQueue(input.decisionOsRoot), item]);
  return item;
}

export function enqueueCodexContinuation(input: { decisionOsRoot: string; id: string; createdAt: string; payload: AnyRecord }): CodexProcessQueueItem {
  const item: CodexProcessQueueItem = { id: input.id, kind: 'continuation', status: 'pending', createdAt: input.createdAt, startedAt: null, interruptedAt: null, interruptionReason: '', payload: input.payload };
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

export function recoverCodexProcessQueue(decisionOsRoot: string): void {
  const items = readCodexProcessQueue(decisionOsRoot);
  if (!items.some((item) => item.status === 'running')) return;
  writeCodexProcessQueue(decisionOsRoot, items.map((item): CodexProcessQueueItem => {
    if (item.status !== 'running') return item;
    if (item.kind === 'continuation') return {
      ...item,
      status: 'pending',
      startedAt: null,
      interruptedAt: null,
      interruptionReason: '',
      payload: { ...item.payload, restartRecovery: true },
    };
    return {
      ...item,
      kind: 'continuation',
      status: 'pending',
      startedAt: null,
      interruptedAt: null,
      interruptionReason: '',
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
  }));
}

export function codexProcessQueuePosition(decisionOsRoot: string, id: string): number | null {
  const index = readCodexProcessQueue(decisionOsRoot).filter((item) => item.status === 'pending').findIndex((item) => item.id === id);
  return index < 0 ? null : index + 1;
}
