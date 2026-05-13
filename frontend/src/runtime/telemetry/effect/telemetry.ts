import { state } from '../../state.js';
import { snapshotArgs } from '../../persistence/helper/snapshot-args.js';

export function telemetry(name: string, args: unknown = {}): void {
  const trace = { name, args: snapshotArgs(args), at: new Date().toISOString() };
  const liveTelemetry = ((window as any).__coreTelemetry ??= []);
  liveTelemetry.push(trace);
  if (liveTelemetry.length > 500) liveTelemetry.shift();
  state.telemetry.push(trace);
  window.dispatchEvent(new CustomEvent('core:telemetry', { detail: trace }));
  if (state.telemetry.length > 80) state.telemetry.shift();
}
