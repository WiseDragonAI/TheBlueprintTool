/**
 * WHAT: Generated controller function apply-patch-doc.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { applyDocumentPatch } from '../effect/apply-document-patch.js';
import { parsePatchBatch } from '../helper/parse-patch-batch.js';


export async function applyPatchDocController({
  action_payload,
}: {
  action_payload: {
    patch_doc_command: true
    patch_batch_file: string
  }
}) {
  telemetry('controller:apply-patch-doc -> start', { functionName: 'apply-patch-doc', arguments: { action_payload }, phase: 'started' });
  // WHAT: apply patch-doc mode.
  // WHY: canonical document edits must apply in one batch.
  // HOW: parse patch batch, reject invalid batches, then apply document patch.
  const patch_batch = parsePatchBatch(action_payload.patch_batch_file)
  telemetry('controller:apply-patch-doc -> parse-patch-batch', { functionName: 'parse-patch-batch', arguments: { action_payload }, phase: 'event' })

  if (!patch_batch.ok) {
    telemetry('controller:apply-patch-doc -> apply-patch-doc-rejected', { functionName: 'apply-patch-doc-rejected', arguments: { action_payload }, phase: 'event' })
    return
  }

  applyDocumentPatch(patch_batch.value)
  telemetry('controller:apply-patch-doc -> apply-document-patch', { functionName: 'apply-document-patch', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:apply-patch-doc -> complete', { functionName: 'apply-patch-doc', arguments: { action_payload }, phase: 'completed' });
}
