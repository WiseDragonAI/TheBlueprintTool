/**
 * WHAT: Generated telemetry harness.
 * WHY: generated files need shared observable execution evidence.
 */
export type GeneratedTrace = { name: string; args: unknown; at: string; rawStack: string };
export const traces: GeneratedTrace[] = [];
export function telemetry(name: string, args: unknown = {}) {
  const error = new Error();
  Error.captureStackTrace(error, telemetry);
  const trace = { name, args, at: new Date().toISOString(), rawStack: error.stack ?? '' };
  traces.push(trace);
  console.log(JSON.stringify({ telemetry: trace }));
}
