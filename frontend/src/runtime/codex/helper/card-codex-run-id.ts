/**
 * WHAT: Resolves retained provider session IDs for one thread target card.
 * WHY: Card lifecycle aliases, generated IDs, and Markdown text cannot establish execution ownership.
 */
import { cardCodexThreadRunId } from './card-codex-thread-run-id.js';

export { cardCodexThreadRunId } from './card-codex-thread-run-id.js';

export function cardCodexRunId(card: Record<string, unknown>): string {
  return cardCodexThreadRunId(card);
}

export function cardCodexRunIds(card: Record<string, unknown>): string[] {
  const retained = Array.isArray(card.codexThreadRunIds)
    ? card.codexThreadRunIds.map(String).map((runId) => runId.trim()).filter((runId) => /^codex-skill-[^\s]+$/.test(runId))
    : [];
  const current = cardCodexRunId(card);
  return [...new Set([...retained, current].filter(Boolean))];
}

export function selectedCardCodexRunId(card: Record<string, unknown>, selectedRunId: unknown): string {
  const runIds = cardCodexRunIds(card);
  const selected = String(selectedRunId ?? '').trim();
  return runIds.includes(selected) ? selected : runIds.at(-1) ?? '';
}
