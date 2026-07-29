/**
 * WHAT: Reads Git history and one historical revision for authored skill-library content.
 * WHY: The editor must navigate immutable revisions without accepting repository paths from the client.
 */
import { resolve } from 'node:path';
import { readCodexSkillRevisionContent, readCodexSkillRevisionHistory } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

function context(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord } | AnyRecord): {
  payload: AnyRecord;
  runtime: AnyRecord;
  decisionOsRoot: string;
  skillName: string;
} {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  return {
    payload,
    runtime,
    decisionOsRoot: resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os'))),
    skillName: String(payload.skillName ?? '').trim(),
  };
}

export async function readCodexSkillRevisionHistoryController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const resolved = context(input);
  if (!resolved.skillName) return { ok: false, statusCode: 400, error: 'Skill name is required.' };
  const cursor = typeof resolved.payload.cursor === 'string' ? resolved.payload.cursor : null;
  const requestedLimit = typeof resolved.payload.limit === 'string' && resolved.payload.limit.trim()
    ? Number(resolved.payload.limit)
    : Number.NaN;
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
  return await readCodexSkillRevisionHistory({ ...resolved, cursor, limit });
}

export async function readCodexSkillRevisionContentController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const resolved = context(input);
  const commit = String(resolved.payload.commit ?? '').trim();
  if (!resolved.skillName || !/^[a-f0-9]{40}$/.test(commit)) {
    return { ok: false, statusCode: 400, error: 'Skill name and a full Git commit are required.' };
  }
  return await readCodexSkillRevisionContent({ ...resolved, commit });
}
