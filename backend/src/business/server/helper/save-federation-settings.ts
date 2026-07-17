/**
 * WHAT: Validates and persists the server's federation connection without exposing its credential.
 * WHY: Operators need one settings surface for connecting a Decision OS node while unrelated local secrets remain intact.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDecisionOsSettings } from './read-decision-os-settings.js';

type AnyRecord = Record<string, unknown>;
const federationKeys = ['federationRelayUrl', 'federationId', 'federationNodeId', 'federationNodeLabel', 'federationNodeCredential'] as const;

function identifier(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) throw new Error(`${label} may contain only letters, numbers, underscores, and hyphens.`);
  return normalized;
}

function relayUrl(value: unknown): string {
  const normalized = String(value ?? '').trim().replace(/\/$/, '');
  const parsed = new URL(normalized);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Relay URL must use HTTPS.');
  if (parsed.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('Relay URL must use HTTPS.');
  return normalized;
}

export function saveFederationSettings(input: { decisionOsRoot: string; runtime: AnyRecord; value: AnyRecord }): AnyRecord {
  const settingsFile = resolve(input.decisionOsRoot, '.settings.json');
  let current: AnyRecord = {};
  try {
    current = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) as AnyRecord : {};
    if (input.value.enabled === false) {
      for (const key of federationKeys) delete current[key];
    } else {
      const credential = String(input.value.nodeCredential ?? '').trim() || String(current.federationNodeCredential ?? '').trim();
      if (!credential) throw new Error('Node credential is required for the first connection.');
      current = {
        ...current,
        federationRelayUrl: relayUrl(input.value.relayUrl),
        federationId: identifier(input.value.federationId, 'Federation ID'),
        federationNodeId: identifier(input.value.nodeId, 'Node ID'),
        federationNodeLabel: String(input.value.nodeLabel ?? '').trim().slice(0, 120) || identifier(input.value.nodeId, 'Node ID'),
        federationNodeCredential: credential,
      };
    }
  } catch (error) {
    return { ok: false, statusCode: 400, error: error instanceof Error ? error.message : String(error) };
  }
  const temporaryFile = resolve(input.decisionOsRoot, `.settings-${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporaryFile, `${JSON.stringify(current, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporaryFile, settingsFile);
    const refreshed = readDecisionOsSettings({ action_payload: { decisionOsRoot: input.decisionOsRoot }, runtime_state: input.runtime });
    return { ok: true, statusCode: 200, settings: refreshed.settings };
  } catch (error) {
    return { ok: false, statusCode: 500, error: `Could not save federation settings: ${error instanceof Error ? error.message : String(error)}.` };
  }
}
