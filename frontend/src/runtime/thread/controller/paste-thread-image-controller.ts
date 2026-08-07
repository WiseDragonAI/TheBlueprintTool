/**
 * WHAT: Persists pasted image bytes and note intent before rendering or upload.
 * WHY: Reload and relay failure must not discard a captured image.
 */
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import { beginPendingTaskMutationReceipt } from '../../refresh/helper/pending-task-mutation-receipts.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';
import { appendOptimisticThreadNote } from '../effect/append-optimistic-thread-note.js';
import { persistPendingThreadAsset } from '../effect/persist-pending-thread-asset.js';
import { submitPendingThreadAsset } from '../effect/submit-pending-thread-asset.js';

function firstClipboardImage(event: ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
  const file = imageItem?.getAsFile();
  return file && file.size > 0 ? file : null;
}

export async function pasteThreadImageController(event: ClipboardEvent): Promise<boolean> {
  const target = event.target as HTMLElement | null;
  if (!target?.closest('.thread-draft')) return false;
  const image = firstClipboardImage(event);
  if (!image) return false;
  event.preventDefault();
  if (!state.threadId) state.threadId = 'conversation-ledger';
  const threadId = state.threadId;
  const ledgerId = currentLedgerStateId();
  const projectId = String(state.projectId ?? '');
  const replicaNodeId = replicaNodeIdFromLocation();
  const noteId = `note-${Date.now()}-${crypto.randomUUID()}`;
  const mutationId = crypto.randomUUID();
  const assetId = `image-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  try {
    await persistPendingThreadAsset({
      assetId,
      mutationId,
      noteId,
      projectId,
      replicaNodeId,
      ledgerId,
      threadId,
      cardId: threadCodexCardId(state.activeLedger, threadId),
      kind: 'image',
      blob: image,
      mimeType: image.type || 'image/png',
      fileName: image.name || 'pasted-image',
      createdAt,
      phase: 'captured',
      assetRef: '',
      previewRef: '',
      markdown: '',
    });
    if (ledgerId === 'tasks') {
      beginPendingTaskMutationReceipt({
        mutationId,
        entityId: `${threadId}/${noteId}`,
        projectId,
        ledgerId,
        domain: 'image',
        mutation: {
          action: 'append-note',
          mutationId,
          note: { id: noteId, threadId, body: 'Pasted image saved locally. Upload pending.' },
        },
      });
    }
  } catch (error) {
    telemetry('thread-image-persistence-failed', {
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
  const localPreview = typeof URL?.createObjectURL === 'function' ? URL.createObjectURL(image) : '';
  appendOptimisticThreadNote({
    noteId,
    createdAt,
    threadId,
    body: localPreview ? `![Pasted image](${localPreview})` : 'Pasted image saved locally. Upload pending.',
    status: 'uploading image',
  });
  const note = state.activeLedger?.notes?.[threadId]?.find((candidate: Record<string, unknown>) => String(candidate.id ?? '') === noteId);
  if (note) {
    note.localAssetId = assetId;
    note.mutationReceiptId = mutationId;
  }
  telemetry('thread-image-paste', { threadId, type: image.type, size: image.size, assetId });
  await submitPendingThreadAsset(assetId);
  if (localPreview) URL.revokeObjectURL(localPreview);
  return true;
}
