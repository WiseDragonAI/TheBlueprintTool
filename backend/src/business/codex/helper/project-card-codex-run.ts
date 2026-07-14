/**
 * WHAT: Projects the currently visible Codex run onto one ledger card.
 * WHY: Thread launches and Process Card pipelines must feed the same card-owned Codex Log contract.
 */
type AnyRecord = Record<string, unknown>;

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
  if (input.ownership === 'thread') {
    card.codexThreadRunId = input.runId;
    card.codexThreadRunOutputFile = input.outputFileRef;
  } else {
    card.codexRunId = input.runId;
    card.codexRunOutputFile = input.outputFileRef;
  }
  if (input.pipeline) {
    card.codexPipelineRunId = input.pipeline.runId;
    card.codexPipelineName = input.pipeline.name;
    card.codexPipelineStepId = input.pipeline.stepId;
    card.codexPipelineStepName = input.pipeline.stepName;
    card.codexSkillName = input.pipeline.skillName;
  }
  return card;
}
