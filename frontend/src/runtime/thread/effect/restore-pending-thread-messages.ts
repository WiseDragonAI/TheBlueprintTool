/**
 * WHAT: Restores and retries durable text-message intents for the active thread after reload.
 * WHY: Browser lifecycle must not strand a message that was locally admitted before backend confirmation.
 */
import { state } from '../../state.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { appendOptimisticThreadNote } from './append-optimistic-thread-note.js';
import { commitPendingThreadMessage } from './commit-pending-thread-message.js';
import {
  deletePendingThreadMessage,
  pendingThreadMessages,
  type PendingThreadMessage,
} from './persist-pending-thread-message.js';

const activeRestores = new Set<string>();
const attemptedReceipts = new Set<string>();

function retryKey(message: PendingThreadMessage): string {
  return JSON.stringify([message.projectId, message.replicaNodeId, message.ledgerId, message.threadId, message.noteId]);
}

export async function restorePendingThreadMessages(threadId = String(state.threadId ?? '')): Promise<boolean> {
  const projectId = String(state.projectId ?? '');
  const replicaNodeId = String(state.replicaNodeId ?? '');
  const ledgerId = String(state.activeTab ?? '');
  if (!state.activeLedger || !ledgerId || !threadId) return false;
  const scopeKey = JSON.stringify([projectId, replicaNodeId, ledgerId, threadId]);
  if (activeRestores.has(scopeKey)) return false;
  activeRestores.add(scopeKey);
  try {
    const messages = pendingThreadMessages({ projectId, replicaNodeId, ledgerId, threadId });
    const notes = normalizeLedgerNotes(state.activeLedger)[threadId] ?? [];
    for (const message of messages) {
      const existing = notes.find((note) => String(note.id ?? '') === message.noteId);
      if (existing && existing.optimistic !== true) {
        deletePendingThreadMessage(message);
        continue;
      }
      if (!existing) {
        appendOptimisticThreadNote({
          noteId: message.noteId,
          createdAt: message.createdAt,
          threadId,
          body: message.body,
          status: message.lastErrorCode ? 'commit failed' : 'committing',
          error: message.lastErrorMessage,
          pendingMessageId: message.noteId,
        });
      }
      const key = retryKey(message);
      if (attemptedReceipts.has(key)) continue;
      attemptedReceipts.add(key);
      await commitPendingThreadMessage(message);
    }
    return messages.length > 0;
  } catch (error) {
    telemetry('restore-thread-messages-failed', {
      projectId,
      ledgerId,
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    activeRestores.delete(scopeKey);
  }
}
