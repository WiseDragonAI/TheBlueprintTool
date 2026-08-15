/**
 * WHAT: Writes generated cards as positioned siblings for one pending Codex pipeline run.
 * WHY: Ledger mutations are the start controller's final output effect and must preserve the manifest's task topology.
 */
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import type { PipelineLedgerContext } from '../helper/codex-pipeline-runner.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

export async function createCodexPipelineStepCards(input: {
  decisionOsRoot: string;
  context: PipelineLedgerContext;
  run: CodexPipelineRun;
}): Promise<AnyRecord | null> {
  // WHAT: Skip the optional ledger presentation when this immutable run was admitted as cardless.
  // WHY: Pipeline execution artifacts and lifecycle remain authoritative without generated canvas cards.
  if (input.run.createStepCards === false) return null;
  const parent = (input.context.ledger.cards ?? [])
    .find((card) => String(card.id ?? '') === input.run.outputParentCardId);
  if (!parent) return { error: 'Pipeline output parent card not found.' };
  const parentX = Number(parent.x ?? 0);
  const parentY = Number(parent.y ?? 0);
  const parentWidth = Math.max(220, Number(parent.w ?? 360));
  const safeRunId = String(input.run.id || 'untitled')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
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
      x: parentX + parentWidth + 96 + step.outputSubtaskPosition * (700 + 96),
      y: parentY,
      w: 700,
      h: 260,
      status: 'todo',
      createdAt: input.run.createdAt,
      ...(synchronizationRun ? { labels: ['synchronization'] } : {}),
      codexPipelineRunId: input.run.id,
      codexPipelineStepId: step.stepId,
      codexPipelineStepName: step.name,
      codexPipelineName: input.run.pipelineName,
      codexRunId: firstSkill?.runId ?? '',
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
      from: input.run.outputParentCardId,
      to: step.outputCardId,
      label: 'subtask',
      position: step.outputSubtaskPosition,
    };
    relationshipIds.push(relationship.id);
    const relationMutation = applyLedgerMutation({
      decisionOsRoot: input.decisionOsRoot,
      ledgerPath: input.context.ledgerPath,
      ledger: input.context.ledger,
      mutation: { action: 'create-relationship', relationship },
    });
    // WHAT: Return the ledger's exact relationship-creation error to the controller.
    // WHY: A partial subtask set must not be reported as a launchable pipeline.
    if (relationMutation.ok === false) return relationMutation.error?.body ?? { error: 'Could not create a pipeline step relationship.' };
  }
  stripHydratedThreadNotes(input.context.ledger);
  await persistLedgerProjection({
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
