/**
 * WHAT: Patch batch parser.
 * WHY: patch-doc mode applies canonical document edits from one batch file.
 */
import type { PatchBatch, Result } from '../../../lib/types.js';
import { parseJson } from '../../../lib/json/json.js';

export function parsePatchBatch(text: string): Result<PatchBatch> {
  const parsed = parseJson<PatchBatch>(text);

  // WHY: invalid JSON cannot be applied to a canonical document.
  // WHAT: reject malformed patch batch text.
  if (!parsed.ok) {
    return parsed;
  }

  const batch = parsed.value;

  // WHY: patch-doc needs a document target and replacement list.
  // WHAT: validate the minimal patch batch contract.
  if (!batch.documentPath || !Array.isArray(batch.replacements)) {
    return { ok: false, error: 'Patch batch must include documentPath and replacements.' };
  }

  return { ok: true, value: batch };
}
