/**
 * WHAT: Creates or updates one saved pipeline and its reusable step definitions.
 * WHY: The library API must persist ordered definitions while retaining stale references for operator repair.
 */
import { dirname, resolve } from 'node:path';
import type { CodexContentKind, CodexPipeline, CodexPipelineSkill, CodexPipelineStep } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { codexPipelineStoreWriteBlocker, mutateCodexPipelineStore, readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { isAllowedCodexEffort, isAllowedCodexModel } from '../helper/resolve-codex-command.js';
import { scanCodexSkills } from '../helper/scan-codex-skills.js';
import { scanPipelinePrompts } from '../helper/pipeline-prompt-library.js';
import { runtimeServerRoot } from '../helper/server-skill-context.js';
import { serverPipelineDecisionOsRoot } from '../helper/server-pipeline-catalog.js';

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function invalid(error: string, detail: AnyRecord = {}): AnyRecord {
  return { ok: false, statusCode: 400, error, ...detail };
}

function parseSkill(value: unknown, stepId: string): { skill?: CodexPipelineSkill; error?: AnyRecord } {
  const input = record(value);
  if (!input) return { error: invalid('Every saved step skill must be an object.', { stepId }) };
  const id = text(input.id);
  const skillName = text(input.skillName);
  if (!id || !skillName) return { error: invalid('Every saved step skill requires id and skillName.', { stepId, skillId: id, skillName }) };
  if (input.codexModel !== null && input.codexModel !== undefined && !isAllowedCodexModel(input.codexModel)) {
    return { error: invalid('Unsupported pipeline skill Codex model.', { stepId, skillId: id, skillName, codexModel: input.codexModel }) };
  }
  if (input.codexEffort !== null && input.codexEffort !== undefined && !isAllowedCodexEffort(input.codexEffort)) {
    return { error: invalid('Unsupported pipeline skill Codex effort.', { stepId, skillId: id, skillName, codexEffort: input.codexEffort }) };
  }
  const requestedKind = text(input.contentKind);
  if (!requestedKind) {
    return { error: invalid('Pipeline content kind is required.', { stepId, skillId: id, skillName }) };
  }
  if (requestedKind && requestedKind !== 'federated-skill' && requestedKind !== 'workspace-skill' && requestedKind !== 'pipeline-prompt') {
    return { error: invalid('Unsupported pipeline content kind.', { stepId, skillId: id, skillName, contentKind: requestedKind }) };
  }
  return {
    skill: {
      id,
      skillName,
      contentKind: requestedKind as CodexContentKind,
      codexModel: input.codexModel === null || input.codexModel === undefined ? null : text(input.codexModel) as CodexPipelineSkill['codexModel'],
      codexEffort: input.codexEffort === null || input.codexEffort === undefined ? null : text(input.codexEffort) as CodexPipelineSkill['codexEffort'],
    },
  };
}

function parseSteps(value: unknown, timestamp: string): { steps?: CodexPipelineStep[]; error?: AnyRecord } {
  if (value !== undefined && !Array.isArray(value)) return { error: invalid('Pipeline steps must be an array.') };
  const steps: CodexPipelineStep[] = [];
  const stepIds = new Set<string>();
  for (const rawStep of Array.isArray(value) ? value : []) {
    const input = record(rawStep);
    if (!input) return { error: invalid('Every saved pipeline step must be an object.') };
    const id = text(input.id);
    const name = text(input.name);
    if (!id || !name) return { error: invalid('Every saved pipeline step requires id and name.', { stepId: id }) };
    if (stepIds.has(id)) return { error: invalid('Duplicate saved step id.', { stepId: id }) };
    if (!Array.isArray(input.skills)) return { error: invalid('Every saved pipeline step requires a skills array.', { stepId: id }) };
    const skills: CodexPipelineSkill[] = [];
    const skillIds = new Set<string>();
    for (const rawSkill of input.skills) {
      const parsed = parseSkill(rawSkill, id);
      if (parsed.error) return { error: parsed.error };
      const skill = parsed.skill as CodexPipelineSkill;
      if (skillIds.has(skill.id)) return { error: invalid('Duplicate pipeline skill id in saved step.', { stepId: id, skillId: skill.id }) };
      skillIds.add(skill.id);
      skills.push(skill);
    }
    stepIds.add(id);
    steps.push({
      id,
      name,
      purpose: text(input.purpose),
      skills,
      createdAt: text(input.createdAt) || timestamp,
      updatedAt: timestamp,
    });
  }
  return { steps };
}

export function saveCodexPipelineController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const requestDecisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const decisionOsRoot = text(payload.scope) === 'server'
    ? serverPipelineDecisionOsRoot(runtime, requestDecisionOsRoot)
    : requestDecisionOsRoot;
  const pipelineInput = record(payload.pipeline);
  if (!pipelineInput) return invalid('A pipeline object is required.');
  const id = text(pipelineInput.id);
  const name = text(pipelineInput.name);
  if (!id || !name) return invalid('Pipeline id and name are required.', { pipelineId: id });
  if (!Array.isArray(pipelineInput.stepIds) || pipelineInput.stepIds.some((stepId) => !text(stepId))) {
    return invalid('Pipeline stepIds must be an array of non-empty strings.', { pipelineId: id });
  }
  const operation = payload.operation === 'update' ? 'update' : 'create';
  const routePipelineId = text(payload.pipelineId);
  if (operation === 'update' && !routePipelineId) return invalid('The route pipeline id is required for an update.', { pipelineId: id });
  if (operation === 'update' && routePipelineId !== id) return invalid('The route pipeline id must match pipeline.id.', { pipelineId: id, routePipelineId });
  const timestamp = new Date().toISOString();
  const parsedSteps = parseSteps(payload.steps, timestamp);
  if (parsedSteps.error) return parsedSteps.error;
  const availableSkills = scanCodexSkills({ workspaceRoot: dirname(decisionOsRoot), serverRoot: runtimeServerRoot(runtime) });
  const availablePrompts = scanPipelinePrompts(serverPipelineDecisionOsRoot(runtime, requestDecisionOsRoot));
  const availableContentKinds = new Map<string, CodexContentKind>([
    ...availableSkills.map((skill): [string, CodexContentKind] => [
      skill.name,
      skill.source === 'server' ? 'federated-skill' : 'workspace-skill',
    ]),
    ...availablePrompts.map((prompt): [string, CodexContentKind] => [prompt.name, 'pipeline-prompt']),
  ]);
  const availableSkillNames = [...availableContentKinds.keys()];
  for (const step of parsedSteps.steps ?? []) {
    for (const skill of step.skills) {
      const availableKind = availableContentKinds.get(skill.skillName);
      if (availableKind && skill.contentKind !== availableKind) {
        return invalid('Pipeline content kind does not match the selected content identity.', {
          stepId: step.id,
          skillId: skill.id,
          skillName: skill.skillName,
          contentKind: skill.contentKind,
          availableKind,
        });
      }
    }
  }
  const before = readCodexPipelineStore({ decisionOsRoot, availableSkillNames, availableContentKinds });
  const corruption = codexPipelineStoreWriteBlocker(before);
  if (corruption) return { ok: false, statusCode: 503, error: 'The Codex pipeline store is invalid and has been preserved for recovery.', detail: corruption.message };
  const existing = before.store.pipelines.find((pipeline) => pipeline.id === id);
  if (operation === 'create' && existing) return { ok: false, statusCode: 409, error: 'A pipeline with this id already exists.', pipelineId: id };
  if (operation === 'update' && !existing) return { ok: false, statusCode: 404, error: 'Pipeline not found.', pipelineId: id };
  const pipeline: CodexPipeline = {
    id,
    name,
    purpose: text(pipelineInput.purpose),
    stepIds: (pipelineInput.stepIds as unknown[]).map(text),
    createdAt: existing?.createdAt || text(pipelineInput.createdAt) || timestamp,
    updatedAt: timestamp,
  };
  try {
    const normalized = mutateCodexPipelineStore({
      decisionOsRoot,
      availableSkillNames,
      availableContentKinds,
      mutate: (store) => {
        const current = store.pipelines.find((entry) => entry.id === id);
        if (operation === 'create' && current) {
          const error = new Error('A pipeline with this id already exists.');
          Object.assign(error, { code: 'pipeline_identity_conflict' });
          throw error;
        }
        if (operation === 'update' && !current) {
          const error = new Error('Pipeline not found.');
          Object.assign(error, { code: 'pipeline_not_found' });
          throw error;
        }
        const currentPipeline = { ...pipeline, createdAt: current?.createdAt || pipeline.createdAt };
        const stepsById = new Map(store.steps.map((step) => [step.id, step]));
        for (const supplied of parsedSteps.steps ?? []) {
          const prior = stepsById.get(supplied.id);
          stepsById.set(supplied.id, { ...supplied, createdAt: prior?.createdAt || supplied.createdAt });
        }
        return {
          ...store,
          pipelines: current
            ? store.pipelines.map((entry) => entry.id === id ? currentPipeline : entry)
            : [...store.pipelines, currentPipeline],
          steps: Array.from(stepsById.values()),
        };
      },
    });
    // WHAT: Scope save validation to the pipeline represented by this response.
    // WHY: Invalid references in an independent server pipeline must not make a successful project-pipeline save appear invalid.
    const invalidReferences = normalized.invalidReferences.filter((reference) => reference.pipelineId === id);
    return {
      ok: true,
      statusCode: existing ? 200 : 201,
      pipeline: { ...normalized.store.pipelines.find((entry) => entry.id === id), scope: text(payload.scope) === 'server' ? 'server' : 'project' },
      pipelines: normalized.store.pipelines.map((entry) => ({ ...entry, scope: text(payload.scope) === 'server' ? 'server' : 'project' })),
      steps: normalized.store.steps.map((entry) => ({ ...entry, scope: text(payload.scope) === 'server' ? 'server' : 'project' })),
      hasInvalidReferences: invalidReferences.length > 0,
      invalidReferences,
      issues: normalized.issues,
    };
  } catch (error) {
    const code = error && typeof error === 'object' ? String((error as AnyRecord).code ?? '') : '';
    if (code === 'pipeline_identity_conflict') {
      return { ok: false, statusCode: 409, error: 'A pipeline with this id already exists.', pipelineId: id };
    }
    if (code === 'pipeline_not_found') {
      return { ok: false, statusCode: 404, error: 'Pipeline not found.', pipelineId: id };
    }
    return {
      ok: false,
      statusCode: 500,
      error: 'Could not save the Codex pipeline library.',
      pipelineId: id,
    };
  }
}
