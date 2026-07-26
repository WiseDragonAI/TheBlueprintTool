/**
 * WHAT: Refreshes only the notes owned by the active thread content file.
 * WHY: Thread lifecycle events must not replace or rerender the live canvas ledger.
 */
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { mergeLocalThreadNotes } from '../../ledger/helper/merge-local-thread-notes.js';
import { normalizeDeletedNoteIds } from '../../ledger/helper/normalize-deleted-note-ids.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { state, type ThreadContentRefreshScope } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderThreadNotes } from './render-thread-notes.js';
import { isThreadFollowingBottom } from '../helper/thread-follow-bottom.js';
import { pinThreadFeedToLastMessage } from './pin-thread-feed-to-last-message.js';
import { projectScopedRequestPath, replicaRequestInit } from '../../project/helper/project-request-scope.js';
import { acceptTaskClockForInstall, taskClockFromResponse } from '../../refresh/helper/task-causal-clock.js';

type AnyRecord = Record<string, any>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeContentFileReference(value: unknown): string {
  const file = String(value ?? '').trim().replace(/\\/g, '/');
  if (file.startsWith('/.decision-os/')) return file.slice(1);
  return file.replace(/^\.\/+/, '');
}

function threadContentFile(ledger: AnyRecord | null | undefined, threadId: string): string {
  // WHAT: Treat missing thread ownership maps as an absent content file.
  // WHY: Scope checks require an explicit ledger-owned file reference.
  if (!isRecord(ledger?.threadFiles)) return '';
  return normalizeContentFileReference(ledger.threadFiles[threadId]);
}

export function activeThreadContentScope(): ThreadContentRefreshScope | null {
  const ledgerId = currentLedgerStateId();
  const threadId = String(state.threadId ?? '').trim();
  const contentFile = threadContentFile(state.activeLedger, threadId);
  // WHAT: Construct a scope only from a complete active ledger, thread, and file identity.
  // WHY: Partial UI state cannot safely own a thread slice response.
  if (!isRecord(state.activeLedger) || !ledgerId || !threadId || !contentFile) return null;
  return { projectId: String(state.projectId ?? ''), replicaNodeId: String(state.replicaNodeId ?? ''), ledgerId, threadId, contentFile };
}

export function activeThreadIdentityScope(): ThreadContentRefreshScope | null {
  const ledgerId = currentLedgerStateId();
  const threadId = String(state.threadId ?? '').trim();
  if (!isRecord(state.activeLedger) || !ledgerId || !threadId) return null;
  return {
    projectId: String(state.projectId ?? ''),
    replicaNodeId: String(state.replicaNodeId ?? ''),
    ledgerId,
    threadId,
    contentFile: threadContentFile(state.activeLedger, threadId)
  };
}

function isActiveThreadIdentityScope(scope: ThreadContentRefreshScope | null | undefined): boolean {
  if (!scope) return false;
  const activeScope = activeThreadIdentityScope();
  return Boolean(
    activeScope
    && String(scope.projectId ?? '').trim() === activeScope.projectId
    && String(scope.replicaNodeId ?? '').trim() === activeScope.replicaNodeId
    && String(scope.ledgerId ?? '').trim() === activeScope.ledgerId
    && String(scope.threadId ?? '').trim() === activeScope.threadId
    && (!normalizeContentFileReference(scope.contentFile) || normalizeContentFileReference(scope.contentFile) === activeScope.contentFile)
  );
}

export function isActiveThreadContentScope(scope: ThreadContentRefreshScope | null | undefined): boolean {
  // WHAT: Reject absent event scopes before comparing active ownership.
  // WHY: Unscoped lifecycle events must never refresh the visible thread.
  if (!scope) return false;
  const activeScope = activeThreadContentScope();
  return Boolean(
    activeScope
    && String(scope.projectId ?? '').trim() === activeScope.projectId
    && String(scope.replicaNodeId ?? '').trim() === activeScope.replicaNodeId
    && String(scope.ledgerId ?? '').trim() === activeScope.ledgerId
    && String(scope.threadId ?? '').trim() === activeScope.threadId
    && normalizeContentFileReference(scope.contentFile) === activeScope.contentFile
  );
}

function serverOwnsThreadScope(ledger: AnyRecord, scope: ThreadContentRefreshScope): boolean {
  return threadContentFile(ledger, scope.threadId) === normalizeContentFileReference(scope.contentFile);
}

export async function loadActiveThreadSlice(
  scope: ThreadContentRefreshScope,
  options: { signal?: AbortSignal; allowMissingContentFile?: boolean } = {}
): Promise<boolean> {
  // WHAT: Reject work that no longer targets the active thread before any fetch.
  // WHY: Inactive ledger events must remain zero-IO no-ops.
  const bootstrapIdentity = options.allowMissingContentFile === true && !normalizeContentFileReference(scope.contentFile);
  const ownsActiveScope = bootstrapIdentity
    ? isActiveThreadIdentityScope(scope)
    : isActiveThreadContentScope(scope);
  if (!ownsActiveScope) {
    telemetry('thread-content-refresh-skipped', { reason: 'inactive-scope', ...scope });
    return false;
  }
  const activeLedgerAtRequest = state.activeLedger as AnyRecord;
  const endpoint = projectScopedRequestPath(`/api/ledgers/${encodeURIComponent(scope.ledgerId)}/threads/${encodeURIComponent(scope.threadId)}`, scope.projectId);
  const response = await fetch(
    endpoint,
    replicaRequestInit(options.signal ? { signal: options.signal } : undefined, scope.replicaNodeId)
  ).catch(() => undefined);
  // WHAT: Preserve the current thread on network and non-success responses.
  // WHY: Failed refreshes must not clear visible notes.
  if (!response?.ok) {
    telemetry('thread-content-refresh-failed', { reason: `http-${response?.status ?? 0}`, ...scope });
    return false;
  }
  const incomingLedger = await response.json().catch(() => null);
  // WHAT: Reject non-object ledger response bodies.
  // WHY: Thread ownership and note maps require a valid ledger document.
  if (!isRecord(incomingLedger)) {
    telemetry('thread-content-refresh-failed', { reason: 'invalid-ledger', ...scope });
    return false;
  }
  // WHAT: Reject the response when route or thread identity changed during the fetch.
  // WHY: Awaited work must not cross an operator navigation boundary.
  const stillOwnsActiveScope = () => state.activeLedger === activeLedgerAtRequest && (
    bootstrapIdentity ? isActiveThreadIdentityScope(scope) : isActiveThreadContentScope(scope)
  );
  if (!stillOwnsActiveScope()) {
    telemetry('thread-content-refresh-skipped', { reason: 'active-thread-changed', ...scope });
    return false;
  }
  // WHAT: Require the response ledger to confirm the same thread content-file ownership.
  // WHY: Endpoint reuse must not admit a slice from mismatched server state.
  const responseContentFile = threadContentFile(incomingLedger, scope.threadId);
  if (!responseContentFile || (!bootstrapIdentity && !serverOwnsThreadScope(incomingLedger, scope))) {
    telemetry('thread-content-refresh-skipped', { reason: 'response-scope-mismatch', ...scope });
    return false;
  }

  const threadId = scope.threadId;
  const serverNotes = normalizeLedgerNotes(incomingLedger)[threadId];
  const serverDeletedNoteIds = normalizeDeletedNoteIds(incomingLedger)[threadId];
  const incomingSlice = mergeLocalThreadNotes({
    notes: { [threadId]: Array.isArray(serverNotes) ? [...serverNotes] : [] },
    deletedNoteIds: { [threadId]: Array.isArray(serverDeletedNoteIds) ? [...serverDeletedNoteIds] : [] }
  }, {
    localLedger: activeLedgerAtRequest,
    threadId
  });
  // WHAT: Recheck ownership after local-note merging and before mutating active state.
  // WHY: Synchronous callbacks can change thread context between the fetch and apply boundary.
  if (!incomingSlice || !stillOwnsActiveScope()) {
    telemetry('thread-content-refresh-skipped', { reason: 'active-thread-changed-before-apply', ...scope });
    return false;
  }
  // WHAT: Submit the notes-only fast path to the same Epoch 4 clock gate as complete ledger projections.
  // WHY: An event-triggered thread read must not bypass acknowledgement of a locally persisted message.
  if (!acceptTaskClockForInstall(taskClockFromResponse(response), 'event-thread-content-refresh')) return false;

  activeLedgerAtRequest.threadFiles = {
    ...(isRecord(activeLedgerAtRequest.threadFiles) ? activeLedgerAtRequest.threadFiles : {}),
    [threadId]: responseContentFile
  };
  normalizeLedgerNotes(activeLedgerAtRequest)[threadId] = normalizeLedgerNotes(incomingSlice)[threadId] ?? [];
  normalizeDeletedNoteIds(activeLedgerAtRequest)[threadId] = normalizeDeletedNoteIds(incomingSlice)[threadId] ?? [];
  renderThreadNotes();
  if (isThreadFollowingBottom(threadId, 'thread')) pinThreadFeedToLastMessage();
  telemetry('thread-content-refresh-applied', {
    ...scope,
    noteCount: normalizeLedgerNotes(activeLedgerAtRequest)[threadId].length
  });
  return true;
}
