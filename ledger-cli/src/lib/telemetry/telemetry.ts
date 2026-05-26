/**
 * WHAT: Telemetry recorder used by controllers, helpers, effects, and generated harnesses.
 * WHY: Specs require observable execution evidence without letting telemetry decide behavior.
 */
import type { TelemetryTrace } from '../types.js';

export class TelemetryRecorder {
  readonly traces: TelemetryTrace[] = [];

  event(name: string, args?: unknown) {
    this.traces.push({
      name,
      phase: 'event',
      args,
      at: new Date().toISOString(),
    });
  }

  clear() {
    this.traces.length = 0;
  }
}

export const telemetryRecorder = new TelemetryRecorder();

export function telemetry(name: string, args?: unknown) {
  telemetryRecorder.event(name, args);
}
