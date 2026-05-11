/**
 * WHAT: Canonical document patch effect.
 * WHY: patch-doc mode must apply one patch batch in one pass.
 */
import type { FileSystemPort, PatchBatch, Result } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function applyDocumentPatch(batch: PatchBatch, fs: FileSystemPort = nodeFileSystem): Promise<Result<string>> {
  let text = await fs.readFile(batch.documentPath);

  for (const replacement of batch.replacements) {
    // WHY: missing source text means the batch would not apply cleanly.
    // WHAT: reject before writing a partial result.
    if (!text.includes(replacement.find)) {
      return { ok: false, error: `Patch find text not found: ${replacement.find}` };
    }

    text = text.replace(replacement.find, replacement.replace);
  }

  await fs.writeFile(batch.documentPath, text);
  return { ok: true, value: batch.documentPath };
}
