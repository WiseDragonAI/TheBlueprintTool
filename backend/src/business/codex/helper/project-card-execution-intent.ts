/**
 * WHAT: Projects one task card's durable Codex lifecycle into the replicated execution-intent lane.
 * WHY: Process memory and queue files are node-local; Control Room synchronization requires causal task state.
 */
type AnyRecord = Record<string, unknown>;

export type CardExecutionIntentState = 'waiting' | 'queued' | 'running' | 'terminal' | 'failed';

const activeStates = new Set<CardExecutionIntentState>(['waiting', 'queued', 'running']);

export function projectCardExecutionIntent(input: {
  card: AnyRecord;
  intentId: string;
  state: CardExecutionIntentState;
  changedAt?: string;
  error?: string;
}): AnyRecord {
  const changedAt = input.changedAt ?? new Date().toISOString();
  const current = input.card.executionIntent && typeof input.card.executionIntent === 'object' && !Array.isArray(input.card.executionIntent)
    ? input.card.executionIntent as AnyRecord
    : {};
  const currentState = String(current.state ?? '') as CardExecutionIntentState;
  const currentActive = activeStates.has(currentState);
  const terminal = input.state === 'terminal' || input.state === 'failed';
  const id = currentActive && String(current.id ?? '') ? String(current.id) : input.intentId;
  input.card.executionIntent = {
    id,
    state: input.state,
    changedAt,
    startedAt: input.state === 'running'
      ? String(current.startedAt ?? '') || changedAt
      : currentActive ? current.startedAt ?? null : null,
    settledAt: terminal ? changedAt : null,
    error: input.state === 'failed' ? input.error ?? (String(current.error ?? '') || null) : null,
  };
  return input.card.executionIntent as AnyRecord;
}
