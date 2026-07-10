/**
 * WHAT: Returns one server-resolved skill's Markdown, defaults, and editability metadata.
 * WHY: Skill editing must use an immutable name instead of a client-provided filesystem path.
 */
import { resolve } from 'node:path';
import { readCodexSkillLibraryDetail } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

export function readCodexSkillLibraryController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const skillName = String(payload.skillName ?? '').trim();
  if (!skillName) return { ok: false, statusCode: 400, error: 'Skill name is required.' };
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  try {
    const skill = readCodexSkillLibraryDetail({ decisionOsRoot, runtime, skillName });
    if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName };
    return { ok: true, statusCode: 200, skill };
  } catch (error) {
    return {
      ok: false,
      statusCode: 500,
      error: 'Could not read the skill library.',
      skillName,
    };
  }
}
