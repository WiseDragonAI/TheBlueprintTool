/**
 * WHAT: Retries one locally durable thread message from its inline recovery action.
 * WHY: A failed send must have a direct recovery path that preserves its stable note identity.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { commitPendingThreadMessage } from '../effect/commit-pending-thread-message.js';
import { pendingThreadMessage } from '../effect/persist-pending-thread-message.js';

export async function retryPendingThreadMessageController(input: { threadId: string; noteId: string }): Promise<boolean> {
  try {
    const message = pendingThreadMessage({
      projectId: String(state.projectId ?? ''),
      replicaNodeId: String(state.replicaNodeId ?? ''),
      ledgerId: String(state.activeTab ?? ''),
      threadId: input.threadId,
      noteId: input.noteId,
    });
    if (!message) {
      telemetry('retry-thread-message-skipped', { ...input, reason: 'pending-message-missing' });
      return false;
    }
    telemetry('retry-thread-message', input);
    return commitPendingThreadMessage(message);
  } catch (error) {
    // WHAT: Keep a corrupt or unavailable local store scoped to this retry action.
    // WHY: Inline recovery must not break unrelated thread controls.
    telemetry('retry-thread-message-failed', {
      ...input,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
