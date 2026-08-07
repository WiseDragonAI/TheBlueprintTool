/**
 * WHAT: Resumes one browser-persisted image or file through upload and exact note acknowledgement.
 * WHY: Capture, upload, and note commit are independently restartable durable phases.
 */
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { replacePendingTaskMutationReceipt } from '../../refresh/helper/pending-task-mutation-receipts.js';
import { projectScopedRequestPath, replicaRequestInit } from '../../project/helper/project-request-scope.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { patchOptimisticThreadNote } from './patch-optimistic-thread-note.js';
import {
  deletePendingThreadAsset,
  persistPendingThreadAsset,
  readPendingThreadAsset,
  type PendingThreadAsset,
} from './persist-pending-thread-asset.js';

type UploadResponse = {
  ok?: boolean;
  imageFileRef?: string;
  previewFileRef?: string;
  fileRef?: string;
  markdown?: string;
  error?: string;
};

const activeSubmissions = new Set<string>();

function uploadPath(entry: PendingThreadAsset): string {
  return projectScopedRequestPath(
    entry.kind === 'image' ? '/api/thread-image-upload' : '/api/thread-file-upload',
    entry.projectId,
  );
}

async function upload(entry: PendingThreadAsset): Promise<UploadResponse> {
  const response = await fetch(uploadPath(entry), replicaRequestInit({
    method: 'POST',
    headers: {
      'content-type': entry.mimeType || (entry.kind === 'image' ? 'image/png' : 'application/octet-stream'),
      'x-thread-id': entry.threadId,
      'x-ledger-id': entry.ledgerId,
      'x-card-id': entry.cardId,
      'x-note-id': entry.noteId,
      'x-asset-id': entry.assetId,
      'x-file-name': encodeURIComponent(entry.fileName || (entry.kind === 'image' ? 'pasted-image' : 'attachment')),
    },
    body: entry.blob,
  }, entry.replicaNodeId)).catch(() => undefined);
  if (!response) return { ok: false, error: 'Asset upload failed before backend acceptance.' };
  const body = await response.json().catch(() => null) as UploadResponse | null;
  if (!response.ok || !body || body.ok === false) {
    return { ok: false, error: body?.error || `Asset upload failed with HTTP ${response.status}.` };
  }
  return body;
}

function finalMarkdown(entry: PendingThreadAsset, result: UploadResponse): string {
  if (result.markdown) return String(result.markdown);
  if (entry.kind === 'image' && result.imageFileRef) return `![Pasted image](${result.imageFileRef})`;
  if (entry.kind === 'file' && result.fileRef) return `[${entry.fileName || 'Attachment'}](${result.fileRef})`;
  return '';
}

export async function submitPendingThreadAsset(assetId: string): Promise<boolean> {
  if (activeSubmissions.has(assetId)) return false;
  activeSubmissions.add(assetId);
  try {
    let entry = await readPendingThreadAsset(assetId);
    if (!entry) return false;
    if (entry.phase === 'captured') {
      patchOptimisticThreadNote({
        threadId: entry.threadId,
        noteId: entry.noteId,
        status: `uploading ${entry.kind}`,
        error: '',
        localAssetId: entry.assetId,
      });
      const result = await upload(entry);
      const markdown = finalMarkdown(entry, result);
      if (result.ok === false || !markdown) {
        patchOptimisticThreadNote({
          threadId: entry.threadId,
          noteId: entry.noteId,
          status: `${entry.kind} upload failed`,
          error: result.error || 'Asset upload failed.',
          optimistic: true,
          localAssetId: entry.assetId,
        });
        return false;
      }
      entry = {
        ...entry,
        phase: 'uploaded',
        assetRef: String(result.imageFileRef ?? result.fileRef ?? ''),
        previewRef: String(result.previewFileRef ?? ''),
        markdown,
      };
      await persistPendingThreadAsset(entry);
    }

    const mutation = {
      action: 'append-note' as const,
      mutationId: entry.mutationId,
      note: { id: entry.noteId, threadId: entry.threadId, body: entry.markdown },
    };
    if (entry.ledgerId === 'tasks') replacePendingTaskMutationReceipt(entry.mutationId, mutation);
    patchOptimisticThreadNote({
      threadId: entry.threadId,
      noteId: entry.noteId,
      body: entry.markdown,
      status: `committing ${entry.kind}`,
      error: '',
      optimistic: true,
      localAssetId: entry.assetId,
    });
    const committed = await sendActiveLedgerMutation(mutation, {
      domain: entry.kind === 'image' ? 'image' : 'content-head',
      entityId: `${entry.threadId}/${entry.noteId}`,
    });
    if (!committed) {
      patchOptimisticThreadNote({
        threadId: entry.threadId,
        noteId: entry.noteId,
        status: `${entry.kind} note commit failed`,
        error: 'Backend did not confirm the exact asset note.',
        optimistic: true,
        localAssetId: entry.assetId,
      });
      return false;
    }
    await deletePendingThreadAsset(entry.assetId);
    patchOptimisticThreadNote({
      threadId: entry.threadId,
      noteId: entry.noteId,
      status: `synchronizing ${entry.kind}`,
      error: '',
      optimistic: true,
      localAssetId: '',
    });
    telemetry('thread-asset-accepted', {
      assetId: entry.assetId,
      noteId: entry.noteId,
      threadId: entry.threadId,
      kind: entry.kind,
    });
    return true;
  } catch (error) {
    telemetry('thread-asset-submit-failed', {
      assetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    activeSubmissions.delete(assetId);
  }
}

export function clearPendingThreadAssetSubmissionsForTest(): void {
  activeSubmissions.clear();
}
