/**
 * WHAT: Uploads pasted clipboard images and records them as markdown thread notes.
 * WHY: Visual context should live in the same patchable thread markdown as text and voice notes.
 */
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { appendOptimisticThreadNote } from '../effect/append-optimistic-thread-note.js';
import { commitPendingThreadMessage } from '../effect/commit-pending-thread-message.js';
import { patchOptimisticThreadNote } from '../effect/patch-optimistic-thread-note.js';
import { persistPendingThreadMessage } from '../effect/persist-pending-thread-message.js';

type ThreadImageUploadResponse = {
  ok?: boolean;
  imageFileRef?: string;
  markdown?: string;
  error?: string;
};

function firstClipboardImage(event: ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
  const file = imageItem?.getAsFile();
  return file && file.size > 0 ? file : null;
}

async function uploadThreadImage(threadId: string, file: File): Promise<ThreadImageUploadResponse> {
  const response = await fetch('/api/thread-image-upload', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'image/png',
      'x-thread-id': threadId,
      'x-ledger-id': currentLedgerStateId()
    },
    body: file
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, error: 'Image upload failed.' };
  return response.json().catch(() => ({ ok: false, error: 'Image upload response was invalid.' })) as Promise<ThreadImageUploadResponse>;
}

export async function pasteThreadImageController(event: ClipboardEvent): Promise<boolean> {
  const target = event.target as HTMLElement | null;
  if (!target?.closest('.thread-draft')) return false;
  const image = firstClipboardImage(event);
  if (!image) return false;
  event.preventDefault();
  if (!state.threadId) state.threadId = 'conversation-ledger';
  const threadId = state.threadId;
  telemetry('thread-image-paste', { threadId, type: image.type, size: image.size });
  const localPreview = typeof URL?.createObjectURL === 'function' ? URL.createObjectURL(image) : '';
  const noteId = appendOptimisticThreadNote({
    threadId,
    body: localPreview ? `![Pasted image](${localPreview})` : 'Uploading pasted image...',
    status: 'uploading image',
  });
  const upload = await uploadThreadImage(threadId, image);
  const markdown = String(upload.markdown || (upload.imageFileRef ? `![Pasted image](${upload.imageFileRef})` : ''));
  if (upload.ok === false || !markdown) {
    patchOptimisticThreadNote({ threadId, noteId, status: 'image upload failed', error: upload.error || 'Image upload failed.', optimistic: true });
    return true;
  }
  if (localPreview) URL.revokeObjectURL(localPreview);
  let pending;
  try {
    // WHAT: Admit the uploaded image note through the same durable receipt as text.
    // WHY: A backend rejection or reload must retain the exact markdown and retry identity.
    pending = persistPendingThreadMessage({
      projectId: String(state.projectId ?? ''),
      replicaNodeId: String(state.replicaNodeId ?? ''),
      ledgerId: currentLedgerStateId(),
      threadId,
      noteId,
      body: markdown,
    });
  } catch (error) {
    patchOptimisticThreadNote({
      threadId,
      noteId,
      body: markdown,
      status: 'image note persistence failed',
      error: `Image note recovery is blocked locally (${error instanceof Error ? error.message : String(error)}).`,
      optimistic: true,
    });
    return true;
  }
  patchOptimisticThreadNote({
    threadId,
    noteId,
    body: markdown,
    status: 'committing image',
    pendingMessageId: noteId,
  });
  await commitPendingThreadMessage(pending);
  return true;
}
