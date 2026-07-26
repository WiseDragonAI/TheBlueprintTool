/**
 * WHAT: Retries one durable text-message intent with its stable note identity.
 * WHY: Lost responses and recoverable backend failures must converge without duplicating or erasing the message.
 */
import { sendActiveLedgerMutationResult, type ActiveLedgerMutationResult } from '../../ledger/effect/send-active-ledger-mutation.js';
import { patchOptimisticThreadNote } from './patch-optimistic-thread-note.js';
import {
  deletePendingThreadMessage,
  recordPendingThreadMessageAttempt,
  recordPendingThreadMessageFailure,
  type PendingThreadMessage,
} from './persist-pending-thread-message.js';

function failureMessage(result: ActiveLedgerMutationResult): string {
  if (result.errorCode === 'task_content_conflict') {
    return `Thread synchronization conflict (${result.errorCode}). Your message is saved locally; retry after recovery.`;
  }
  if (result.errorCode === 'task_content_unavailable') {
    return `Thread content is temporarily unavailable (${result.errorCode}). Your message is saved locally; retry when the project is available.`;
  }
  if (result.errorCode === 'network_unavailable') {
    return 'The server could not be reached. Your message is saved locally; retry when the connection returns.';
  }
  return `The message was not accepted (${result.errorCode || `HTTP ${result.status}`}). It is saved locally and can be retried.`;
}

export async function commitPendingThreadMessage(message: PendingThreadMessage): Promise<boolean> {
  try {
    let attempted = recordPendingThreadMessageAttempt(message);
    patchOptimisticThreadNote({
      threadId: attempted.threadId,
      noteId: attempted.noteId,
      status: attempted.attemptCount > 1 ? 'retrying' : 'committing',
      error: '',
      optimistic: true,
      pendingMessageId: attempted.noteId,
    });
    const result = await sendActiveLedgerMutationResult({
      action: 'append-note',
      note: {
        id: attempted.noteId,
        threadId: attempted.threadId,
        body: attempted.body,
      },
    });
    if (result.ok) {
      deletePendingThreadMessage(attempted);
      patchOptimisticThreadNote({
        threadId: attempted.threadId,
        noteId: attempted.noteId,
        status: '',
        error: '',
        optimistic: false,
        pendingMessageId: '',
      });
      return true;
    }
    const errorMessage = failureMessage(result);
    attempted = recordPendingThreadMessageFailure(attempted, {
      status: result.status,
      errorCode: result.errorCode,
      errorMessage,
    });
    patchOptimisticThreadNote({
      threadId: attempted.threadId,
      noteId: attempted.noteId,
      status: 'commit failed',
      error: errorMessage,
      optimistic: true,
      pendingMessageId: attempted.noteId,
    });
    return false;
  } catch (error) {
    // WHAT: Contain local persistence failures inside the owning message attempt.
    // WHY: A failed retry must not become an unhandled browser rejection or erase the already durable receipt.
    patchOptimisticThreadNote({
      threadId: message.threadId,
      noteId: message.noteId,
      status: 'commit failed',
      error: `Message recovery is blocked locally (${error instanceof Error ? error.message : String(error)}). The original intent remains preserved.`,
      optimistic: true,
      pendingMessageId: message.noteId,
    });
    return false;
  }
}
