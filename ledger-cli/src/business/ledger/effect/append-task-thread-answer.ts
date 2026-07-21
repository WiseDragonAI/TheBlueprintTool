/**
 * WHAT: Appends one task-thread answer through the scoped Decision OS mutation route.
 * WHY: The CLI must not edit task Markdown before the causal task worker accepts the note.
 */
import { randomUUID } from 'node:crypto';
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { readAnswerMessage } from '../helper/read-answer-message.js';

type Operation = { message?: string; messageFile?: string; threadId?: string };

export async function appendTaskThreadAnswer(operation: Operation | undefined, fs?: FileSystemPort): Promise<Result<string>> {
  const threadId = String(operation?.threadId ?? '').trim();
  if (!threadId) return { ok: false, error: 'Answer command requires --thread-id.' };
  const message = await readAnswerMessage(operation, fs);
  if (!message.trim()) return { ok: false, error: 'Answer command requires --message or --message-file.' };
  if (/^#\s+(?:AGENT|OPERATOR)\s*$/im.test(message)) return { ok: false, error: 'Answer message must contain one note body without a thread role heading.' };
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  if (!serverUrl || !projectId) return { ok: false, error: 'Task answers require the running Decision OS worker (`DECISION_OS_SERVER_URL` and `DECISION_OS_PROJECT_ID`).' };
  const note = { id: `note-agent-${Date.now()}-${randomUUID().slice(0, 8)}`, threadId, body: message, role: 'agent' };
  try {
    const response = await fetch(`${serverUrl}/p/${encodeURIComponent(projectId)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append-note', note }),
    });
    if (!response.ok) return { ok: false, error: `Decision OS task answer failed (${response.status}): ${await response.text()}` };
    const payload = await response.json() as { changedThread?: { notes?: Record<string, Array<Record<string, unknown>>> } };
    const persisted = payload.changedThread?.notes?.[threadId]?.find((entry) => entry.id === note.id);
    if (!persisted) return { ok: false, error: 'Decision OS task answer returned no committed note.' };
    return { ok: true, value: JSON.stringify({ version: 1, persisted: true, note: persisted }, null, 2) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
