/**
 * WHAT: Returns the normalized saved pipeline library for the active workspace.
 * WHY: Pipeline clients need ordered definitions plus repairable invalid-reference metadata.
 */
import { resolve } from 'node:path';
import { readScopedCodexPipelineStores } from '../helper/server-pipeline-catalog.js';
import { readCodexContentCatalog } from '../helper/codex-skill-library.js';
import { availablePipelineContent } from '../helper/available-pipeline-content.js';

type AnyRecord = Record<string, unknown>;

export function listCodexPipelinesController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const available = availablePipelineContent({ decisionOsRoot, runtime });
  const scoped = readScopedCodexPipelineStores({
    decisionOsRoot,
    runtime,
    availableSkillNames: available.names,
    availableContentKinds: available.kinds,
  });
  const invalidReferences = [
    ...scoped.server.invalidReferences,
    ...(scoped.project?.invalidReferences ?? []).filter((reference) =>
      !scoped.server.store.pipelines.some((pipeline) => pipeline.id === reference.pipelineId)),
  ];
  const issues = [...scoped.server.issues, ...(scoped.project?.issues ?? [])];
  return {
    ok: true,
    statusCode: 200,
    pipelines: scoped.pipelines,
    steps: scoped.steps,
    empty: scoped.pipelines.length === 0,
    hasInvalidReferences: invalidReferences.length > 0,
    invalidReferences,
    issues,
    availableContent: readCodexContentCatalog({ decisionOsRoot, runtime }).skills,
  };
}
