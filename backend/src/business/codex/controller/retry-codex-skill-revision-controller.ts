/**
 * WHAT: Retries one pending skill or prompt Git revision against exact confirmed bytes.
 * WHY: A contained Git failure must not repeat the already successful owner mutation.
 */
import { resolve } from 'node:path';
import { retryCodexSkillRevision } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

export async function retryCodexSkillRevisionController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const skillName = String(payload.skillName ?? '').trim();
  const recoveryToken = String(payload.recoveryToken ?? '').trim();
  const contentRevision = String(payload.contentRevision ?? '').trim();
  if (!skillName || !recoveryToken || !/^[a-f0-9]{64}$/.test(contentRevision)) {
    return {
      ok: false,
      statusCode: 422,
      code: 'invalid_revision_retry',
      error: 'Skill identity, recovery token, and a SHA-256 content revision are required.',
    };
  }
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  return await retryCodexSkillRevision({
    decisionOsRoot,
    runtime,
    skillName,
    recoveryToken,
    contentRevision,
  });
}
