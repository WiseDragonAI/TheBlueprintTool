/**
 * WHAT: Resolves the active .blueprinttool directory from any backend launch cwd.
 * WHY: Ardaria workspaces start CoreV2 from project roots outside the CoreV2 repo.
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveBlueprinttoolRoot(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): string {
  telemetry('resolve-blueprinttool-root', { role: 'helper', action: 'resolve-blueprinttool-root' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const configuredRoot = String(payload.blueprinttoolRoot ?? runtime.blueprinttoolRoot ?? process.env.BLUEPRINTTOOL_ROOT ?? '');
  if (configuredRoot) return resolve(configuredRoot);
  let current = resolve(String(payload.cwd ?? runtime.cwd ?? process.cwd()));
  while (true) {
    const candidate = resolve(current, '.blueprinttool');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const fallback = String(payload.blueprinttoolDirectory ?? '.blueprinttool');
  return isAbsolute(fallback) ? fallback : resolve(process.cwd(), fallback);
}
