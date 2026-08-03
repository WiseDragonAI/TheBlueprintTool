type AnyRecord = Record<string, unknown>;

/**
 * WHAT: Extracts the provider session identity from supported Codex event envelopes.
 * WHY: Live lifecycle capture and failure recovery must use one identity contract.
 */
export function codexSessionIdFromEvent(event: AnyRecord): string {
  const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? event.payload as AnyRecord
    : {};
  return String(event.thread_id ?? event.session_id ?? payload.thread_id ?? payload.session_id ?? payload.id ?? '').trim();
}
