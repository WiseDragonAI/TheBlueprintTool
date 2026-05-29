/**
 * WHAT: Formats unanswered thread records for operator and agent command-line use.
 * WHY: agents need thread ids and exact answer commands to post replies back into the ledger.
 */
import type { UnansweredThread } from '../../../lib/types.js';

function compact(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function formatUnansweredThreads(threads: UnansweredThread[], json = false): string {
  if (json) return JSON.stringify({ threads }, null, 2);
  if (threads.length === 0) return 'No threads awaiting agent answer.';
  const lines = [`Threads awaiting agent answer (${threads.length})`];
  for (const thread of threads) {
    const notes = thread.pendingNotes.length ? thread.pendingNotes : [thread.lastNote];
    lines.push(
      `- ${thread.title}`,
      `  threadId: ${thread.threadId}`,
      `  answer: ${thread.answerCommand}`,
    );
    if (notes.length > 1) lines.push(`  pendingNotes: ${notes.length}`);
    notes.forEach((note, index) => {
      const details = [
        note.role ? `role=${note.role}` : '',
        note.status ? `status=${note.status}` : '',
        note.timestamp ? `timestamp=${note.timestamp}` : '',
      ].filter(Boolean).join(' ');
      const prefix = notes.length > 1 ? `  note ${index + 1}:` : '  last:';
      lines.push(
        `${prefix} ${details || 'note'}`,
        `  message: ${compact(note.message)}`,
      );
    });
  }
  return lines.join('\n');
}
