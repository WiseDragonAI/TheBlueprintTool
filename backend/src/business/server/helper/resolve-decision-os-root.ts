/**
 * WHAT: Resolves the active .decision-os directory from any backend launch cwd.
 * WHY: External workspaces start decision-os from project roots outside the decision-os repo.
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveDecisionOsRoot(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): string {
  telemetry('resolve-decision-os-root', { role: 'helper', action: 'resolve-decision-os-root' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const configuredRoot = String(payload.decisionOsRoot ?? runtime.decisionOsRoot ?? process.env.DECISION_OS_ROOT ?? '');
  if (configuredRoot) return resolve(configuredRoot);
  const launchCwd = resolve(String(payload.cwd ?? runtime.cwd ?? process.cwd()));
  let current = launchCwd;
  const systemTemporaryRoot = resolve(tmpdir());
  while (true) {
    // WHAT: Treat the operating-system temp root as a workspace boundary.
    // WHY: Test and preview workspaces below /tmp must not inherit another run's /tmp/.decision-os state.
    if (current === systemTemporaryRoot) break;
    const candidate = resolve(current, '.decision-os');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const fallback = String(payload.decisionOsDirectory ?? '.decision-os');
  return isAbsolute(fallback) ? fallback : resolve(launchCwd, fallback);
}
