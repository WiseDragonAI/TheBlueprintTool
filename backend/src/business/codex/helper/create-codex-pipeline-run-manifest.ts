/**
 * WHAT: Derives one immutable pending pipeline-run manifest from a validated definition.
 * WHY: Run identifiers, output paths, and resolved option snapshots are pure construction work, not controller behavior.
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type {
  CodexPipelineRun,
  CodexPipelineRunSkill,
  CodexPipelineRunStep,
  CodexPipelineStep,
  CodexPipelineStore,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { resolveCodexPipelineRunDirectory } from './resolve-codex-pipeline-run-directory.js';
import { resolveSkillRunOptions } from './resolve-codex-command.js';
import {
  assertPipelineRunSkillPromptEvidence,
  type AdmittedPipelinePromptSnapshot,
} from './pipeline-prompt-snapshot.js';

type AnyRecord = Record<string, unknown>;

export type PipelineDefinition = {
  pipelineId: string | null;
  pipelineName: string;
  temporary: boolean;
  executionMode?: 'local' | 'federated';
  steps: readonly CodexPipelineStep[];
};

export function createCodexPipelineRunManifest(input: {
  decisionOsRoot: string;
  definition: PipelineDefinition;
  store: CodexPipelineStore;
  workspaceRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  sourceCardTitle: string;
  outputParentCardId: string;
  firstOutputSubtaskPosition: number;
  ledgerPath: string;
  restartOfPipelineRunId?: string | null;
  queuedAfterExecutionId?: string | null;
  initialInputCardId?: string | null;
  reservedRunId?: string;
  reservedFirstExecutionId?: string;
  admittedPromptSnapshots?: ReadonlyMap<string, AdmittedPipelinePromptSnapshot>;
}): CodexPipelineRun {
  // WHAT: Preserve the legacy skill-run identifier for one-step temporary pipelines.
  // WHY: Existing direct-skill status and cancellation routes address that identifier.
  const runPrefix = input.definition.temporary ? 'codex-skill' : 'codex-pipeline';
  const runId = input.reservedRunId || `${runPrefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const directory = resolveCodexPipelineRunDirectory(input.decisionOsRoot, input.ledgerPath);
  const defaultsBySkill = new Map(input.store.skillLibrary.map((record) => [record.skillName, record]));
  const now = new Date().toISOString();
  const steps: CodexPipelineRunStep[] = input.definition.steps.map((step, stepIndex) => {
    // WHAT: Keep a temporary direct run on its legacy single-card identifier.
    // WHY: Saved pipelines need explicit step suffixes while direct runs retain API compatibility.
    const outputCardId = input.definition.temporary && stepIndex === 0
      ? `card-${runId}`
      : `card-${runId}-step-${stepIndex + 1}`;
    return {
      id: `${runId}-step-${stepIndex + 1}`,
      stepId: step.id,
      name: step.name,
      purpose: step.purpose,
      outputCardId,
      outputSubtaskPosition: input.firstOutputSubtaskPosition + stepIndex,
      status: 'pending',
      skills: step.skills.map((skill, skillIndex) => {
        // WHAT: Reuse the temporary pipeline id as its sole skill-run id.
        // WHY: Direct-skill clients treat the returned run id as both pipeline and skill identity.
        const skillRunId = input.definition.temporary && stepIndex === 0 && skillIndex === 0
          ? runId
          : input.reservedRunId
            ? `${runId}-skill-${stepIndex + 1}-${skillIndex + 1}`
            : `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const executionId = input.reservedFirstExecutionId
          ? stepIndex === 0 && skillIndex === 0
            ? input.reservedFirstExecutionId
            : `${input.reservedFirstExecutionId}-${stepIndex + 1}-${skillIndex + 1}`
          : `codex-execution-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const defaults = defaultsBySkill.get(skill.skillName);
        const resolved = resolveSkillRunOptions({
          workspaceRoot: input.workspaceRoot,
          runtime: input.runtime,
          explicitCodexModel: skill.codexModel,
          explicitCodexEffort: skill.codexEffort,
          defaultCodexModel: defaults?.defaultCodexModel,
          defaultCodexEffort: defaults?.defaultCodexEffort,
        });
        const base = {
          id: `${runId}-step-${stepIndex + 1}-skill-${skillIndex + 1}`,
          pipelineSkillId: skill.id,
          skillName: skill.skillName,
          runId: skillRunId,
          executionId,
          status: 'pending' as const,
          codexModel: resolved.codexModel,
          codexEffort: resolved.codexEffort,
          stdoutFile: resolve(directory, `${skillRunId}.jsonl`),
          stderrFile: resolve(directory, `${skillRunId}.log`),
          startedAt: null as null,
          finishedAt: null as null,
          error: '',
        };
        const evidence = input.admittedPromptSnapshots?.get(skill.skillName);
        if (!evidence) throw new Error('pipeline_developer_prompt_snapshot_missing');
        const admitted: CodexPipelineRunSkill = {
          ...base,
          contentKind: skill.contentKind,
          ...evidence,
        } as CodexPipelineRunSkill;
        assertPipelineRunSkillPromptEvidence(admitted);
        return admitted;
      }),
      startedAt: null,
      finishedAt: null,
      error: '',
    };
  });
  return {
    id: runId,
    restartOfPipelineRunId: input.restartOfPipelineRunId ?? null,
    queuedAfterExecutionId: input.queuedAfterExecutionId ?? null,
    initialInputCardId: input.initialInputCardId ?? null,
    pipelineId: input.definition.pipelineId,
    pipelineName: input.definition.pipelineName,
    temporary: input.definition.temporary,
    createStepCards: (input.runtime.decisionOsSettings as AnyRecord | undefined)?.createPipelineStepCards !== false,
    executionMode: input.definition.executionMode ?? 'local',
    ledgerId: input.ledgerId,
    sourceCardId: input.sourceCardId,
    sourceCardTitle: input.sourceCardTitle,
    outputParentCardId: input.outputParentCardId,
    status: 'pending',
    steps,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    resumedAt: null,
    error: '',
  };
}
