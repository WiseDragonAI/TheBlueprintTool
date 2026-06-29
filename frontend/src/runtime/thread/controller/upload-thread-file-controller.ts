/**
 * WHAT: Uploads selected local files and records them as markdown thread notes.
 * WHY: Thread context needs durable attachments without bypassing the ledger note mutation path.
 */
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { appendOptimisticThreadNote } from '../effect/append-optimistic-thread-note.js';
import { patchOptimisticThreadNote } from '../effect/patch-optimistic-thread-note.js';

type ThreadFileUploadResponse = {
  ok?: boolean;
  fileRef?: string;
  markdown?: string;
  error?: string;
};

async function uploadThreadFile(threadId: string, file: File): Promise<ThreadFileUploadResponse> {
  const response = await fetch('/api/thread-file-upload', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-thread-id': threadId,
      'x-file-name': encodeURIComponent(file.name || 'attachment')
    },
    body: file
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, error: 'File upload failed.' };
  return response.json().catch(() => ({ ok: false, error: 'File upload response was invalid.' })) as Promise<ThreadFileUploadResponse>;
}

async function uploadOneThreadFile(threadId: string, file: File): Promise<void> {
  const noteId = appendOptimisticThreadNote({ threadId, body: `Uploading ${file.name || 'file'}...`, status: 'uploading file' });
  const upload = await uploadThreadFile(threadId, file);
  const markdown = String(upload.markdown || (upload.fileRef ? `[${file.name || 'Attachment'}](${upload.fileRef})` : ''));
  if (upload.ok === false || !markdown) {
    patchOptimisticThreadNote({ threadId, noteId, status: 'file upload failed', error: upload.error || 'File upload failed.', optimistic: true });
    return;
  }
  patchOptimisticThreadNote({ threadId, noteId, body: markdown, status: 'committing file' });
  const committed = await sendActiveLedgerMutation({
    action: 'append-note',
    note: { id: noteId, threadId, body: markdown }
  });
  patchOptimisticThreadNote({
    threadId,
    noteId,
    status: committed ? '' : 'file note commit failed',
    error: committed ? '' : 'Backend did not confirm the file note.',
    optimistic: !committed
  });
}

function isFileInput(value: HTMLInputElement | FileList | File[]): value is HTMLInputElement {
  return typeof HTMLInputElement !== 'undefined' && value instanceof HTMLInputElement;
}

export async function uploadThreadFileController(input: HTMLInputElement | FileList | File[]): Promise<void> {
  const files = Array.from(isFileInput(input) ? input.files ?? [] : input).filter((file) => file.size > 0);
  if (isFileInput(input)) input.value = '';
  if (files.length === 0) return;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  const threadId = state.threadId;
  telemetry('thread-file-upload', { threadId, count: files.length, bytes: files.reduce((total, file) => total + file.size, 0) });
  for (const file of files) await uploadOneThreadFile(threadId, file);
}
