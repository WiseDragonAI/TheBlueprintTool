/**
 * WHAT: Generated telemetry harness.
 * WHY: generated files need shared observable execution evidence.
 */
export const traces: Array<{ name: string; args: unknown; at: string }> = [];
export function telemetry(name: string, args: unknown = {}) {
  const trace = { name, args, at: new Date().toISOString() };
  traces.push(trace);
  console.log(JSON.stringify({ telemetry: trace }));
}
