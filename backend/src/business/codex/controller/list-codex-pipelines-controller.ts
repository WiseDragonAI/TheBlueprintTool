/**
 * WHAT: Returns the normalized saved pipeline library for the active workspace.
 * WHY: Pipeline clients need ordered definitions plus repairable invalid-reference metadata.
 */
import { dirname, resolve } from 'node:path';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { scanCodexSkills } from '../helper/scan-codex-skills.js';

type AnyRecord = Record<string, unknown>;

export function listCodexPipelinesController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const availableSkillNames = scanCodexSkills({ workspaceRoot: dirname(decisionOsRoot) }).map((skill) => skill.name);
  const normalized = readCodexPipelineStore({ decisionOsRoot, availableSkillNames });
  return {
    ok: true,
    statusCode: 200,
    pipelines: normalized.store.pipelines,
    steps: normalized.store.steps,
    empty: normalized.store.pipelines.length === 0,
    hasInvalidReferences: normalized.invalidReferences.length > 0,
    invalidReferences: normalized.invalidReferences,
    issues: normalized.issues,
  };
}
