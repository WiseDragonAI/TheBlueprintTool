/**
 * WHAT: Restores browser-persisted images and files into the active thread after reload.
 * WHY: A captured asset remains visible and retryable until exact backend note acknowledgement.
 */
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import { beginPendingTaskMutationReceipt } from '../../refresh/helper/pending-task-mutation-receipts.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { appendOptimisticThreadNote } from './append-optimistic-thread-note.js';
import { listPendingThreadAssets } from './persist-pending-thread-asset.js';
import { submitPendingThreadAsset } from './submit-pending-thread-asset.js';

const attemptedAssets = new Set<string>();

export async function restorePendingThreadAssets(threadId: string): Promise<boolean> {
  const projectId = String(state.projectId ?? '');
  const replicaNodeId = replicaNodeIdFromLocation();
  const ledgerId = currentLedgerStateId();
  if (!projectId || !ledgerId || !threadId || !state.activeLedger) return false;
  try {
    const entries = await listPendingThreadAssets({ projectId, replicaNodeId, ledgerId, threadId });
    if (!state.activeLedger || state.threadId !== threadId || currentLedgerStateId() !== ledgerId) return false;
    const notes = normalizeLedgerNotes(state.activeLedger)[threadId] ?? [];
    let changed = false;
    for (const entry of entries) {
      if (ledgerId === 'tasks') {
        beginPendingTaskMutationReceipt({
          mutationId: entry.mutationId,
          entityId: `${entry.threadId}/${entry.noteId}`,
          projectId,
          ledgerId,
          domain: entry.kind === 'image' ? 'image' : 'content-head',
          mutation: {
            action: 'append-note',
            mutationId: entry.mutationId,
            note: {
              id: entry.noteId,
              threadId: entry.threadId,
              body: entry.markdown || `${entry.fileName || (entry.kind === 'image' ? 'Image' : 'Attachment')} saved locally. Upload pending.`,
            },
          },
        });
      }
      let note = notes.find((candidate) => String(candidate.id ?? '') === entry.noteId);
      if (!note) {
        const localPreview = entry.kind === 'image' && typeof URL?.createObjectURL === 'function'
          ? URL.createObjectURL(entry.blob)
          : '';
        appendOptimisticThreadNote({
          noteId: entry.noteId,
          createdAt: entry.createdAt,
          threadId,
          body: entry.markdown
            || (localPreview ? `![Pasted image](${localPreview})` : `${entry.fileName || 'Attachment'} saved locally. Upload pending.`),
          status: entry.phase === 'uploaded' ? `committing ${entry.kind}` : `uploading ${entry.kind}`,
        });
        note = normalizeLedgerNotes(state.activeLedger)[threadId]?.find((candidate) => String(candidate.id ?? '') === entry.noteId);
        changed = true;
      }
      if (note) {
        note.localAssetId = entry.assetId;
        note.mutationReceiptId = entry.mutationId;
        note.optimistic = true;
      }
      if (!attemptedAssets.has(entry.assetId)) {
        attemptedAssets.add(entry.assetId);
        void submitPendingThreadAsset(entry.assetId).catch((error) => {
          telemetry('thread-asset-restore-submit-failed', {
            assetId: entry.assetId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }
    return changed;
  } catch (error) {
    telemetry('thread-asset-restore-failed', {
      projectId,
      ledgerId,
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function clearPendingThreadAssetRestoreStateForTest(): void {
  attemptedAssets.clear();
}
