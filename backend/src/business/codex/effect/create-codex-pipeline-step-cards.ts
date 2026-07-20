/**
 * WHAT: Writes the generated card and relationship chain for one pending Codex pipeline run.
 * WHY: Ledger mutations are the start controller's final output effect and must remain separate from manifest derivation.
 */
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import type { PipelineLedgerContext } from '../helper/codex-pipeline-runner.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

export function createCodexPipelineStepCards(input: {
  decisionOsRoot: string;
  context: PipelineLedgerContext;
  source: AnyRecord;
  run: CodexPipelineRun;
}): AnyRecord | null {
  const sourceX = Number(input.source.x ?? 0);
  const sourceY = Number(input.source.y ?? 0);
  const sourceWidth = Math.max(220, Number(input.source.w ?? 360));
  const safeRunId = String(input.run.id || 'untitled')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
  let previousCardId = input.run.sourceCardId;
  const relationshipIds: string[] = [];
  const synchronizationRun = input.run.pipelineId === 'project-synchronization';
  for (const [index, step] of input.run.steps.entries()) {
    const firstSkill = step.skills[0];
    const card = {
      id: step.outputCardId,
      title: input.run.temporary && input.run.steps.length === 1
        ? `${firstSkill?.skillName || step.name} result`
        : `${input.run.pipelineName} · ${step.name}`,
      cardType: 'codex-skill-run',
      x: sourceX + sourceWidth + 96 + index * (700 + 96),
      y: sourceY,
      w: 700,
      h: 260,
      status: 'todo',
      ...(synchronizationRun ? { labels: ['subtask', 'synchronization'] } : {}),
      codexPipelineRunId: input.run.id,
      codexPipelineStepId: step.stepId,
      codexPipelineStepName: step.name,
      codexPipelineName: input.run.pipelineName,
      codexRunId: firstSkill?.runId ?? '',
      codexActiveRunId: firstSkill?.runId ?? '',
      codexActiveExecutionId: firstSkill?.executionId ?? '',
      codexSkillName: firstSkill?.skillName ?? '',
      codexRunModel: firstSkill?.codexModel ?? '',
      codexRunEffort: firstSkill?.codexEffort ?? '',
      comment: { what: '\n' },
      facts: [],
      fields: [],
    };
    const cardMutation = applyLedgerMutation({
      decisionOsRoot: input.decisionOsRoot,
      ledgerPath: input.context.ledgerPath,
      ledger: input.context.ledger,
      mutation: { action: 'create-card', card },
    });
    // WHAT: Return the ledger's exact card-creation error to the controller.
    // WHY: Relationship creation must not continue without its target card.
    if (cardMutation.ok === false) return cardMutation.error?.body ?? { error: 'Could not create a pipeline step card.' };
    const relationship = {
      id: `rel-${safeRunId}-${index + 1}`.slice(0, 180),
      from: synchronizationRun ? input.run.sourceCardId : previousCardId,
      to: step.outputCardId,
      label: synchronizationRun ? 'subtask' : step.name,
    };
    relationshipIds.push(relationship.id);
    const relationMutation = applyLedgerMutation({
      decisionOsRoot: input.decisionOsRoot,
      ledgerPath: input.context.ledgerPath,
      ledger: input.context.ledger,
      mutation: { action: 'create-relationship', relationship },
    });
    // WHAT: Return the ledger's exact relationship-creation error to the controller.
    // WHY: A partial chain must not be reported as a launchable pipeline.
    if (relationMutation.ok === false) return relationMutation.error?.body ?? { error: 'Could not create a pipeline step relationship.' };
    previousCardId = step.outputCardId;
  }
  const firstSkill = input.run.steps[0]?.skills[0];
  input.source.codexQueuedPipelineRunId = input.run.id;
  input.source.codexQueuedRunId = firstSkill?.runId ?? '';
  input.source.codexActiveRunId = firstSkill?.runId ?? '';
  input.source.codexActiveExecutionId = firstSkill?.executionId ?? '';
  stripHydratedThreadNotes(input.context.ledger);
  persistLedgerProjection({
    decisionOsRoot: input.decisionOsRoot,
    ledgerId: input.context.ledgerId,
    ledgerPath: input.context.ledgerPath,
    ledger: input.context.ledger,
    runtime: input.context.runtime,
    command: {
      kind: 'create-codex-pipeline-cards',
      cardIds: [input.run.sourceCardId, ...input.run.steps.map((step) => step.outputCardId)],
      relationshipIds,
    },
  });
  return null;
}
