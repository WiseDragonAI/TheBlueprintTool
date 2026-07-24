/**
 * WHAT: Resolves whether one ledger card owns one Codex skill run.
 * WHY: Status reads, continuations, and lifecycle ingestion must share one ownership contract.
 */
import { readCodexPipelineStore } from './codex-pipeline-store.js';

type AnyRecord = Record<string, unknown>;

export type CardSkillRunOwnership = {
  found: boolean;
  threadLaunched: boolean;
};

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
  const card = storedCard;
  const retainedThreadRunIds = Array.isArray(card.codexThreadRunIds)
    ? card.codexThreadRunIds.map(String).map((runId) => runId.trim()).filter(Boolean)
    : [];
  // WHAT: Classify an explicit thread-run field as thread-launched ownership.
  // WHY: Consumers use this classification to keep lifecycle artifacts out of conversation notes.
  if (String(card.codexThreadRunId ?? '') === input.runId) return { found: true, threadLaunched: true };
  // WHAT: Retain ownership for every historical run projected by the source thread.
  // WHY: Starting a newer run must not make an older on-disk log unreadable.
  if (retainedThreadRunIds.includes(input.runId)) return { found: true, threadLaunched: true };
  const pipelineRun = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store.runs.find((run) => (
    run.steps.some((step) => step.skills.some((skill) => skill.runId === input.runId))
  ));
  if (pipelineRun && (
    pipelineRun.sourceCardId === input.cardId
    || pipelineRun.steps.some((step) => step.outputCardId === input.cardId
      && step.skills.some((skill) => skill.runId === input.runId))
  )) {
    return { found: true, threadLaunched: false };
  }
  return { found: false, threadLaunched: false };
}
