/**
 * WHAT: Applies receipt ownership and lifecycle direction before replicated task state is installed.
 * WHY: Aggregate relay revision order does not prove acknowledgement of locally persisted intent.
 */
type TaskProjectionDomain = 'message' | 'image' | 'voice' | 'queued-execution' | 'pipeline' | 'content-head';
type TaskProjectionRecord = Record<string, unknown>;

export type PendingTaskMutationReceipt = {
  receiptId: string;
  entityId: string;
  localRevision: number;
  acknowledged: boolean;
  intent?: string;
  taskClock?: Record<string, number> | null;
};

export type TaskProjectionAcceptanceInput = {
  domain: TaskProjectionDomain;
  local: TaskProjectionRecord;
  incoming: TaskProjectionRecord;
  pendingReceipt: PendingTaskMutationReceipt | null;
  source: 'relay-refresh' | 'mutation-response' | 'mutation-rejection';
  responseReceiptId?: string;
  incomingTaskClock?: Record<string, number> | null;
};

const voiceTerminal = new Set(['transcribed', 'transcription failed', 'execution launch failed']);
const executionTerminal = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);
const voiceRank: Record<string, number> = {
  uploading: 0, queued: 1, transcribing: 2, finalizing: 3,
  transcribed: 4, 'transcription failed': 4, 'execution launch failed': 4,
};
const executionRank: Record<string, number> = {
  preparing: 0, pending: 0, queued: 1, starting: 2, running: 3, cancelling: 4,
  succeeded: 5, complete: 5, completed: 5, failed: 5, cancelled: 5, interrupted: 5,
};

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function lifecycleRegresses(input: TaskProjectionAcceptanceInput): boolean {
  const local = String(input.local.status ?? input.local.phase ?? '').toLowerCase();
  const incoming = String(input.incoming.status ?? input.incoming.phase ?? '').toLowerCase();
  if (input.domain === 'voice') {
    return (voiceTerminal.has(local) && !voiceTerminal.has(incoming))
      || (local in voiceRank && incoming in voiceRank && voiceRank[incoming] < voiceRank[local]);
  }
  if (input.domain === 'queued-execution' || input.domain === 'pipeline') {
    return (executionTerminal.has(local) && !executionTerminal.has(incoming))
      || (local in executionRank && incoming in executionRank && executionRank[incoming] < executionRank[local]);
  }
  return false;
}

export function shouldAcceptReplicatedTaskState(input: TaskProjectionAcceptanceInput): boolean {
  if (lifecycleRegresses(input)) {
    const explicitRetry = input.pendingReceipt?.intent === 'retry'
      && texts(input.incoming.acknowledgedReceiptIds).includes(input.pendingReceipt.receiptId);
    if (!explicitRetry) return false;
  }
  const pending = input.pendingReceipt;
  if (!pending) return true;
  const entityId = String(input.incoming.entityId ?? input.local.entityId ?? '');
  // WHAT: Scope one pending receipt to the exact entity whose local intent it owns.
  // WHY: An unacknowledged message must not block an unrelated image, execution, pipeline, or content-head projection.
  if (entityId && entityId !== pending.entityId) return true;
  // WHAT: Limit optimistic rollback authority to the response for the exact mutation receipt.
  // WHY: An unrelated rejection cannot prove that this locally persisted intent failed.
  if (input.source === 'mutation-rejection') return input.responseReceiptId === pending.receiptId;
  if (input.source === 'mutation-response') return input.responseReceiptId === pending.receiptId;
  if (texts(input.incoming.acknowledgedReceiptIds).includes(pending.receiptId)) return true;
  if (!pending.acknowledged || !pending.taskClock || !input.incomingTaskClock) return false;
  return Object.entries(pending.taskClock).every(([replicaId, counter]) => (
    Number(input.incomingTaskClock?.[replicaId] ?? 0) >= counter
  ));
}
