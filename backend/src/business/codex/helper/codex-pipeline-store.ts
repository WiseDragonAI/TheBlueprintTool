/**
 * WHAT: Reads, normalizes, and atomically writes the workspace Codex pipeline store.
 * WHY: Saved pipelines, reusable steps, run manifests, and skill defaults must survive server restarts.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import type {
  CodexAuthoredContentRecord,
  CodexContentKind,
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineRun,
  CodexPipelineRunSkill,
  CodexPipelineRunStep,
  CodexPipelineSkill,
  CodexPipelineStatus,
  CodexPipelineStep,
  CodexPipelineStore,
  CodexPipelineStoreIssue,
  CodexPipelineStoreNormalization,
  CodexSkillLibraryRecord,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { codexPipelineStoreVersion } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { codexContentKinds } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { codexSkillTags } from './codex-skill-tags.js';
import { isAllowedCodexEffort, isAllowedCodexModel } from './resolve-codex-command.js';
import {
  createRuntimeIncidentLedger,
  RuntimeScopePausedError,
} from '../../server/helper/runtime-incident-ledger.js';

type AnyRecord = Record<string, unknown>;

export type CodexPipelineStoreNormalizationOptions = {
  availableSkillNames?: Iterable<string>;
  availableContentKinds?: Iterable<readonly [string, CodexContentKind]>;
};

export type CodexPipelineStoreInput = CodexPipelineStoreNormalizationOptions & {
  decisionOsRoot: string;
};

export type CodexPipelineStoreAvailable = CodexPipelineStoreNormalization & {
  readonly availability: 'available';
};

export type CodexPipelineStoreUnavailable = CodexPipelineStoreNormalization & {
  readonly availability: 'unavailable';
  readonly file: string;
  readonly scope: string;
  readonly incidentId: string;
  readonly unavailableCode:
    | 'codex_pipeline_store_corrupt'
    | 'codex_pipeline_store_invalid'
    | 'codex_pipeline_store_unsupported_version';
  readonly message: string;
};

export type CodexPipelineStoreReadResult =
  | CodexPipelineStoreAvailable
  | CodexPipelineStoreUnavailable;

const reviewedPipelineStoreScopes = new Set<string>();
const unavailablePipelineStoreScopes = new Set<string>();
const mutationWaitArray = new Int32Array(new SharedArrayBuffer(4));
const mutationDeadlineMs = 5_000;

export class CodexPipelineStoreCorruptionError extends Error {
  readonly code = 'codex_pipeline_store_corrupt';
  constructor(readonly file: string, message: string) {
    super(`Refusing to replace the invalid Codex pipeline store ${file}: ${message}`);
  }
}

export class CodexPipelineStoreBusyError extends Error {
  readonly code = 'codex_pipeline_store_busy';
  constructor(readonly file: string) {
    super(`The Codex pipeline store mutation owner is busy: ${file}`);
  }
}

const writeBlockingIssueCodes = new Set([
  'invalid-store',
  'unsupported-store-version',
  'invalid-step-id',
  'duplicate-step-id',
  'duplicate-step-skill-id',
  'invalid-pipeline-id',
  'duplicate-pipeline-id',
  'invalid-run-id',
  'duplicate-run-id',
  'empty-skill-library-name',
  'duplicate-skill-library-name',
  'invalid-active-workspace-run',
  'unsupported-default-effort',
  'unsupported-default-model',
  'unsupported-pipeline-skill-effort',
  'unsupported-pipeline-skill-model',
  'invalid-pipeline-content-kind',
  'pipeline-content-kind-mismatch',
  'invalid-pipeline-prompt-snapshot',
  'invalid-developer-prompt-envelope',
  'invalid-authored-content-id',
  'duplicate-authored-content-id',
  'invalid-authored-content-kind',
  'invalid-authored-content-file',
]);

export function codexPipelineStoreWriteBlocker(normalized: CodexPipelineStoreNormalization): CodexPipelineStoreIssue | null {
  return normalized.issues.find((entry) => writeBlockingIssueCodes.has(entry.code)) ?? null;
}

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function skillTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(codexSkillTags);
  return [...new Set(value.map(text).filter((tag) => allowed.has(tag)))].slice(0, 1);
}

function status(value: unknown): CodexPipelineStatus {
  const normalized = text(value);
  return normalized === 'running' || normalized === 'complete' || normalized === 'failed' || normalized === 'cancelled'
    ? normalized
    : 'pending';
}

function issue(input: CodexPipelineStoreIssue): CodexPipelineStoreIssue {
  return input;
}

function emptyStore(): CodexPipelineStore {
  return {
    version: codexPipelineStoreVersion,
    pipelines: [],
    steps: [],
    runs: [],
    skillLibrary: [],
    authoredContent: [],
    activeWorkspaceRun: null,
  };
}

function pipelineStoreScope(file: string): string {
  return `codex-pipeline-store:${resolve(file)}`;
}

function pipelineStoreBytes(store: CodexPipelineStore): string {
  return `${JSON.stringify(store, null, 2)}\n`;
}

function pipelineStoreRawBytes(store: AnyRecord): string {
  return `${JSON.stringify(store, null, 2)}\n`;
}

export function codexPipelineStoreContentRevision(store: CodexPipelineStore): string {
  return createHash('sha256').update(pipelineStoreBytes(store)).digest('hex');
}

function availablePipelineStore(
  input: CodexPipelineStoreInput,
  normalized: CodexPipelineStoreNormalization,
  resolution = 'The Codex pipeline store was re-read and validated.',
): CodexPipelineStoreAvailable {
  const file = pipelineStoreFile(input.decisionOsRoot);
  const scope = pipelineStoreScope(file);
  if (!reviewedPipelineStoreScopes.has(scope) || unavailablePipelineStoreScopes.has(scope)) {
    const ledger = createRuntimeIncidentLedger({ decisionOsRoot: input.decisionOsRoot });
    const active = ledger.active(scope);
    const requiresCatalogAuthority = active.some((incident) => (
      incident.code === 'codex_pipeline_store_invalid'
      && Array.isArray(incident.context.issueCodes)
      && incident.context.issueCodes.includes('pipeline-content-kind-mismatch')
    ));
    // WHAT: A reader without the live content catalog may consume run state but cannot clear a discriminator incident.
    // WHY: The scheduler previously treated the same invalid bytes as valid and erased the strict reader's pause every second.
    const canResolve = input.availableContentKinds !== undefined || !requiresCatalogAuthority;
    const resolved = active.length > 0 && canResolve
      ? ledger.resolveScope(scope, resolution)
      : [];
    reviewedPipelineStoreScopes.add(scope);
    if (active.length === 0 || (canResolve && resolved.length === active.length)) unavailablePipelineStoreScopes.delete(scope);
  }
  return { ...normalized, availability: 'available' };
}

function unavailablePipelineStore(input: {
  storeInput: CodexPipelineStoreInput;
  normalized: CodexPipelineStoreNormalization;
  error: unknown;
  unavailableCode: CodexPipelineStoreUnavailable['unavailableCode'];
  message: string;
  context?: Record<string, unknown>;
}): CodexPipelineStoreUnavailable {
  const file = pipelineStoreFile(input.storeInput.decisionOsRoot);
  const scope = pipelineStoreScope(file);
  const incident = createRuntimeIncidentLedger({ decisionOsRoot: input.storeInput.decisionOsRoot }).record({
    scope,
    component: 'codex-pipeline-store',
    operation: 'read',
    code: input.unavailableCode,
    error: input.error,
    context: {
      file,
      issueCodes: input.normalized.issues.map((entry) => entry.code),
      ...input.context,
    },
  });
  reviewedPipelineStoreScopes.add(scope);
  unavailablePipelineStoreScopes.add(scope);
  const unavailable = {
    ...input.normalized,
    availability: 'unavailable' as const,
    file,
    scope,
    incidentId: incident.id,
    unavailableCode: input.unavailableCode,
    message: input.message,
  };
  Object.defineProperty(unavailable, 'store', {
    enumerable: true,
    configurable: false,
    get(): never {
      throw new RuntimeScopePausedError(scope, incident.id);
    },
  });
  return unavailable;
}

export function assertCodexPipelineStoreAvailable(
  result: CodexPipelineStoreReadResult,
): asserts result is CodexPipelineStoreAvailable {
  if (result.availability === 'unavailable') {
    throw new RuntimeScopePausedError(result.scope, result.incidentId);
  }
}

const contentKindSet = new Set<string>(codexContentKinds);
const safeContentId = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/;

function normalizePipelineSkill(
  input: AnyRecord,
  stepId: string,
  index: number,
  issues: CodexPipelineStoreIssue[],
  availableContentKinds: ReadonlyMap<string, CodexContentKind>,
  strictDiscriminator: boolean,
): CodexPipelineSkill {
  const id = text(input.id) || `${stepId}-skill-${index + 1}`;
  const skillName = text(input.skillName);
  const requestedKind = text(input.contentKind);
  const inferredKind = availableContentKinds.get(skillName) ?? 'federated-skill';
  const contentKind = contentKindSet.has(requestedKind)
    ? requestedKind as CodexContentKind
    : inferredKind;
  if (requestedKind && !contentKindSet.has(requestedKind)) {
    issues.push(issue({
      code: 'invalid-pipeline-content-kind',
      message: `Pipeline content ${id} has an invalid content kind.`,
      stepId,
      skillId: id,
      skillName,
    }));
  }
  if (strictDiscriminator && !requestedKind) {
    issues.push(issue({
      code: 'invalid-pipeline-content-kind',
      message: `Pipeline content ${id} has no content kind.`,
      stepId,
      skillId: id,
      skillName,
    }));
  }
  const availableKind = availableContentKinds.get(skillName);
  if (availableKind && requestedKind && availableKind !== contentKind) {
    issues.push(issue({
      code: 'pipeline-content-kind-mismatch',
      message: `Pipeline content ${skillName} is ${availableKind}, not ${contentKind}.`,
      stepId,
      skillId: id,
      skillName,
    }));
  }
  const requestedModel = input.codexModel;
  const requestedEffort = input.codexEffort;
  const codexModel = requestedModel === null || requestedModel === undefined
    ? null
    : isAllowedCodexModel(requestedModel)
      ? text(requestedModel) as CodexPipelineSkill['codexModel']
      : null;
  const codexEffort = requestedEffort === null || requestedEffort === undefined
    ? null
    : isAllowedCodexEffort(requestedEffort)
      ? text(requestedEffort) as CodexPipelineSkill['codexEffort']
      : null;
  if (requestedModel !== null && requestedModel !== undefined && codexModel === null) {
    issues.push(issue({
      code: 'unsupported-pipeline-skill-model',
      message: `Pipeline skill ${id} has an unsupported Codex model.`,
      stepId,
      skillId: id,
      skillName,
    }));
  }
  if (requestedEffort !== null && requestedEffort !== undefined && codexEffort === null) {
    issues.push(issue({
      code: 'unsupported-pipeline-skill-effort',
      message: `Pipeline skill ${id} has an unsupported Codex effort.`,
      stepId,
      skillId: id,
      skillName,
    }));
  }
  return { id, skillName, contentKind, codexModel, codexEffort };
}

function normalizeSteps(
  raw: unknown,
  issues: CodexPipelineStoreIssue[],
  availableContentKinds: ReadonlyMap<string, CodexContentKind>,
  strictDiscriminator: boolean,
): CodexPipelineStep[] {
  const normalized: CodexPipelineStep[] = [];
  const seen = new Set<string>();
  for (const input of records(raw)) {
    const id = text(input.id);
    if (!id) {
      issues.push(issue({ code: 'invalid-step-id', message: 'A saved pipeline step has no id.' }));
      continue;
    }
    if (seen.has(id)) {
      issues.push(issue({ code: 'duplicate-step-id', message: `Duplicate saved step id: ${id}.`, stepId: id }));
      continue;
    }
    seen.add(id);
    const skills: CodexPipelineSkill[] = [];
    const seenSkills = new Set<string>();
    for (const [index, rawSkill] of records(input.skills).entries()) {
      const skill = normalizePipelineSkill(rawSkill, id, index, issues, availableContentKinds, strictDiscriminator);
      if (seenSkills.has(skill.id)) {
        issues.push(issue({
          code: 'duplicate-step-skill-id',
          message: `Duplicate pipeline skill id ${skill.id} in saved step ${id}.`,
          stepId: id,
          skillId: skill.id,
          skillName: skill.skillName,
        }));
        continue;
      }
      seenSkills.add(skill.id);
      skills.push(skill);
    }
    normalized.push({
      id,
      name: text(input.name) || id,
      purpose: text(input.purpose),
      skills,
      createdAt: text(input.createdAt),
      updatedAt: text(input.updatedAt),
    });
  }
  return normalized;
}

function normalizePipelines(raw: unknown, issues: CodexPipelineStoreIssue[]): CodexPipeline[] {
  const normalized: CodexPipeline[] = [];
  const seen = new Set<string>();
  for (const input of records(raw)) {
    const id = text(input.id);
    if (!id) {
      issues.push(issue({ code: 'invalid-pipeline-id', message: 'A saved pipeline has no id.' }));
      continue;
    }
    if (seen.has(id)) {
      issues.push(issue({ code: 'duplicate-pipeline-id', message: `Duplicate pipeline id: ${id}.`, pipelineId: id }));
      continue;
    }
    seen.add(id);
    normalized.push({
      id,
      name: text(input.name) || id,
      purpose: text(input.purpose),
      stepIds: Array.isArray(input.stepIds) ? input.stepIds.map(text).filter(Boolean) : [],
      createdAt: text(input.createdAt),
      updatedAt: text(input.updatedAt),
    });
  }
  return normalized;
}

function normalizeRunSkill(
  input: AnyRecord,
  stepId: string,
  index: number,
  issues: CodexPipelineStoreIssue[],
): CodexPipelineRunSkill {
  const executorInput = record(input.executor);
  const executor = executorInput.kind === 'federated' && text(executorInput.nodeId) && text(executorInput.projectId)
    ? {
        kind: 'federated' as const,
        nodeId: text(executorInput.nodeId),
        projectId: text(executorInput.projectId),
        role: text(executorInput.role),
      }
    : undefined;
  const runId = text(input.runId);
  const processId = Math.max(0, Math.floor(Number(input.processId ?? 0) || 0));
  const processStartTime = text(input.processStartTime);
  const base = {
    id: text(input.id) || `${stepId}-run-skill-${index + 1}`,
    pipelineSkillId: text(input.pipelineSkillId),
    skillName: text(input.skillName),
    runId,
    executionId: text(input.executionId) || `${runId}:execution:0`,
    status: status(input.status),
    codexModel: text(input.codexModel),
    codexEffort: text(input.codexEffort),
    stdoutFile: text(input.stdoutFile),
    stderrFile: text(input.stderrFile),
    ...(processId > 0 ? { processId } : {}),
    ...(processStartTime ? { processStartTime } : {}),
    startedAt: nullableText(input.startedAt),
    finishedAt: nullableText(input.finishedAt),
    error: text(input.error),
    ...(executor ? { executor } : {}),
  };
  if (input.syntaxVersion === 2) {
    const contentKind = text(input.contentKind);
    const developerPromptSnapshot = typeof input.developerPromptSnapshot === 'string'
      ? input.developerPromptSnapshot
      : '';
    const developerPromptRevision = text(input.developerPromptRevision);
    const developerPromptCommit = text(input.developerPromptCommit);
    if (
      !contentKindSet.has(contentKind)
      || !developerPromptSnapshot.trim()
      || !/^[a-f0-9]{64}$/.test(developerPromptRevision)
      || createHash('sha256').update(developerPromptSnapshot).digest('hex') !== developerPromptRevision
      || !/^[a-f0-9]{40,64}$/.test(developerPromptCommit)
    ) {
      issues.push(issue({
        code: 'invalid-developer-prompt-envelope',
        message: `Pipeline run skill ${base.id} has incomplete immutable developer-prompt evidence.`,
        stepId,
        skillId: base.id,
        skillName: base.skillName,
        runId,
      }));
    }
    return {
      ...base,
      contentKind: contentKindSet.has(contentKind) ? contentKind as CodexContentKind : 'federated-skill',
      syntaxVersion: 2,
      developerPromptSnapshot,
      developerPromptRevision,
      developerPromptCommit,
    };
  }
  if (input.contentKind === 'pipeline-prompt') {
    if (!text(input.contentRevision) || !text(input.contentCommit) || typeof input.promptSnapshot !== 'string') {
      issues.push(issue({
        code: 'invalid-pipeline-prompt-snapshot',
        message: `Pipeline prompt run skill ${base.id} has incomplete immutable admission evidence.`,
        stepId,
        skillId: base.id,
        skillName: base.skillName,
        runId,
      }));
    }
    return {
      ...base,
      contentKind: 'pipeline-prompt',
      contentRevision: text(input.contentRevision),
      contentCommit: text(input.contentCommit),
      promptSnapshot: typeof input.promptSnapshot === 'string' ? input.promptSnapshot : '',
    };
  }
  return {
    ...base,
    contentKind: input.contentKind === 'workspace-skill' ? 'workspace-skill' : 'federated-skill',
  };
}

function normalizeAuthoredContent(raw: unknown, issues: CodexPipelineStoreIssue[]): CodexAuthoredContentRecord[] {
  const normalized: CodexAuthoredContentRecord[] = [];
  const seen = new Set<string>();
  for (const input of records(raw)) {
    const id = text(input.id);
    if (!safeContentId.test(id)) {
      issues.push(issue({ code: 'invalid-authored-content-id', message: 'An authored-content record has an invalid id.', skillName: id || undefined }));
      continue;
    }
    if (seen.has(id)) {
      issues.push(issue({ code: 'duplicate-authored-content-id', message: `Duplicate authored-content id: ${id}.`, skillName: id }));
      continue;
    }
    seen.add(id);
    const kind = text(input.kind);
    if (!contentKindSet.has(kind)) {
      issues.push(issue({ code: 'invalid-authored-content-kind', message: `Authored content ${id} has an invalid kind.`, skillName: id }));
      continue;
    }
    const contentFile = text(input.contentFile).replace(/\\/g, '/').replace(/^\.\//, '');
    const expectedFile = kind === 'pipeline-prompt'
      ? `pipeline-prompts/${id}.md`
      : `.skills/${id}/SKILL.md`;
    const projectId = text(input.projectId);
    if (contentFile !== expectedFile || (kind === 'workspace-skill' && !projectId)) {
      issues.push(issue({ code: 'invalid-authored-content-file', message: `Authored content ${id} has an unsafe content file.`, skillName: id }));
      continue;
    }
    const common = {
      id,
      description: text(input.description),
      createdAt: text(input.createdAt),
      updatedAt: text(input.updatedAt),
    };
    if (kind === 'pipeline-prompt') {
      normalized.push({ ...common, kind, contentFile: `pipeline-prompts/${id}.md` });
    } else if (kind === 'workspace-skill') {
      normalized.push({ ...common, kind, projectId, contentFile: `.skills/${id}/SKILL.md` });
    } else {
      normalized.push({ ...common, kind: 'federated-skill', contentFile: `.skills/${id}/SKILL.md` });
    }
  }
  return normalized;
}

function normalizeRunStep(
  input: AnyRecord,
  runId: string,
  index: number,
  issues: CodexPipelineStoreIssue[],
): CodexPipelineRunStep {
  const id = text(input.id) || `${runId}-run-step-${index + 1}`;
  const outputSubtaskPosition = Number(input.outputSubtaskPosition);
  return {
    id,
    stepId: text(input.stepId),
    name: text(input.name) || text(input.stepId) || id,
    purpose: text(input.purpose),
    outputCardId: text(input.outputCardId),
    outputSubtaskPosition: Number.isSafeInteger(outputSubtaskPosition) && outputSubtaskPosition >= 0
      ? outputSubtaskPosition
      : index,
    status: status(input.status),
    skills: records(input.skills).map((skill, skillIndex) => normalizeRunSkill(skill, id, skillIndex, issues)),
    startedAt: nullableText(input.startedAt),
    finishedAt: nullableText(input.finishedAt),
    error: text(input.error),
  };
}

function normalizeRuns(raw: unknown, issues: CodexPipelineStoreIssue[]): CodexPipelineRun[] {
  const normalized: CodexPipelineRun[] = [];
  const seen = new Set<string>();
  for (const input of records(raw)) {
    const id = text(input.id);
    if (!id) {
      issues.push(issue({ code: 'invalid-run-id', message: 'A pipeline run manifest has no id.' }));
      continue;
    }
    if (seen.has(id)) {
      issues.push(issue({ code: 'duplicate-run-id', message: `Duplicate pipeline run id: ${id}.`, runId: id }));
      continue;
    }
    seen.add(id);
    normalized.push({
      id,
      restartOfPipelineRunId: nullableText(input.restartOfPipelineRunId),
      queuedAfterExecutionId: nullableText(input.queuedAfterExecutionId),
      initialInputCardId: nullableText(input.initialInputCardId),
      pipelineId: nullableText(input.pipelineId),
      pipelineName: text(input.pipelineName),
      temporary: input.temporary === true,
      executionMode: input.executionMode === 'federated' ? 'federated' : 'local',
      ledgerId: text(input.ledgerId),
      sourceCardId: text(input.sourceCardId),
      sourceCardTitle: text(input.sourceCardTitle),
      outputParentCardId: text(input.outputParentCardId) || text(input.sourceCardId),
      status: status(input.status),
      steps: records(input.steps).map((step, stepIndex) => normalizeRunStep(step, id, stepIndex, issues)),
      createdAt: text(input.createdAt),
      updatedAt: text(input.updatedAt),
      startedAt: nullableText(input.startedAt),
      finishedAt: nullableText(input.finishedAt),
      resumedAt: nullableText(input.resumedAt),
      error: text(input.error),
    });
  }
  return normalized;
}

function normalizeSkillLibrary(
  raw: unknown,
  availableSkillNames: Set<string> | null,
  issues: CodexPipelineStoreIssue[],
): CodexSkillLibraryRecord[] {
  const normalized: CodexSkillLibraryRecord[] = [];
  const seen = new Set<string>();
  for (const input of records(raw)) {
    const skillName = text(input.skillName);
    if (!skillName) {
      issues.push(issue({ code: 'empty-skill-library-name', message: 'A skill-library record has no skill name.' }));
      continue;
    }
    if (seen.has(skillName)) {
      issues.push(issue({
        code: 'duplicate-skill-library-name',
        message: `Duplicate skill-library record: ${skillName}.`,
        skillName,
      }));
      continue;
    }
    seen.add(skillName);
    const requestedModel = input.defaultCodexModel;
    const requestedEffort = input.defaultCodexEffort;
    const validModel = requestedModel === null || requestedModel === undefined || isAllowedCodexModel(requestedModel);
    const validEffort = requestedEffort === null || requestedEffort === undefined || isAllowedCodexEffort(requestedEffort);
    if (!validModel) {
      issues.push(issue({
        code: 'unsupported-default-model',
        message: `Skill ${skillName} has an unsupported default Codex model.`,
        skillName,
      }));
    }
    if (!validEffort) {
      issues.push(issue({
        code: 'unsupported-default-effort',
        message: `Skill ${skillName} has an unsupported default Codex effort.`,
        skillName,
      }));
    }
    if (!validModel || !validEffort) continue;
    if (availableSkillNames && !availableSkillNames.has(skillName)) {
      issues.push(issue({
        code: 'stale-skill-library-record',
        message: `Skill-library record references an unavailable skill: ${skillName}.`,
        skillName,
      }));
    }
    normalized.push({
      skillName,
      favorite: input.favorite === true,
      tags: skillTags(input.tags),
      defaultCodexModel: requestedModel === null || requestedModel === undefined
        ? null
        : text(requestedModel) as CodexSkillLibraryRecord['defaultCodexModel'],
      defaultCodexEffort: requestedEffort === null || requestedEffort === undefined
        ? null
        : text(requestedEffort) as CodexSkillLibraryRecord['defaultCodexEffort'],
      updatedAt: text(input.updatedAt),
    });
  }
  return normalized;
}

function collectInvalidReferences(input: {
  pipelines: readonly CodexPipeline[];
  steps: readonly CodexPipelineStep[];
  availableSkillNames: Set<string> | null;
  issues: CodexPipelineStoreIssue[];
}): CodexPipelineInvalidReference[] {
  const invalid: CodexPipelineInvalidReference[] = [];
  const stepsById = new Map(input.steps.map((step) => [step.id, step]));
  const referencedStepIds = new Set<string>();
  const collectSkills = (pipelineId: string, step: CodexPipelineStep): void => {
    for (const skill of step.skills) {
      const unavailable = !skill.skillName || Boolean(input.availableSkillNames && !input.availableSkillNames.has(skill.skillName));
      if (!unavailable) continue;
      const reference = skill.skillName || skill.id;
      invalid.push({ kind: 'skill', reference, pipelineId, stepId: step.id });
      input.issues.push(issue({
        code: 'invalid-skill-reference',
        message: `Saved step ${step.id} references an unavailable skill: ${reference}.`,
        pipelineId: pipelineId || undefined,
        stepId: step.id,
        skillId: skill.id,
        skillName: skill.skillName || undefined,
      }));
    }
  };
  for (const pipeline of input.pipelines) {
    for (const stepId of pipeline.stepIds) {
      const step = stepsById.get(stepId);
      if (!step) {
        invalid.push({ kind: 'step', reference: stepId, pipelineId: pipeline.id, stepId });
        input.issues.push(issue({
          code: 'invalid-step-reference',
          message: `Pipeline ${pipeline.id} references a missing saved step: ${stepId}.`,
          pipelineId: pipeline.id,
          stepId,
        }));
        continue;
      }
      referencedStepIds.add(step.id);
      collectSkills(pipeline.id, step);
    }
  }
  for (const step of input.steps) {
    if (!referencedStepIds.has(step.id)) collectSkills('', step);
  }
  return invalid;
}

export function pipelineStoreFile(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'codex-pipelines.json');
}

export function normalizeCodexPipelineStore(
  raw: unknown,
  options: CodexPipelineStoreNormalizationOptions = {},
): CodexPipelineStoreNormalization {
  const input = record(raw);
  const issues: CodexPipelineStoreIssue[] = [];
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
    issues.push(issue({ code: 'invalid-store', message: 'The Codex pipeline store root must be a JSON object.' }));
  }
  const requestedVersion = input.version;
  if (requestedVersion !== undefined && requestedVersion !== 1 && requestedVersion !== codexPipelineStoreVersion) {
    issues.push(issue({
      code: 'unsupported-store-version',
      message: `Unsupported Codex pipeline store version: ${String(requestedVersion)}.`,
    }));
  }
  const availableSkillNames = options.availableSkillNames === undefined
    ? null
    : new Set(Array.from(options.availableSkillNames, text).filter(Boolean));
  const availableContentKinds = new Map<string, CodexContentKind>(
    options.availableContentKinds === undefined
      ? []
      : Array.from(options.availableContentKinds)
        .filter(([id, kind]) => Boolean(text(id)) && contentKindSet.has(kind))
        .map(([id, kind]) => [text(id), kind]),
  );
  const steps = normalizeSteps(input.steps, issues, availableContentKinds, input.version === codexPipelineStoreVersion);
  const pipelines = normalizePipelines(input.pipelines, issues);
  const runs = normalizeRuns(input.runs, issues);
  const skillLibrary = normalizeSkillLibrary(input.skillLibrary, availableSkillNames, issues);
  const authoredContent = normalizeAuthoredContent(input.authoredContent, issues);
  const requestedActiveRun = nullableText(input.activeWorkspaceRun);
  const activeRun = requestedActiveRun ? runs.find((run) => run.id === requestedActiveRun) : undefined;
  let activeWorkspaceRun = requestedActiveRun;
  if (requestedActiveRun && !activeRun) {
    issues.push(issue({
      code: 'invalid-active-workspace-run',
      message: `The active workspace run does not exist: ${requestedActiveRun}.`,
      runId: requestedActiveRun,
    }));
    activeWorkspaceRun = null;
  }
  if (activeRun && (activeRun.status === 'complete' || activeRun.status === 'failed' || activeRun.status === 'cancelled')) {
    activeWorkspaceRun = null;
  }
  const invalidReferences = collectInvalidReferences({ pipelines, steps, availableSkillNames, issues });
  return {
    store: {
      ...emptyStore(),
      pipelines,
      steps,
      runs,
      skillLibrary,
      authoredContent,
      activeWorkspaceRun,
    },
    invalidReferences,
    issues,
  };
}

type PipelineContentKindRecovery =
  | {
      status: 'recovered';
      normalization: CodexPipelineStoreNormalization;
      archiveFile: string;
      originalRevision: string;
      repairedReferences: Array<{ stepId: string; skillId: string; skillName: string; from: string; to: CodexContentKind }>;
    }
  | { status: 'stale' }
  | { status: 'failed'; error: unknown };

function withPipelineStoreLock<T>(decisionOsRoot: string, operation: () => T): T {
  mkdirSync(decisionOsRoot, { recursive: true });
  const lockFile = resolve(decisionOsRoot, '.codex-pipelines.mutation.lock');
  const deadline = Date.now() + mutationDeadlineMs;
  let lockDescriptor = -1;
  while (lockDescriptor < 0) {
    try {
      lockDescriptor = openSync(lockFile, 'wx');
      writeFileSync(lockDescriptor, `${process.pid}\n`, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new CodexPipelineStoreBusyError(pipelineStoreFile(decisionOsRoot));
      Atomics.wait(mutationWaitArray, 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    if (lockDescriptor >= 0) closeSync(lockDescriptor);
    rmSync(lockFile, { force: true });
  }
}

function archivePipelineStoreBytes(decisionOsRoot: string, bytes: string): { file: string; revision: string } {
  const revision = createHash('sha256').update(bytes).digest('hex');
  const archiveRoot = resolve(decisionOsRoot, 'codex-pipeline-recovery');
  const file = resolve(archiveRoot, `${revision}.json`);
  mkdirSync(archiveRoot, { recursive: true });
  if (existsSync(file)) {
    if (readFileSync(file, 'utf8') !== bytes) {
      throw new Error(`Pipeline recovery archive hash collision: ${file}`);
    }
    return { file, revision };
  }
  const temporaryFile = resolve(archiveRoot, `.${revision}-${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporaryFile, bytes, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporaryFile, file);
  } finally {
    if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
  }
  return { file, revision };
}

/**
 * WHAT: Repairs only stale pipeline content-kind discriminators using the live catalog, after archiving the exact invalid bytes.
 * WHY: The discriminator is derived execution metadata; retaining a stale value blocks all pipeline work, while changing topology,
 * prompt bytes, run manifests, unknown JSON, or another invalid structure would overwrite operator-owned durable state.
 */
function recoverPipelineContentKinds(input: CodexPipelineStoreInput, expectedBytes: string): PipelineContentKindRecovery {
  try {
    return withPipelineStoreLock(input.decisionOsRoot, () => {
      const file = pipelineStoreFile(input.decisionOsRoot);
      const currentBytes = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (currentBytes !== expectedBytes) return { status: 'stale' as const };
      const currentRaw = record(JSON.parse(currentBytes));
      const current = normalizeCodexPipelineStore(currentRaw, input);
      const blockers = current.issues.filter((entry) => writeBlockingIssueCodes.has(entry.code));
      if (blockers.length === 0 || blockers.some((entry) => entry.code !== 'pipeline-content-kind-mismatch')) {
        return { status: 'failed' as const, error: new Error('Pipeline store recovery requires discriminator-only blockers.') };
      }
      const availableContentKinds = new Map(input.availableContentKinds ?? []);
      const repairedRaw = structuredClone(currentRaw);
      const repairedReferences: Array<{
        stepId: string;
        skillId: string;
        skillName: string;
        from: string;
        to: CodexContentKind;
      }> = [];
      for (const step of records(repairedRaw.steps)) {
        const stepId = text(step.id);
        for (const skill of records(step.skills)) {
          const skillName = text(skill.skillName);
          const availableKind = availableContentKinds.get(skillName);
          const requestedKind = text(skill.contentKind);
          if (!availableKind || requestedKind === availableKind) continue;
          // WHAT: Prefer the discovered catalog kind for this identity and change only its saved discriminator.
          // WHY: Filesystem-backed skill source and registered prompt ownership determine the executable content contract.
          skill.contentKind = availableKind;
          repairedReferences.push({
            stepId,
            skillId: text(skill.id),
            skillName,
            from: requestedKind,
            to: availableKind,
          });
        }
      }
      const repaired = normalizeCodexPipelineStore(repairedRaw, input);
      const repairedBlocker = codexPipelineStoreWriteBlocker(repaired);
      if (repairedReferences.length !== blockers.length || repairedBlocker) {
        return {
          status: 'failed' as const,
          error: new Error(repairedBlocker?.message ?? 'Pipeline store recovery did not repair every discriminator mismatch.'),
        };
      }
      const archive = archivePipelineStoreBytes(input.decisionOsRoot, currentBytes);
      const temporaryFile = resolve(input.decisionOsRoot, `.codex-pipelines-${process.pid}-${randomUUID()}.tmp`);
      try {
        if (readFileSync(file, 'utf8') !== expectedBytes) return { status: 'stale' as const };
        writeFileSync(temporaryFile, pipelineStoreRawBytes(repairedRaw), { encoding: 'utf8', flag: 'wx' });
        renameSync(temporaryFile, file);
      } finally {
        if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
      }
      return {
        status: 'recovered' as const,
        normalization: repaired,
        archiveFile: archive.file,
        originalRevision: archive.revision,
        repairedReferences,
      };
    });
  } catch (error) {
    return { status: 'failed', error };
  }
}

export function readCodexPipelineStore(input: CodexPipelineStoreInput): CodexPipelineStoreReadResult {
  input = {
    ...input,
    availableSkillNames: input.availableSkillNames === undefined ? undefined : [...input.availableSkillNames],
    availableContentKinds: input.availableContentKinds === undefined ? undefined : [...input.availableContentKinds],
  };
  const file = pipelineStoreFile(input.decisionOsRoot);
  if (!existsSync(file)) return availablePipelineStore(input, normalizeCodexPipelineStore(undefined, input));
  let bytes = '';
  try {
    bytes = readFileSync(file, 'utf8');
    const raw = JSON.parse(bytes) as AnyRecord;
    const normalized = normalizeCodexPipelineStore(raw, input);
    const blocker = codexPipelineStoreWriteBlocker(normalized);
    if (raw.version === 1 && !blocker) {
      return availablePipelineStore(
        input,
        withPipelineStoreMutation(input, () => normalized.store, { expectedBytes: bytes }),
      );
    }
    if (blocker) {
      const unavailableCode = blocker.code === 'unsupported-store-version'
        ? 'codex_pipeline_store_unsupported_version'
        : 'codex_pipeline_store_invalid';
      const blockers = normalized.issues.filter((entry) => writeBlockingIssueCodes.has(entry.code));
      if (
        input.availableContentKinds !== undefined
        && blockers.length > 0
        && blockers.every((entry) => entry.code === 'pipeline-content-kind-mismatch')
      ) {
        const recovery = recoverPipelineContentKinds(input, bytes);
        if (recovery.status === 'stale') return readCodexPipelineStore(input);
        if (recovery.status === 'recovered') {
          unavailablePipelineStore({
            storeInput: input,
            normalized,
            error: new CodexPipelineStoreCorruptionError(file, blocker.message),
            unavailableCode,
            message: blocker.message,
            context: {
              archiveFile: recovery.archiveFile,
              originalRevision: recovery.originalRevision,
              repairedReferences: recovery.repairedReferences,
            },
          });
          return availablePipelineStore(
            input,
            recovery.normalization,
            `Recovered ${recovery.repairedReferences.length} pipeline content-kind discriminator(s); preserved original bytes at ${recovery.archiveFile}.`,
          );
        }
        return unavailablePipelineStore({
          storeInput: input,
          normalized,
          error: new CodexPipelineStoreCorruptionError(file, blocker.message),
          unavailableCode,
          message: blocker.message,
          context: {
            recoveryError: recovery.error instanceof Error ? recovery.error.message : String(recovery.error),
          },
        });
      }
      return unavailablePipelineStore({
        storeInput: input,
        normalized,
        error: new CodexPipelineStoreCorruptionError(file, blocker.message),
        unavailableCode,
        message: blocker.message,
      });
    }
    return availablePipelineStore(input, normalized);
  } catch (error) {
    if (error instanceof CodexPipelineStoreBusyError || error instanceof CodexPipelineStoreCorruptionError) throw error;
    const normalized = normalizeCodexPipelineStore(undefined, input);
    const failed = {
      ...normalized,
      issues: [
        ...normalized.issues,
        issue({
          code: 'invalid-store',
          message: `Could not parse the Codex pipeline store: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      ],
    };
    return unavailablePipelineStore({
      storeInput: input,
      normalized: failed,
      error,
      unavailableCode: 'codex_pipeline_store_corrupt',
      message: failed.issues[failed.issues.length - 1].message,
    });
  }
}

function withPipelineStoreMutation(
  input: CodexPipelineStoreInput,
  mutation: (store: CodexPipelineStore) => unknown,
  options: { expectedBytes?: string } = {},
): CodexPipelineStoreNormalization {
  const file = pipelineStoreFile(input.decisionOsRoot);
  return withPipelineStoreLock(input.decisionOsRoot, () => {
    const currentBytes = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (options.expectedBytes !== undefined && currentBytes !== options.expectedBytes) {
      try {
        return normalizeCodexPipelineStore(currentBytes === null ? undefined : JSON.parse(currentBytes), input);
      } catch (error) {
        throw new CodexPipelineStoreCorruptionError(file, error);
      }
    }
    let current = normalizeCodexPipelineStore(undefined, input);
    if (currentBytes !== null) {
      try {
        current = normalizeCodexPipelineStore(JSON.parse(currentBytes), input);
      } catch (error) {
        throw new CodexPipelineStoreCorruptionError(file, error);
      }
      const corruption = codexPipelineStoreWriteBlocker(current);
      if (corruption) throw new CodexPipelineStoreCorruptionError(file, corruption.message);
    }
    const normalized = normalizeCodexPipelineStore(mutation(current.store), input);
    const invalidInput = codexPipelineStoreWriteBlocker(normalized);
    if (invalidInput) throw new CodexPipelineStoreCorruptionError(file, invalidInput.message);
    const temporaryFile = resolve(input.decisionOsRoot, `.codex-pipelines-${process.pid}-${randomUUID()}.tmp`);
    try {
      const compareBytes = existsSync(file) ? readFileSync(file, 'utf8') : null;
      if (compareBytes !== currentBytes) throw new CodexPipelineStoreBusyError(file);
      writeFileSync(temporaryFile, pipelineStoreBytes(normalized.store), { encoding: 'utf8', flag: 'wx' });
      renameSync(temporaryFile, file);
    } finally {
      if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
    }
    return normalized;
  });
}

export function mutateCodexPipelineStore(
  input: CodexPipelineStoreInput & { mutate: (store: CodexPipelineStore) => unknown },
): CodexPipelineStoreNormalization {
  return withPipelineStoreMutation(input, input.mutate);
}

export function writeCodexPipelineStore(
  input: CodexPipelineStoreInput & { store: unknown },
): CodexPipelineStoreNormalization {
  return withPipelineStoreMutation(input, () => input.store);
}
