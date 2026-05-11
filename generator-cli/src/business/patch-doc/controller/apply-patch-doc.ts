/**
 * WHAT: patch-doc mode controller.
 * WHY: canonical document edits must apply from one patch batch file.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { parsePatchBatch } from '../helper/parse-patch-batch.js';
import { applyDocumentPatch } from '../effect/apply-document-patch.js';

export async function applyPatchDocController(patchBatchFile: string, fs: FileSystemPort = nodeFileSystem): Promise<Result<string>> {
  const batchText = await fs.readFile(patchBatchFile);
  const patchBatch = parsePatchBatch(batchText);
  telemetry('parse-patch-batch', { path: patchBatchFile });

  // WHY: invalid patch batches cannot safely edit canonical documents.
  // WHAT: reject without writing.
  if (!patchBatch.ok) {
    telemetry('apply-patch-doc-rejected', { error: patchBatch.error });
    return patchBatch;
  }

  const result = await applyDocumentPatch(patchBatch.value, fs);
  telemetry('apply-document-patch', { path: patchBatch.value.documentPath });
  return result;
}
