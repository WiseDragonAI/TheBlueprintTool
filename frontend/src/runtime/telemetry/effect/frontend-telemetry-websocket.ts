/**
 * WHAT: Sends bounded global browser telemetry to the same-origin Decision OS diagnostic socket.
 * WHY: Failures occurring only in the operator browser need server-readable causal evidence when explicitly enabled.
 */
export type FrontendTelemetryTrace = { name: string; args: unknown; at: string };

const maxQueuedRecords = 200;
const maxBatchRecords = 50;
const flushDelayMs = 250;
const sessionId = globalThis.crypto?.randomUUID?.() ?? `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const queue: Array<FrontendTelemetryTrace & { browserSessionId: string; route: string }> = [];
let socket: WebSocket | null = null;
let endpoint = '';
let enabled = false;
let installed = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

const redactedKey = /^(?:authorization|body|content|credential|markdown|openaiApiKey|output|prompt|secret|token|transcript)$/i;

function sanitize(value: unknown, depth = 0): unknown {
  // WHAT: Preserve scalar telemetry while bounding diagnostic string size.
  // WHY: Names, errors, identifiers, and stacks are actionable but cannot carry unlimited browser data.
  if (typeof value === 'string') return value.slice(0, 2_048);
  // WHAT: Preserve JSON scalar types without transforming their diagnostic meaning.
  // WHY: Booleans, numbers, and null contain no nested content-bearing fields.
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  // WHAT: Replace values beyond the bounded diagnostic traversal depth.
  // WHY: Recursive application state must not inflate frames or retain arbitrarily nested content.
  if (depth >= 4) return '[truncated]';
  // WHAT: Retain only the first twenty-five entries of telemetry arrays.
  // WHY: Large collections are summarized by their surrounding trace and must not dominate one frame.
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => sanitize(entry, depth + 1));
  // WHAT: Replace unsupported runtime values with their type marker.
  // WHY: Functions, symbols, and undefined are not stable JSON telemetry values.
  if (!value || typeof value !== 'object') return `[${typeof value}]`;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    // WHAT: Redact credential and authored-content fields by key before serialization.
    // WHY: Global diagnostics need causal metadata, never secrets, Markdown, prompts, transcripts, or raw output.
    if (redactedKey.test(key)) output[key] = '[redacted]';
    else output[key] = sanitize(entry, depth + 1);
  }
  return output;
}

function scheduleFlush(): void {
  // WHAT: Coalesce telemetry into one short bounded batch timer.
  // WHY: Global instrumentation must not create one network frame per application transition.
  if (flushTimer || queue.length === 0) return;
  flushTimer = globalThis.setTimeout(() => {
    flushTimer = null;
    // WHAT: Wait for the single diagnostic socket to become writable.
    // WHY: Queued observations must remain bounded while connection setup or recovery is active.
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(queue.splice(0, maxBatchRecords)));
    // WHAT: Continue draining when the bounded queue contains another batch.
    // WHY: One flush cycle deliberately caps frame size without stranding later records.
    if (queue.length > 0) scheduleFlush();
  }, flushDelayMs);
}

function connect(): void {
  // WHAT: Maintain one browser telemetry socket only while diagnostics are enabled.
  // WHY: Duplicate sockets would duplicate every global trace and defeat bounded ingestion.
  if (!enabled || socket || typeof WebSocket === 'undefined') return;
  const url = new URL(endpoint, globalThis.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const active = new WebSocket(url);
  socket = active;
  active.addEventListener('open', () => {
    // WHAT: Reset reconnect pressure after a confirmed socket opening.
    // WHY: A recovered local server should return immediately to the minimum retry delay.
    if (socket !== active) return;
    reconnectAttempt = 0;
    scheduleFlush();
  });
  active.addEventListener('close', () => {
    // WHAT: Reconnect only the currently owned socket after bounded exponential delay.
    // WHY: Replaced sockets must not create competing retry loops.
    if (socket !== active) return;
    socket = null;
    const delay = Math.min(30_000, 1_000 * (2 ** reconnectAttempt));
    reconnectAttempt += 1;
    reconnectTimer = globalThis.setTimeout(() => { reconnectTimer = null; connect(); }, delay + Math.floor(Math.random() * 250));
  });
  active.addEventListener('error', () => active.close());
}

export function enqueueFrontendTelemetry(trace: FrontendTelemetryTrace): void {
  // WHAT: Ignore global traces until the server explicitly enables browser telemetry.
  // WHY: Diagnostics remain opt-in and impose no storage or transport cost by default.
  if (!enabled) return;
  queue.push({
    ...trace,
    args: sanitize(trace.args),
    browserSessionId: sessionId,
    route: `${globalThis.location.pathname}${globalThis.location.search}`,
  });
  // WHAT: Evict the oldest unsent observation after reaching the browser queue budget.
  // WHY: A disconnected server must not allow telemetry to consume unbounded tab memory.
  if (queue.length > maxQueuedRecords) queue.shift();
  scheduleFlush();
}

export async function installFrontendTelemetryWebSocket(): Promise<void> {
  // WHAT: Resolve telemetry configuration once for the lifetime of this browser module.
  // WHY: Repeated surface renders must not create configuration polling or duplicate sockets.
  if (installed) return;
  installed = true;
  try {
    const response = await fetch('/api/diagnostics/frontend-telemetry-config', { cache: 'no-store' });
    const config = await response.json() as { enabled?: boolean; endpoint?: string };
    // WHAT: Keep telemetry disabled unless the server confirms the exact opt-in and endpoint.
    // WHY: Missing, invalid, and failed configuration reads must degrade without application impact.
    if (!response.ok || config.enabled !== true || typeof config.endpoint !== 'string') return;
    enabled = true;
    endpoint = config.endpoint;
    connect();
  } catch {
    // WHAT: Contain configuration failure inside the optional diagnostics scope.
    // WHY: Telemetry availability must never affect application boot or user operations.
  }
}

export function closeFrontendTelemetryWebSocket(): void {
  enabled = false;
  if (flushTimer) globalThis.clearTimeout(flushTimer);
  if (reconnectTimer) globalThis.clearTimeout(reconnectTimer);
  flushTimer = null;
  reconnectTimer = null;
  socket?.close(1000, 'frontend_closed');
  socket = null;
}
