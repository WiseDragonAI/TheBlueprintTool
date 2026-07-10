/**
 * WHAT: Reads a validated thread-launched Codex run id from one card.
 * WHY: Thread-only run ownership must remain distinct from broader card run resolution.
 */
export function cardCodexThreadRunId(card: Record<string, unknown> | null | undefined): string {
  const runId = String(card?.codexThreadRunId ?? '').trim();
  return /^codex-skill-[^\s]+$/.test(runId) ? runId : '';
}
