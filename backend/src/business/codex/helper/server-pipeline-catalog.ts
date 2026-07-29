/**
 * WHAT: Resolves and bootstraps the server-owned pipeline catalog shared by managed projects.
 * WHY: Reusable pipelines created at the home server must not be copied into every project store.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CodexContentKind, CodexPipeline, CodexPipelineStep, CodexPipelineStoreNormalization } from '../../../../../shared/schemas/codex-pipeline-types.js';
import {
  assertCodexPipelineStoreAvailable,
  mutateCodexPipelineStore,
  pipelineStoreFile,
  readCodexPipelineStore,
} from './codex-pipeline-store.js';
import { runtimeServerRoot } from './server-skill-context.js';
import { projectSynchronizationPipelineDefinition } from '../../project-sync/helper/project-sync-pipeline-definition.js';

type AnyRecord = Record<string, unknown>;

export type PipelineScope = 'server' | 'project';
export type ScopedCodexPipeline = CodexPipeline & { readonly scope: PipelineScope };
export type ScopedCodexPipelineStep = CodexPipelineStep & { readonly scope: PipelineScope };

export function serverPipelineDecisionOsRoot(runtime: AnyRecord, fallbackDecisionOsRoot: string): string {
  const serverRoot = runtimeServerRoot(runtime);
  return serverRoot ? resolve(serverRoot, '.decision-os') : resolve(fallbackDecisionOsRoot);
}

export function readScopedCodexPipelineStores(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  availableSkillNames?: Iterable<string>;
  availableContentKinds?: Iterable<readonly [string, CodexContentKind]>;
}): {
  server: CodexPipelineStoreNormalization;
  project: CodexPipelineStoreNormalization | null;
  pipelines: ScopedCodexPipeline[];
  steps: ScopedCodexPipelineStep[];
} {
  const serverDecisionOsRoot = serverPipelineDecisionOsRoot(input.runtime, input.decisionOsRoot);
  const options = {
    availableSkillNames: input.availableSkillNames,
    availableContentKinds: input.availableContentKinds,
  };
  const server = readCodexPipelineStore({ decisionOsRoot: serverDecisionOsRoot, ...options });
  const project = resolve(input.decisionOsRoot) === serverDecisionOsRoot
    ? null
    : readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, ...options });
  assertCodexPipelineStoreAvailable(server);
  if (project) assertCodexPipelineStoreAvailable(project);
  const serverPipelineIds = new Set(server.store.pipelines.map((pipeline) => pipeline.id));
  return {
    server,
    project,
    pipelines: [
      ...server.store.pipelines.map((pipeline) => ({ ...pipeline, scope: 'server' as const })),
      ...(project?.store.pipelines ?? [])
        .filter((pipeline) => !serverPipelineIds.has(pipeline.id))
        .map((pipeline) => ({ ...pipeline, scope: 'project' as const })),
    ],
    steps: [
      ...server.store.steps.map((step) => ({ ...step, scope: 'server' as const })),
      ...(project?.store.steps ?? []).map((step) => ({ ...step, scope: 'project' as const })),
    ],
  };
}

export function migrateLegacyProjectPipelines(input: {
  serverDecisionOsRoot: string;
  projectDecisionOsRoots: readonly string[];
  availableSkillNames?: Iterable<string>;
}): { migratedPipelineIds: string[]; retainedCollisionIds: string[] } {
  const serverFile = pipelineStoreFile(input.serverDecisionOsRoot);
  if (existsSync(serverFile)) return { migratedPipelineIds: [], retainedCollisionIds: [] };

  const server = readCodexPipelineStore({
    decisionOsRoot: input.serverDecisionOsRoot,
    availableSkillNames: input.availableSkillNames,
  });
  assertCodexPipelineStoreAvailable(server);
  const pipelines = [...server.store.pipelines];
  const steps = [...server.store.steps];
  const pipelineIds = new Set(pipelines.map((pipeline) => pipeline.id));
  const stepIds = new Set(steps.map((step) => step.id));
  const migratedPipelineIds: string[] = [];
  const retainedCollisionIds: string[] = [];

  for (const projectDecisionOsRoot of [...new Set(input.projectDecisionOsRoots.map((root) => resolve(root)))].sort()) {
    if (projectDecisionOsRoot === resolve(input.serverDecisionOsRoot)) continue;
    const projectFile = pipelineStoreFile(projectDecisionOsRoot);
    if (!existsSync(projectFile)) continue;
    const project = readCodexPipelineStore({ decisionOsRoot: projectDecisionOsRoot });
    assertCodexPipelineStoreAvailable(project);
    const projectStepsById = new Map(project.store.steps.map((step) => [step.id, step]));
    const migratedFromProject = project.store.pipelines.filter((pipeline) => {
      if (pipelineIds.has(pipeline.id) || pipeline.stepIds.some((stepId) => stepIds.has(stepId) || !projectStepsById.has(stepId))) {
        retainedCollisionIds.push(pipeline.id);
        return false;
      }
      pipelineIds.add(pipeline.id);
      pipelines.push(pipeline);
      migratedPipelineIds.push(pipeline.id);
      return true;
    });
    const migratedIds = new Set(migratedFromProject.map((pipeline) => pipeline.id));
    const migratedStepIds = new Set(migratedFromProject.flatMap((pipeline) => pipeline.stepIds));
    for (const step of project.store.steps) {
      if (!migratedStepIds.has(step.id) || stepIds.has(step.id)) continue;
      stepIds.add(step.id);
      steps.push(step);
    }
    if (!migratedIds.size) continue;
    mutateCodexPipelineStore({
      decisionOsRoot: projectDecisionOsRoot,
      mutate: (store) => {
        const currentPipelines = store.pipelines.filter((pipeline) => !migratedIds.has(pipeline.id));
        const currentStepIds = new Set(currentPipelines.flatMap((pipeline) => pipeline.stepIds));
        return {
          ...store,
          pipelines: currentPipelines,
          steps: store.steps.filter((step) => currentStepIds.has(step.id)),
        };
      },
    });
  }

  mutateCodexPipelineStore({
    decisionOsRoot: input.serverDecisionOsRoot,
    availableSkillNames: input.availableSkillNames,
    mutate: (store) => {
      const currentPipelineIds = new Set(store.pipelines.map((pipeline) => pipeline.id));
      const currentStepIds = new Set(store.steps.map((step) => step.id));
      return {
        ...store,
        pipelines: [...store.pipelines, ...pipelines.filter((pipeline) => !currentPipelineIds.has(pipeline.id))],
        steps: [...store.steps, ...steps.filter((step) => !currentStepIds.has(step.id))],
      };
    },
  });
  return { migratedPipelineIds, retainedCollisionIds };
}

export function ensureServerPipelines(input: {
  serverDecisionOsRoot: string;
  availableSkillNames?: Iterable<string>;
}): { createdPipelineIds: string[] } {
  const normalized = readCodexPipelineStore({
    decisionOsRoot: input.serverDecisionOsRoot,
    availableSkillNames: input.availableSkillNames,
  });
  assertCodexPipelineStoreAvailable(normalized);
  const builtIn = projectSynchronizationPipelineDefinition();
  if (normalized.store.pipelines.some((pipeline) => pipeline.id === builtIn.pipeline.id)) {
    return { createdPipelineIds: [] };
  }
  let created = false;
  mutateCodexPipelineStore({
    decisionOsRoot: input.serverDecisionOsRoot,
    availableSkillNames: input.availableSkillNames,
    mutate: (store) => {
      if (store.pipelines.some((pipeline) => pipeline.id === builtIn.pipeline.id)) return store;
      created = true;
      const currentStepIds = new Set(store.steps.map((step) => step.id));
      return {
        ...store,
        pipelines: [...store.pipelines, builtIn.pipeline],
        steps: [...store.steps, ...builtIn.steps.filter((step) => !currentStepIds.has(step.id))],
      };
    },
  });
  return { createdPipelineIds: created ? [builtIn.pipeline.id] : [] };
}
