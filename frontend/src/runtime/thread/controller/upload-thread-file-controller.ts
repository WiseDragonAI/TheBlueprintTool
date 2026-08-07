/**
 * WHAT: Persists selected files and their note intents before rendering or upload.
 * WHY: Attachments must survive reload and remote-owner unavailability.
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

function isFileInput(value: HTMLInputElement | FileList | File[]): value is HTMLInputElement {
  return typeof HTMLInputElement !== 'undefined' && value instanceof HTMLInputElement;
}

async function persistAndSubmitFile(threadId: string, file: File): Promise<void> {
  const ledgerId = currentLedgerStateId();
  const projectId = String(state.projectId ?? '');
  const replicaNodeId = replicaNodeIdFromLocation();
  const noteId = `note-${Date.now()}-${crypto.randomUUID()}`;
  const mutationId = crypto.randomUUID();
  const assetId = `file-${crypto.randomUUID()}`;
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
      kind: 'file',
      blob: file,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name || 'attachment',
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
        domain: 'content-head',
        mutation: {
          action: 'append-note',
          mutationId,
          note: { id: noteId, threadId, body: `${file.name || 'Attachment'} saved locally. Upload pending.` },
        },
      });
    }
  } catch (error) {
    telemetry('thread-file-persistence-failed', {
      threadId,
      fileName: file.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  appendOptimisticThreadNote({
    noteId,
    createdAt,
    threadId,
    body: `${file.name || 'Attachment'} saved locally. Upload pending.`,
    status: 'uploading file',
  });
  const note = state.activeLedger?.notes?.[threadId]?.find((candidate: Record<string, unknown>) => String(candidate.id ?? '') === noteId);
  if (note) {
    note.localAssetId = assetId;
    note.mutationReceiptId = mutationId;
  }
  await submitPendingThreadAsset(assetId);
}

export async function uploadThreadFileController(input: HTMLInputElement | FileList | File[]): Promise<void> {
  const files = Array.from(isFileInput(input) ? input.files ?? [] : input).filter((file) => file.size > 0);
  if (isFileInput(input)) input.value = '';
  if (files.length === 0) return;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  const threadId = state.threadId;
  telemetry('thread-file-upload', {
    threadId,
    count: files.length,
    bytes: files.reduce((total, file) => total + file.size, 0),
  });
  for (const file of files) await persistAndSubmitFile(threadId, file);
}
