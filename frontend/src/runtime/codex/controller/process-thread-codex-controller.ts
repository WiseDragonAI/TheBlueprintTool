/**
 * WHAT: Starts a Codex run from the active thread panel and refreshes the canvas.
 * WHY: The created run widget is durable card state authored by the backend.
 */
import { state } from '../../state.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestThreadCodexProcess } from '../effect/request-thread-codex-process.js';
import { threadCodexCardId } from '../helper/thread-codex-card-id.js';

export async function processThreadCodexController(input: { threadId?: string; cardId?: string } = {}): Promise<boolean> {
  const ledgerId = String(state.activeTab ?? '').trim();
  const threadId = String(input.threadId ?? state.threadId ?? '').trim();
  const cardId = String(input.cardId ?? '').trim() || threadCodexCardId(state.activeLedger, threadId);
  if (!ledgerId || !threadId || !cardId) return false;
  telemetry('codex-thread-process-start', { ledgerId, threadId, cardId });
  const result = await requestThreadCodexProcess({ ledgerId, threadId, cardId });
  if (!result.ok) {
    telemetry('codex-thread-process-failed', { ledgerId, threadId, cardId, error: result.error ?? '' });
    return false;
  }
  await refreshRuntimeState();
  telemetry('codex-thread-process-created-widget', { ledgerId, threadId, cardId, run: result.run?.id ?? '' });
  return true;
}
