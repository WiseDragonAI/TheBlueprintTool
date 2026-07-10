/**
 * WHAT: Parses a ledger-content SSE message into the browser's scoped refresh payload.
 * WHY: Subscription behavior should consume one normalized event shape independent of transport parsing.
 */
export type ContentChangeEvent = {
  cardId?: string;
  contentFile?: string;
  kind?: string;
  ledgerId?: string;
  outputCardId?: string;
  reason?: string;
  runId?: string;
  threadId?: string;
};

export function contentEventPayload(event: Event): ContentChangeEvent {
  const data = String((event as MessageEvent).data ?? '');
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return {
      cardId: typeof parsed.cardId === 'string' ? parsed.cardId : '',
      contentFile: typeof parsed.contentFile === 'string' ? parsed.contentFile : '',
      kind: typeof parsed.kind === 'string' ? parsed.kind : '',
      ledgerId: typeof parsed.ledgerId === 'string' ? parsed.ledgerId : '',
      outputCardId: typeof parsed.outputCardId === 'string' ? parsed.outputCardId : '',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      runId: typeof parsed.runId === 'string' ? parsed.runId : '',
      threadId: typeof parsed.threadId === 'string' ? parsed.threadId : ''
    };
  } catch {
    // WHAT: Normalize malformed SSE data to an unscoped empty payload.
    // WHY: Ownership gates will safely reject it without terminating the event stream.
    return {};
  }
}
