/**
 * WHAT: Restores locally preserved voice uploads into the active thread after reload.
 * WHY: Interrupted pre-acceptance uploads must expose retry without relying on server-owned note state.
 */
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { deletePendingVoiceUpload, listPendingVoiceUploads } from './persist-pending-voice-upload.js';
import { voiceProjectId, voiceReplicaNodeId } from '../helper/voice-project-id.js';
import { beginPendingTaskMutationReceipt } from '../../refresh/helper/pending-task-mutation-receipts.js';

const activeRestores = new Set<string>();
const restoredScopes = new Set<string>();

export async function restorePendingVoiceUploads(threadId: string): Promise<boolean> {
  const projectId = voiceProjectId();
  const replicaNodeId = voiceReplicaNodeId();
  const ledgerId = currentLedgerStateId();
  const restoreKey = `${projectId}:${replicaNodeId}:${ledgerId}:${threadId}`;
  if (!ledgerId || !threadId || !state.activeLedger || activeRestores.has(restoreKey) || restoredScopes.has(restoreKey)) return false;
  activeRestores.add(restoreKey);
  try {
    const entries = await listPendingVoiceUploads({ projectId, replicaNodeId, ledgerId, threadId });
    restoredScopes.add(restoreKey);
    if (!entries.length || !state.activeLedger || state.threadId !== threadId || currentLedgerStateId() !== ledgerId) return false;
    const notesByThread = normalizeLedgerNotes(state.activeLedger);
    const notes = notesByThread[threadId] ?? [];
    let changed = false;
    for (const entry of entries) {
      if (entry.ledgerId === 'tasks') {
        beginPendingTaskMutationReceipt({
          mutationId: entry.mutationId,
          entityId: `${entry.threadId}/${entry.noteId}`,
          projectId: projectId || String(entry.projectId ?? ''),
          ledgerId: entry.ledgerId,
          domain: 'voice',
          mutation: {
            action: 'append-note',
            mutationId: entry.mutationId,
            note: {
              id: entry.noteId,
              threadId: entry.threadId,
              body: 'Voice note captured. Upload pending.',
              source: 'voice',
              status: 'uploading',
              voiceAttemptId: entry.voiceAttemptId,
              revision: 0,
            },
          },
        });
      }
      const note = notes.find((candidate) => String(candidate.id ?? '') === entry.noteId);
      if (note) {
        if (note.voiceFileRef && (note.acceptedAt || note.audioPersistedAt)) {
          await deletePendingVoiceUpload(entry.noteId);
          continue;
        }
        if (String(note.localVoiceUploadId ?? '') !== entry.noteId) {
          note.localVoiceUploadId = entry.noteId;
          changed = true;
        }
        continue;
      }
      notes.push({
        id: entry.noteId,
        role: 'operator',
        message: 'Voice upload was interrupted. Audio is saved locally.',
        timestamp: entry.createdAt,
        status: 'upload failed',
        error: 'Upload did not reach server acceptance.',
        localVoiceUploadId: entry.noteId,
        voiceAttemptId: entry.voiceAttemptId,
        mutationReceiptId: entry.mutationId,
        optimistic: true
      });
      changed = true;
    }
    notesByThread[threadId] = notes;
    if (changed && globalThis.document) {
      const { renderThreadPanel } = await import('../../thread/effect/render-thread-panel.js');
      renderThreadPanel();
    }
    return changed;
  } catch (error) {
    telemetry('voice-upload-restore-failed', { ledgerId, threadId, error: error instanceof Error ? error.message : String(error) });
    return false;
  } finally {
    activeRestores.delete(restoreKey);
  }
}

export function clearPendingVoiceUploadRestoreStateForTest(): void {
  activeRestores.clear();
  restoredScopes.clear();
}
