import { state } from '../../state.js';
import { snapshotArgs } from '../../persistence/helper/snapshot-args.js';
import { enqueueFrontendTelemetry } from './frontend-telemetry-websocket.js';

export function telemetry(name: string, args: unknown = {}): void {
  const error = new Error();
  Error.captureStackTrace(error, telemetry);
  const trace = { name, args: snapshotArgs(args), at: new Date().toISOString(), rawStack: error.stack ?? '' };
  state.telemetry.push(trace);
  // WHAT: Mirror and transmit telemetry only when this runtime owns a browser window.
  // WHY: Shared runtime effects execute in Node tests where the in-process telemetry ledger remains valid but DOM globals do not exist.
  if (typeof window !== 'undefined') {
    const liveTelemetry = ((window as any).__coreTelemetry ??= []);
    liveTelemetry.push(trace);
    // WHAT: Evict the oldest browser trace after reaching the live inspection budget.
    // WHY: Long-lived tabs must not retain an unbounded diagnostic history.
    if (liveTelemetry.length > 500) liveTelemetry.shift();
    window.dispatchEvent(new CustomEvent('core:telemetry', { detail: trace }));
    enqueueFrontendTelemetry(trace);
  }
  // WHAT: Evict the oldest in-process trace after reaching the application telemetry budget.
  // WHY: Browser and non-browser runtimes both require bounded diagnostic memory.
  if (state.telemetry.length > 80) state.telemetry.shift();
}
