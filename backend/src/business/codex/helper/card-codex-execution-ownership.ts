/**
 * WHAT: Reads the card's exact active Codex lease without accepting half-owned state.
 * WHY: A lone run or execution identifier cannot authorize admission, cancellation, recovery, or projection.
 */
import type { CodexExecutionLease } from '../../../../../shared/schemas/codex-execution-types.js';

type AnyRecord = Record<string, unknown>;

export type CardCodexExecutionOwnership =
  | { state: 'none' }
  | { state: 'active'; lease: CodexExecutionLease }
  | { state: 'contradictory'; runId: string; executionId: string };

export function cardCodexExecutionOwnership(card: AnyRecord | null | undefined): CardCodexExecutionOwnership {
  const runId = String(card?.codexActiveRunId ?? '').trim();
  const executionId = String(card?.codexActiveExecutionId ?? '').trim();
  // WHAT: Treat two absent identifiers as an unowned card.
  // WHY: Terminal session pointers do not grant active execution authority.
  if (!runId && !executionId) return { state: 'none' };
  // WHAT: Grant authority only to the complete persisted lease.
  // WHY: Every mutation must fence on both the durable run and exact attempt.
  if (runId && executionId) return { state: 'active', lease: { runId, executionId } };
  return { state: 'contradictory', runId, executionId };
}
