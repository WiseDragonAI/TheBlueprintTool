/**
 * WHAT: Creates one path-free agent skill or pipeline-only prompt.
 * WHY: The client selects a content kind while the server owns every storage and Git boundary.
 */
import { resolve } from 'node:path';
import { createCodexSkillLibrary } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

export async function createCodexSkillLibraryController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  return await createCodexSkillLibrary({ decisionOsRoot, runtime, payload });
}
