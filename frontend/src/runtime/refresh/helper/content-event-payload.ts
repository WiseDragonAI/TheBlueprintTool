/**
 * WHAT: Parses a ledger-content SSE message into the browser's scoped refresh payload.
 * WHY: Subscription behavior should consume one normalized event shape independent of transport parsing.
 */
export type ContentChangeEvent = {
  cardId?: string;
  cardIds?: string[];
  contentFile?: string;
  kind?: string;
  ledgerId?: string;
  outputCardId?: string;
  pipelineRunId?: string;
  pipelineStatus?: string;
  reason?: string;
  runId?: string;
  status?: string;
  threadId?: string;
  noteId?: string;
  revision?: number;
};

export function contentEventPayload(event: Event): ContentChangeEvent {
  const data = String((event as MessageEvent).data ?? '');
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return {
      cardId: typeof parsed.cardId === 'string' ? parsed.cardId : '',
      cardIds: Array.isArray(parsed.cardIds) ? parsed.cardIds.map((value) => String(value ?? '').trim()).filter(Boolean) : [],
      contentFile: typeof parsed.contentFile === 'string' ? parsed.contentFile : '',
      kind: typeof parsed.kind === 'string' ? parsed.kind : '',
      ledgerId: typeof parsed.ledgerId === 'string' ? parsed.ledgerId : '',
      outputCardId: typeof parsed.outputCardId === 'string' ? parsed.outputCardId : '',
      pipelineRunId: typeof parsed.pipelineRunId === 'string' ? parsed.pipelineRunId : '',
      pipelineStatus: typeof parsed.pipelineStatus === 'string' ? parsed.pipelineStatus : '',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      runId: typeof parsed.runId === 'string' ? parsed.runId : '',
      status: typeof parsed.status === 'string' ? parsed.status : '',
      threadId: typeof parsed.threadId === 'string' ? parsed.threadId : '',
      noteId: typeof parsed.noteId === 'string' ? parsed.noteId : '',
      revision: Number.isFinite(Number(parsed.revision)) ? Number(parsed.revision) : 0
    };
  } catch {
    // WHAT: Normalize malformed SSE data to an unscoped empty payload.
    // WHY: Ownership gates will safely reject it without terminating the event stream.
    return {};
  }
}
