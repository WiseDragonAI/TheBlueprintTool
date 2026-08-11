/**
 * WHAT: Commits one directly edited registered pipeline-prompt working copy.
 * WHY: prompt authors need focused Git evidence without resubmitting complete Markdown through the CLI.
 */
import { resolve } from 'node:path';
import { commitPipelinePromptWorkingCopy } from '../helper/codex-skill-library.js';

type AnyRecord = Record<string, unknown>;

export async function commitPipelinePromptWorkingCopyController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const skillName = String(payload.skillName ?? '').trim();
  // WHAT: reject a commit request without one registered prompt identity.
  // WHY: working-copy ownership must never be inferred from a filesystem path.
  if (!skillName) return { ok: false, statusCode: 400, error: 'Prompt name is required.' };
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  return await commitPipelinePromptWorkingCopy({
    decisionOsRoot,
    runtime,
    skillName,
    revision: String(payload.revision ?? '').trim(),
  });
}
