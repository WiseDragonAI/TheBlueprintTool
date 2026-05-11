/**
 * WHAT: Implements the resolve-tool-mode helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveToolMode(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-tool-mode', { role: 'helper', action: 'resolve-tool-mode' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const mode = String(payload.toolMode ?? payload.mode ?? runtime.toolMode ?? 'select');
  return { ok: mode.length > 0, mode, isZoneTool: mode === 'zone', isGroupTool: mode === 'group', isSelectionTool: mode === 'select' };
}

