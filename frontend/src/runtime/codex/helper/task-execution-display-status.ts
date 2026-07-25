/**
 * WHAT: Maps an Epoch-4 execution phase to the existing Codex control status.
 * WHY: Controls and log status must present identical lifecycle semantics.
 */
export function taskExecutionDisplayStatus(
  phase: string,
): 'pending' | 'running' | 'complete' | 'failed' | 'cancelled' {
  if (phase === 'preparing' || phase === 'queued') return 'pending';
  if (phase === 'starting' || phase === 'running' || phase === 'cancelling') return 'running';
  if (phase === 'succeeded') return 'complete';
  if (phase === 'cancelled') return 'cancelled';
  return 'failed';
}
