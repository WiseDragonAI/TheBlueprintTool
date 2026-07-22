/**
 * WHAT: Generated telemetry harness.
 * WHY: generated files need shared observable execution evidence.
 */
export type GeneratedTrace = { name: string; args: unknown; at: string };
export const traces: GeneratedTrace[] = [];
const traceRetentionLimit = 2_000;
export function telemetry(name: string, args: unknown = {}) {
  const trace = { name, args, at: new Date().toISOString() };
  traces.push(trace);
  if (traces.length > traceRetentionLimit) traces.splice(0, traces.length - traceRetentionLimit);
  if (process.env.DECISION_OS_TELEMETRY_STDOUT !== '1') return;
  try { console.log(JSON.stringify({ telemetry: trace })); }
  catch { /* Telemetry transport failure must not change application control flow. */ }
}
