/**
 * WHAT: Projects the currently visible Codex run onto one ledger card.
 * WHY: Thread launches and Process Card pipelines must feed the same card-owned Codex Log contract.
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
  card.codexActiveRunId = input.runId;
  card.codexRunModel = input.codexModel;
  card.codexRunEffort = input.codexEffort;
  delete card.codexQueuedPipelineRunId;
  delete card.codexQueuedRunId;
  if (input.ownership === 'thread') {
    card.codexThreadRunIds = [...new Set([...threadRunIds(card), input.runId])];
    delete card.codexRunId;
    delete card.codexRunOutputFile;
    card.codexThreadRunId = input.runId;
    card.codexThreadRunOutputFile = input.outputFileRef;
  } else {
    delete card.codexThreadRunId;
    delete card.codexThreadRunOutputFile;
    card.codexRunId = input.runId;
    card.codexRunOutputFile = input.outputFileRef;
  }
  delete card.codexPipelineRunId;
  delete card.codexPipelineName;
  delete card.codexPipelineStepId;
  delete card.codexPipelineStepName;
  delete card.codexSkillName;
  if (input.pipeline) {
    card.codexPipelineRunId = input.pipeline.runId;
    card.codexPipelineName = input.pipeline.name;
    card.codexPipelineStepId = input.pipeline.stepId;
    card.codexPipelineStepName = input.pipeline.stepName;
    card.codexSkillName = input.pipeline.skillName;
  }
  return card;
}
