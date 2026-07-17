import type { CodexPipeline, CodexPipelineStep } from '../../../../../shared/schemas/codex-pipeline-types.js';

export const projectSynchronizationPipelineId = 'project-synchronization';

export function projectSynchronizationPipelineDefinition(now = new Date().toISOString()): {
  pipeline: CodexPipeline;
  steps: CodexPipelineStep[];
} {
  const roles = [
    ['source-publish', 'Publish source', 'project-sync-source-publisher'],
    ['initiator-reconcile', 'Reconcile initiator', 'project-sync-initiator-reconciler'],
    ['source-finalize', 'Finalize source', 'project-sync-source-finalizer'],
  ] as const;
  const steps = roles.map(([suffix, name, skillName]) => ({
    id: `${projectSynchronizationPipelineId}-${suffix}`,
    name,
    purpose: `${name} through the authenticated project synchronization protocol.`,
    skills: [{ id: `${projectSynchronizationPipelineId}-${suffix}-skill`, skillName, codexModel: null, codexEffort: null }],
    createdAt: now,
    updatedAt: now,
  }));
  return {
    pipeline: {
      id: projectSynchronizationPipelineId,
      name: 'Project synchronization',
      purpose: 'Publish source work, reconcile it on the initiating node, then finalize the source repository.',
      stepIds: steps.map((step) => step.id),
      createdAt: now,
      updatedAt: now,
    },
    steps,
  };
}
