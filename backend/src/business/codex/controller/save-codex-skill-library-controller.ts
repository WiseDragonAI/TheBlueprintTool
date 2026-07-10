/**
 * WHAT: Validates and saves one editable skill plus its default run options.
 * WHY: Protected sources, stale revisions, and invalid Markdown must fail without partial writes.
 */
import { resolve } from 'node:path';
import { saveCodexSkillLibrary } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

export function saveCodexSkillLibraryController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const skillName = String(payload.skillName ?? '').trim();
  if (!skillName) return { ok: false, statusCode: 400, error: 'Skill name is required.' };
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const { skillName: _skillName, ...savePayload } = payload;
  return saveCodexSkillLibrary({ decisionOsRoot, runtime, skillName, payload: savePayload });
}
