/**
 * WHAT: Renders the latest agent note from the active admitted thread.
 * WHY: <LAST_AGENT_NOTE> must expose one exact prior answer without replaying the complete conversation.
 */
import { formatThreadMarkdown, parseThreadMarkdown } from '../../ledger/helper/thread-content-file.js';

export function buildLastAgentNoteMarkdown(threadMarkdown: string): string {
  const lastAgentNote = parseThreadMarkdown(threadMarkdown)
    .reverse()
    .find((note) => String(note.role ?? '').toLowerCase() === 'agent');
  return lastAgentNote ? formatThreadMarkdown([lastAgentNote]) : '';
}
