/**
 * WHAT: Retains provider session history for a card thread.
 * WHY: Conversation continuity needs stable session pointers, while replicated execution entities exclusively own lifecycle.
 */
type AnyRecord = Record<string, unknown>;

function threadRunIds(card: AnyRecord): string[] {
  const retained = Array.isArray(card.codexThreadRunIds)
    ? card.codexThreadRunIds.map(String).map((runId) => runId.trim()).filter(Boolean)
    : [];
  const current = String(card.codexThreadRunId ?? '').trim();
  return [...new Set([...retained, current].filter(Boolean))];
}

export function projectCardCodexRun(input: {
  ledger: AnyRecord & { cards?: AnyRecord[] };
  cardId: string;
  runId: string;
  executionId: string;
  outputFileRef: string;
  codexModel: string;
  codexEffort: string;
  ownership: 'thread' | 'card';
  pipeline?: {
    runId: string;
    name: string;
    stepId: string;
    stepName: string;
    skillName: string;
  };
}): AnyRecord | null {
  const card = (input.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (!card) return null;
  card.codexRunModel = input.codexModel;
  card.codexRunEffort = input.codexEffort;
  if (input.ownership === 'thread') {
    card.codexThreadRunIds = [...new Set([...threadRunIds(card), input.runId])];
    delete card.codexRunId;
    delete card.codexRunOutputFile;
    card.codexThreadRunId = input.runId;
    card.codexThreadRunOutputFile = input.outputFileRef;
    const outputFiles = card.codexThreadRunOutputFiles && typeof card.codexThreadRunOutputFiles === 'object' && !Array.isArray(card.codexThreadRunOutputFiles)
      ? card.codexThreadRunOutputFiles as Record<string, unknown>
      : {};
    card.codexThreadRunOutputFiles = { ...outputFiles, [input.runId]: input.outputFileRef };
  }
  return card;
}
