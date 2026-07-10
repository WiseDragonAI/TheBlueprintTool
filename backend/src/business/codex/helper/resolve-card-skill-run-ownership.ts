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
  if (!storedCard) return { found: false, threadLaunched: false };
  const hydrated = hydrateLedgerCardContent({ cards: [JSON.parse(JSON.stringify(storedCard)) as AnyRecord] }, input.decisionOsRoot) as { cards?: AnyRecord[] };
  const card = hydrated.cards?.[0] ?? storedCard;
  if (String(card.codexThreadRunId ?? '') === input.runId) return { found: true, threadLaunched: true };
  if (String(card.codexRunId ?? '') === input.runId) return { found: true, threadLaunched: false };
  if (input.cardId === `card-${safeSegment(input.runId)}`) return { found: true, threadLaunched: false };
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as AnyRecord
    : {};
  const body = String(comment.what ?? comment.body ?? comment.description ?? '');
  return { found: body.includes(`Codex run: ${input.runId}`), threadLaunched: false };
}
