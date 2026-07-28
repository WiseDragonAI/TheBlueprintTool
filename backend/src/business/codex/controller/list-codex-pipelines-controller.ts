/**
 * WHAT: Returns the normalized saved pipeline library for the active workspace.
 * WHY: Pipeline clients need ordered definitions plus repairable invalid-reference metadata.
 */
import { dirname, resolve } from 'node:path';
import { scanCodexSkills } from '../helper/scan-codex-skills.js';
import { runtimeServerRoot } from '../helper/server-skill-context.js';
import { readScopedCodexPipelineStores, serverPipelineDecisionOsRoot } from '../helper/server-pipeline-catalog.js';
import { scanPipelinePrompts } from '../helper/pipeline-prompt-library.js';
import type { CodexContentKind } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { readCodexContentCatalog } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

export function listCodexPipelinesController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const skills = scanCodexSkills({ workspaceRoot: dirname(decisionOsRoot), serverRoot: runtimeServerRoot(runtime) });
  const prompts = scanPipelinePrompts(serverPipelineDecisionOsRoot(runtime, decisionOsRoot));
  const availableContentKinds = new Map<string, CodexContentKind>([
    ...skills.map((skill): [string, CodexContentKind] => [skill.name, skill.source === 'server' ? 'federated-skill' : 'workspace-skill']),
    ...prompts.map((prompt): [string, CodexContentKind] => [prompt.name, 'pipeline-prompt']),
  ]);
  const scoped = readScopedCodexPipelineStores({
    decisionOsRoot,
    runtime,
    availableSkillNames: availableContentKinds.keys(),
    availableContentKinds,
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
