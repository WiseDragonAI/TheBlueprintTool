/**
 * WHAT: Implements the calculate-zone-geometry helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function calculateZoneGeometry(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('calculate-zone-geometry', { role: 'helper', action: 'calculate-zone-geometry' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const geometry = (payload.geometry && typeof payload.geometry === 'object' ? payload.geometry : payload) as AnyRecord;
  const width = Math.max(1, Number(geometry.width ?? 320));
  const height = Math.max(1, Number(geometry.height ?? 180));
  return { ok: true, geometry: { x: Number(geometry.x ?? 0), y: Number(geometry.y ?? 0), width, height } };
}

