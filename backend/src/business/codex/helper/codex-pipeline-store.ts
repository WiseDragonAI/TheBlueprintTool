/**
 * WHAT: Reads, normalizes, and atomically writes the workspace Codex pipeline store.
 * WHY: Saved pipelines, reusable steps, run manifests, and skill defaults must survive server restarts.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
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
import { isAllowedCodexEffort, isAllowedCodexModel } from './resolve-codex-command.js';

type AnyRecord = Record<string, unknown>;

export type CodexPipelineStoreNormalizationOptions = {
  availableSkillNames?: Iterable<string>;
};

export type CodexPipelineStoreInput = CodexPipelineStoreNormalizationOptions & {
  decisionOsRoot: string;
};

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
    activeWorkspaceRun: null,
  };
}

function normalizePipelineSkill(input: AnyRecord, stepId: string, index: number, issues: CodexPipelineStoreIssue[]): CodexPipelineSkill {
  const id = text(input.id) || `${stepId}-skill-${index + 1}`;
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
      skillName: text(input.skillName),
    }));
  }
  if (requestedEffort !== null && requestedEffort !== undefined && codexEffort === null) {
    issues.push(issue({
      code: 'unsupported-pipeline-skill-effort',
      message: `Pipeline skill ${id} has an unsupported Codex effort.`,
      stepId,
      skillId: id,
      skillName: text(input.skillName),
    }));
  }
  return { id, skillName: text(input.skillName), codexModel, codexEffort };
}

function normalizeSteps(raw: unknown, issues: CodexPipelineStoreIssue[]): CodexPipelineStep[] {
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
      const skill = normalizePipelineSkill(rawSkill, id, index, issues);
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

function normalizeRunSkill(input: AnyRecord, stepId: string, index: number): CodexPipelineRunSkill {
  return {
    id: text(input.id) || `${stepId}-run-skill-${index + 1}`,
    pipelineSkillId: text(input.pipelineSkillId),
    skillName: text(input.skillName),
    runId: text(input.runId),
    status: status(input.status),
    codexModel: text(input.codexModel),
    codexEffort: text(input.codexEffort),
    stdoutFile: text(input.stdoutFile),
    stderrFile: text(input.stderrFile),
    startedAt: nullableText(input.startedAt),
    finishedAt: nullableText(input.finishedAt),
    error: text(input.error),
  };
}

function normalizeRunStep(input: AnyRecord, runId: string, index: number): CodexPipelineRunStep {
  const id = text(input.id) || `${runId}-run-step-${index + 1}`;
  return {
    id,
    stepId: text(input.stepId),
    name: text(input.name) || text(input.stepId) || id,
    purpose: text(input.purpose),
    outputCardId: text(input.outputCardId),
    status: status(input.status),
    skills: records(input.skills).map((skill, skillIndex) => normalizeRunSkill(skill, id, skillIndex)),
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
      pipelineId: nullableText(input.pipelineId),
      pipelineName: text(input.pipelineName),
      temporary: input.temporary === true,
      ledgerId: text(input.ledgerId),
      sourceCardId: text(input.sourceCardId),
      sourceCardTitle: text(input.sourceCardTitle),
      status: status(input.status),
      steps: records(input.steps).map((step, stepIndex) => normalizeRunStep(step, id, stepIndex)),
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
  const availableSkillNames = options.availableSkillNames === undefined
    ? null
    : new Set(Array.from(options.availableSkillNames, text).filter(Boolean));
  const steps = normalizeSteps(input.steps, issues);
  const pipelines = normalizePipelines(input.pipelines, issues);
  const runs = normalizeRuns(input.runs, issues);
  const skillLibrary = normalizeSkillLibrary(input.skillLibrary, availableSkillNames, issues);
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
      activeWorkspaceRun,
    },
    invalidReferences,
    issues,
  };
}

export function readCodexPipelineStore(input: CodexPipelineStoreInput): CodexPipelineStoreNormalization {
  const file = pipelineStoreFile(input.decisionOsRoot);
  if (!existsSync(file)) return normalizeCodexPipelineStore(undefined, input);
  try {
    return normalizeCodexPipelineStore(JSON.parse(readFileSync(file, 'utf8')), input);
  } catch (error) {
    const normalized = normalizeCodexPipelineStore(undefined, input);
    return {
      ...normalized,
      issues: [
        ...normalized.issues,
        issue({
          code: 'invalid-store',
          message: `Could not parse the Codex pipeline store: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      ],
    };
  }
}

export function writeCodexPipelineStore(
  input: CodexPipelineStoreInput & { store: unknown },
): CodexPipelineStoreNormalization {
  const normalized = normalizeCodexPipelineStore(input.store, input);
  const file = pipelineStoreFile(input.decisionOsRoot);
  mkdirSync(input.decisionOsRoot, { recursive: true });
  const temporaryFile = resolve(input.decisionOsRoot, `.codex-pipelines-${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporaryFile, `${JSON.stringify(normalized.store, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporaryFile, file);
  } finally {
    if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
  }
  return normalized;
}
