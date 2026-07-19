/**
 * WHAT: Resolves whether one ledger card owns one Codex skill run.
 * WHY: Status reads, continuations, and lifecycle ingestion must share one ownership contract.
 */
import { hydrateLedgerCardContent } from '@backend/business/ledger/helper/card-content-file.js';

type AnyRecord = Record<string, unknown>;

export type CardSkillRunOwnership = {
  found: boolean;
  threadLaunched: boolean;
};

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

export function resolveCardSkillRunOwnership(input: {
  ledger: AnyRecord;
  decisionOsRoot: string;
  cardId: string;
  runId: string;
}): CardSkillRunOwnership {
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const storedCard = cards.find((entry) => String(entry.id ?? '') === input.cardId);
  // WHAT: Reject ownership before hydration when the requested card is absent.
  // WHY: Hydrating unrelated cards performs unnecessary file IO and cannot establish ownership.
  if (!storedCard) return { found: false, threadLaunched: false };
  const hydrated = hydrateLedgerCardContent({ cards: [JSON.parse(JSON.stringify(storedCard)) as AnyRecord] }, input.decisionOsRoot) as { cards?: AnyRecord[] };
  const card = hydrated.cards?.[0] ?? storedCard;
  const retainedThreadRunIds = Array.isArray(card.codexThreadRunIds)
    ? card.codexThreadRunIds.map(String).map((runId) => runId.trim()).filter(Boolean)
    : [];
  // WHAT: Accept the shared current-run pointer before legacy ownership fields.
  // WHY: Process Card skills must be readable from the source card's existing Codex Log.
  if (String(card.codexActiveRunId ?? '') === input.runId) {
    return { found: true, threadLaunched: String(card.codexThreadRunId ?? '') === input.runId };
  }
  // WHAT: Classify an explicit thread-run field as thread-launched ownership.
  // WHY: Consumers use this classification to keep lifecycle artifacts out of conversation notes.
  if (String(card.codexThreadRunId ?? '') === input.runId) return { found: true, threadLaunched: true };
  // WHAT: Retain ownership for every historical run projected by the source thread.
  // WHY: Starting a newer run must not make an older on-disk log unreadable.
  if (retainedThreadRunIds.includes(input.runId)) return { found: true, threadLaunched: true };
  // WHAT: Accept the ordinary card-run field without the thread-launched classification.
  // WHY: Generated skill cards share run artifacts but retain card-owned presentation.
  if (String(card.codexRunId ?? '') === input.runId) return { found: true, threadLaunched: false };
  // WHAT: Recover ownership from the deterministic generated-card identity.
  // WHY: Older generated cards may predate explicit run fields.
  if (input.cardId === `card-${safeSegment(input.runId)}`) return { found: true, threadLaunched: false };
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as AnyRecord
    : {};
  const body = String(comment.what ?? comment.body ?? comment.description ?? '');
  return { found: body.includes(`Codex run: ${input.runId}`), threadLaunched: false };
}
