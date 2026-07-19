/**
 * WHAT: Orchestrates validation, durable setup, event publication, and first-skill launch for one Codex pipeline.
 * WHY: The full pending pipeline must be visible and durable before asynchronous execution begins.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type {
  CodexEffort,
  CodexModel,
  CodexPipeline,
  CodexPipelineRun,
  CodexPipelineStep,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { createCodexPipelineStepCards } from '../effect/create-codex-pipeline-step-cards.js';
import {
  createCodexPipelineRunManifest,
  type PipelineDefinition,
} from '../helper/create-codex-pipeline-run-manifest.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { scanCodexSkills } from '../helper/scan-codex-skills.js';
import { runtimeServerRoot } from '../helper/server-skill-context.js';
import { readScopedCodexPipelineStores } from '../helper/server-pipeline-catalog.js';
import {
  resolvePipelineLedgerContext,
  type PipelineLedgerContext,
} from '../helper/codex-pipeline-runner.js';
import { scheduleCodexProcesses, unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function sourceCard(context: PipelineLedgerContext, sourceCardId: string): AnyRecord | null {
  return (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === sourceCardId) ?? null;
}

function rollbackPipelineCards(input: { decisionOsRoot: string; context: PipelineLedgerContext; ledgerBefore: string; outputCardIds: string[] }): void {
  for (const cardId of input.outputCardIds) {
    const card = (input.context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
    const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
    const contentRef = text(comment.contentFile).replace(/^\.decision-os\//, '');
    const contentFile = resolve(input.decisionOsRoot, contentRef);
    const inner = relative(input.decisionOsRoot, contentFile);
    if (contentRef && inner && !inner.startsWith('..') && !isAbsolute(inner) && existsSync(contentFile)) rmSync(contentFile, { force: true });
  }
  writeFileSync(input.context.ledgerPath, input.ledgerBefore, 'utf8');
}

export async function startPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  definition: PipelineDefinition;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const availableSkills = scanCodexSkills({ workspaceRoot, serverRoot: runtimeServerRoot(input.runtime) });
  const availableSkillNames = availableSkills.map((skill) => skill.name);
  const normalized = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
  const unavailableSkill = input.definition.steps
    .flatMap((step) => step.skills)
    .find((skill) => !availableSkillNames.includes(skill.skillName));
  // WHAT: Reject definitions containing a skill that discovery cannot resolve.
  // WHY: Persisting pending work that cannot launch would strand the pipeline.
  if (unavailableSkill) return { ok: false, statusCode: 400, error: 'Pipeline references an unavailable skill.', skillName: unavailableSkill.skillName };
  const invalidDefault = normalized.issues.find((issue) =>
    (issue.code === 'unsupported-default-model' || issue.code === 'unsupported-default-effort')
    && input.definition.steps.some((step) => step.skills.some((skill) => skill.skillName === issue.skillName))
  );
  // WHAT: Stop before snapshotting an invalid library default.
  // WHY: Every persisted skill run must contain executable model and effort values.
  if (invalidDefault) return { ok: false, statusCode: 400, error: invalidDefault.message, skillName: invalidDefault.skillName };

  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.ledgerId,
  });
  // WHAT: Require the requested ledger and source card before creating output cards.
  // WHY: Generated cards and relationships must be anchored to an existing source.
  if (!context) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId: input.ledgerId };
  const source = sourceCard(context, input.sourceCardId);
  if (!source) return { ok: false, statusCode: 404, error: 'Source card not found.', cardId: input.sourceCardId };
  const activeRunId = text(source.codexActiveRunId);
  const activeExecutionId = text(source.codexActiveExecutionId);
  if (activeRunId || activeExecutionId) {
    const existing = normalized.store.runs.find((candidate) => candidate.ledgerId === input.ledgerId
      && candidate.sourceCardId === input.sourceCardId
      && (candidate.status === 'pending' || candidate.status === 'running')
      && candidate.steps.some((step) => step.skills.some((skill) => skill.runId === activeRunId && skill.executionId === activeExecutionId)));
    if (existing) return {
      ok: true,
      statusCode: 202,
      run: existing,
      skillRun: null,
      queuePosition: existing.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot: input.decisionOsRoot, id: existing.id, createdAt: existing.createdAt, runtime: input.runtime }) : null,
      maxConcurrentCodexProcesses: 0,
    };
    return { ok: false, statusCode: 409, error: 'Source card already owns an active Codex execution.', runId: activeRunId, executionId: activeExecutionId };
  }
  // WHAT: Reject empty pipeline shapes at the runtime boundary.
  // WHY: A run with no executable stage cannot make progress or settle correctly.
  if (input.definition.steps.length === 0) return { ok: false, statusCode: 400, error: 'A pipeline run requires at least one step.' };
  // WHAT: Require at least one executable skill in every stage.
  // WHY: An empty stage would leave the sequential runner without a next transition.
  if (input.definition.steps.some((step) => step.skills.length === 0)) {
    return { ok: false, statusCode: 400, error: 'Every pipeline step must contain at least one skill.' };
  }

  let run: CodexPipelineRun;
  try {
    run = createCodexPipelineRunManifest({
      decisionOsRoot: input.decisionOsRoot,
      definition: input.definition,
      store: normalized.store,
      workspaceRoot,
      runtime: input.runtime,
      ledgerId: input.ledgerId,
      sourceCardId: input.sourceCardId,
      sourceCardTitle: String(source.title ?? input.sourceCardId),
      ledgerPath: context.ledgerPath,
    });
  } catch (error) {
    // WHAT: Surface option-resolution errors as request failures.
    // WHY: Invalid model and effort inputs are operator-correctable, not server faults.
    return { ok: false, statusCode: 400, error: error instanceof Error ? error.message : String(error) };
  }
  const ledgerBefore = readFileSync(context.ledgerPath, 'utf8');
  const cardError = createCodexPipelineStepCards({ decisionOsRoot: input.decisionOsRoot, context, source, run });
  // WHAT: Stop when the ledger rejects a generated card or relationship.
  // WHY: The manifest must not start unless its complete visual chain exists.
  if (cardError) {
    rollbackPipelineCards({ decisionOsRoot: input.decisionOsRoot, context, ledgerBefore, outputCardIds: run.steps.map((step) => step.outputCardId) });
    return { ok: false, statusCode: 400, error: String(cardError.error ?? 'Could not create pipeline step cards.') };
  }
  try {
    writeCodexPipelineStore({
      decisionOsRoot: input.decisionOsRoot,
      availableSkillNames,
      store: { ...normalized.store, runs: [...normalized.store.runs, run] },
    });
  } catch {
    rollbackPipelineCards({ decisionOsRoot: input.decisionOsRoot, context, ledgerBefore, outputCardIds: run.steps.map((step) => step.outputCardId) });
    // WHAT: Report manifest persistence failure before launching Codex.
    // WHY: An untracked child process could not be resumed or cancelled safely.
    return { ok: false, statusCode: 500, error: 'Could not persist the pipeline run manifest.' };
  }
  // WHAT: Retain and invoke the request-scoped ledger callback when one is supplied.
  // WHY: Pipeline runner transitions must publish through the same server event boundary as startup.
  if (typeof input.onLedgerChange === 'function') input.runtime.onPipelineLedgerChange = input.onLedgerChange;
  if (typeof input.onLedgerChange === 'function') {
    const firstSkill = run.steps[0]?.skills[0];
    (input.onLedgerChange as (event: AnyRecord) => void)({
      reason: 'pipeline-enqueued',
      ledgerId: input.ledgerId,
      pipelineRunId: run.id,
      runId: firstSkill?.runId ?? '',
      executionId: firstSkill?.executionId ?? '',
      status: 'pending',
      cardId: input.sourceCardId,
      cardIds: run.steps.map((step) => step.outputCardId),
    });
  }
  const sharedSchedule = input.runtime.scheduleCodexProcesses;
  if (run.executionMode === 'federated') {
    return { ok: true, statusCode: 202, run, skillRun: null, queuePosition: null, maxConcurrentCodexProcesses: 0 };
  }
  const schedule = typeof sharedSchedule === 'function'
    ? await sharedSchedule()
    : await scheduleCodexProcesses({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime });
  const launches = Array.isArray(schedule.launched) ? schedule.launched as AnyRecord[] : [];
  const launch = launches.find((entry) => entry.run && typeof entry.run === 'object' && String((entry.run as AnyRecord).id ?? '') === run.id);
  if (launch?.ok === false) return launch;
  const persisted = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store;
  const scheduledRun = persisted.runs.find((entry) => entry.id === run.id) ?? run;
  return {
    ok: true,
    statusCode: 202,
    run: scheduledRun,
    skillRun: launch?.skillRun ?? null,
    queuePosition: scheduledRun.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot: input.decisionOsRoot, id: run.id, createdAt: run.createdAt, runtime: input.runtime }) : null,
    maxConcurrentCodexProcesses: schedule.capacity,
  };
}

export async function startTemporaryPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  skillName: string;
  codexModel?: CodexModel | null;
  codexEffort?: CodexEffort | null;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  const now = new Date().toISOString();
  return startPipelineRun({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.ledgerId,
    sourceCardId: input.sourceCardId,
    onLedgerChange: input.onLedgerChange,
    definition: {
      pipelineId: null,
      pipelineName: `${input.skillName} run`,
      temporary: true,
      steps: [{
        id: `temporary-step-${safeSegment(input.skillName)}`,
        name: input.skillName,
        purpose: `Run ${input.skillName} once.`,
        skills: [{
          id: `temporary-skill-${safeSegment(input.skillName)}`,
          skillName: input.skillName,
          codexModel: input.codexModel ?? null,
          codexEffort: input.codexEffort ?? null,
        }],
        createdAt: now,
        updatedAt: now,
      }],
    },
  });
}

export async function startFederatedPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  definition: PipelineDefinition;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  return startPipelineRun({
    ...input,
    definition: { ...input.definition, executionMode: 'federated' },
  });
}

function pipelineDefinition(input: {
  pipeline: CodexPipeline;
  steps: readonly CodexPipelineStep[];
}): PipelineDefinition | null {
  const stepsById = new Map(input.steps.map((step) => [step.id, step]));
  const ordered = input.pipeline.stepIds.map((stepId) => stepsById.get(stepId));
  // WHAT: Reject a saved pipeline whose ordered step reference is missing.
  // WHY: Runtime order must come entirely from the persisted pipeline definition.
  if (ordered.some((step) => !step)) return null;
  return {
    pipelineId: input.pipeline.id,
    pipelineName: input.pipeline.name,
    temporary: false,
    steps: ordered as CodexPipelineStep[],
  };
}

export async function startCodexPipelineRunController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = text(payload.ledgerId);
  const sourceCardId = text(payload.sourceCardId ?? payload.cardId);
  const pipelineId = text(payload.pipelineId);
  // WHAT: Require all identifiers needed to resolve and anchor the saved pipeline.
  // WHY: The controller cannot infer a workspace ledger, source card, or definition.
  if (!ledgerId || !sourceCardId || !pipelineId) {
    return { ok: false, statusCode: 400, error: 'Missing ledgerId, sourceCardId, or pipelineId.' };
  }
  const availableSkillNames = scanCodexSkills({ workspaceRoot: dirname(decisionOsRoot), serverRoot: runtimeServerRoot(runtime) }).map((skill) => skill.name);
  const scoped = readScopedCodexPipelineStores({ decisionOsRoot, runtime, availableSkillNames });
  const serverPipeline = scoped.server.store.pipelines.find((entry) => entry.id === pipelineId);
  const normalized = serverPipeline ? scoped.server : scoped.project;
  const pipeline = serverPipeline ?? normalized?.store.pipelines.find((entry) => entry.id === pipelineId);
  // WHAT: Return a distinct missing-definition response.
  // WHY: Operators can repair a deleted pipeline separately from invalid references.
  if (!pipeline) return { ok: false, statusCode: 404, error: 'Pipeline not found.', pipelineId };
  const invalidReferences = normalized?.invalidReferences.filter((entry) => entry.pipelineId === pipelineId) ?? [];
  // WHAT: Return every invalid saved reference before constructing the runtime definition.
  // WHY: The editor needs the complete repair set and the runner cannot resolve partial definitions.
  if (invalidReferences.length > 0) {
    return { ok: false, statusCode: 400, error: 'Pipeline contains invalid references.', pipelineId, invalidReferences };
  }
  const definition = pipelineDefinition({ pipeline, steps: normalized?.store.steps ?? [] });
  // WHAT: Reject an incomplete ordered definition before the shared start lifecycle.
  // WHY: The runner requires every saved step to be present and ordered.
  if (!definition) return { ok: false, statusCode: 400, error: 'Pipeline contains a missing saved step.', pipelineId };
  return startPipelineRun({
    decisionOsRoot,
    runtime,
    ledgerId,
    sourceCardId,
    definition,
    onLedgerChange: payload.onLedgerChange,
  });
}
