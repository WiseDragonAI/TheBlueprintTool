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
  status: 'pending' | 'running';
  createdAt: string;
  startedAt: string | null;
  payload: AnyRecord;
};

function filePath(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'codex-process-queue.json');
}

function normalizeItem(value: unknown): CodexProcessQueueItem | null {
  const item = value && typeof value === 'object' ? value as AnyRecord : {};
  const id = String(item.id ?? '').trim();
  if (!id || (item.kind !== 'thread' && item.kind !== 'continuation')) return null;
  return {
    id,
    kind: item.kind,
    status: item.status === 'running' ? 'running' : 'pending',
    createdAt: String(item.createdAt ?? ''),
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
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
  const item: CodexProcessQueueItem = { id: input.id, kind: 'thread', status: 'pending', createdAt: input.createdAt, startedAt: null, payload: input.payload };
  writeCodexProcessQueue(input.decisionOsRoot, [...readCodexProcessQueue(input.decisionOsRoot), item]);
  return item;
}

export function enqueueCodexContinuation(input: { decisionOsRoot: string; id: string; createdAt: string; payload: AnyRecord }): CodexProcessQueueItem {
  const item: CodexProcessQueueItem = { id: input.id, kind: 'continuation', status: 'pending', createdAt: input.createdAt, startedAt: null, payload: input.payload };
  writeCodexProcessQueue(input.decisionOsRoot, [...readCodexProcessQueue(input.decisionOsRoot), item]);
  return item;
}

export function markCodexProcessQueueItemRunning(decisionOsRoot: string, id: string): CodexProcessQueueItem | null {
  let selected: CodexProcessQueueItem | null = null;
  const now = new Date().toISOString();
  const items = readCodexProcessQueue(decisionOsRoot).map((item) => {
    if (item.id !== id || item.status !== 'pending') return item;
    selected = { ...item, status: 'running', startedAt: now };
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
  writeCodexProcessQueue(decisionOsRoot, items.map((item) => item.status === 'running' ? { ...item, status: 'pending', startedAt: null } : item));
}

export function codexProcessQueuePosition(decisionOsRoot: string, id: string): number | null {
  const index = readCodexProcessQueue(decisionOsRoot).filter((item) => item.status === 'pending').findIndex((item) => item.id === id);
  return index < 0 ? null : index + 1;
}
