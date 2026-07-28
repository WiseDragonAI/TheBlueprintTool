/**
 * WHAT: Merges repository defaults and workspace .decision-os settings into backend runtime state.
 * WHY: Catalog projects need app-owned defaults while retaining explicit workspace overrides.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from './resolve-decision-os-root.js';
import { readActiveNodeRelease } from '../../delivery/helper/node-release-store.js';

type AnyRecord = Record<string, unknown>;

export type DecisionOsReleaseHealthIdentity = {
  releaseSha: string;
  processStartedAt: string;
  deliveryProtocol: number;
  activeReleasePointer: string;
};

const fallbackProcessStartedAt = new Date().toISOString();

export function decisionOsReleaseHealthIdentity(settingsInput: unknown = {}): DecisionOsReleaseHealthIdentity {
  const settings = settingsInput && typeof settingsInput === 'object' ? settingsInput as AnyRecord : {};
  const deliveryProtocol = Number(process.env.DECISION_OS_DELIVERY_PROTOCOL ?? settings.deliveryProtocol ?? 0);
  const configuredRoot = String(settings.deliveryReleaseRoot ?? '').trim();
  let pointerReleaseSha = '';
  if (deliveryProtocol === 1 && configuredRoot && isAbsolute(configuredRoot)) {
    try {
      pointerReleaseSha = readActiveNodeRelease({
        releaseRoot: configuredRoot,
        currentPointer: String(settings.deliveryCurrentPointer ?? '') || undefined,
      }).releaseSha;
    } catch {
      pointerReleaseSha = '';
    }
  }
  const environmentSha = String(process.env.DECISION_OS_RELEASE_SHA ?? '').trim();
  const environmentPointer = String(process.env.DECISION_OS_ACTIVE_RELEASE_POINTER ?? '').trim();
  const launcherOwnedSha = /^[a-f0-9]{40}$/.test(environmentSha)
    && environmentPointer === `current:${environmentSha}`
    ? environmentSha
    : '';
  const releaseSha = pointerReleaseSha || launcherOwnedSha;
  const startedAt = String(process.env.DECISION_OS_PROCESS_STARTED_AT ?? fallbackProcessStartedAt);
  return {
    releaseSha,
    processStartedAt: Number.isFinite(Date.parse(startedAt)) ? startedAt : fallbackProcessStartedAt,
    deliveryProtocol: deliveryProtocol === 1 ? 1 : 0,
    activeReleasePointer: pointerReleaseSha
      ? `current:${pointerReleaseSha}`
      : launcherOwnedSha ? `current:${launcherOwnedSha}` : 'unbootstrapped',
  };
}

export function readDecisionOsSettings(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('read-decision-os-settings', { role: 'helper', action: 'read-decision-os-settings' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolveDecisionOsRoot({ action_payload: payload, runtime_state: runtime });
  const settingsFile = resolve(decisionOsRoot, '.settings.json');
  const repositorySettingsFile = resolve(String(
    payload.repositorySettingsFile
    ?? process.env.DECISION_OS_REPOSITORY_SETTINGS_FILE
    ?? runtime.repositorySettingsFile
    ?? settingsFile
  ));
  const repositorySettings = existsSync(repositorySettingsFile) ? JSON.parse(readFileSync(repositorySettingsFile, 'utf8')) as AnyRecord : {};
  // WHAT: Avoid loading the same file twice when the repository itself is the active workspace.
  // WHY: One parsed source preserves the same override semantics without redundant file IO.
  const workspaceSettings = settingsFile === repositorySettingsFile
    ? {}
    : existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) as AnyRecord : {};
  const raw = { ...repositorySettings, ...workspaceSettings };
  const settings: AnyRecord = { ...raw };
  settings.decisionOsFrontendRoot = raw.decisionOsFrontendRoot ?? raw.frontendRoot ?? raw.DECISION_OS_FRONTEND_ROOT;
  if (settings.decisionOsFrontendRoot) {
    const frontendRoot = String(settings.decisionOsFrontendRoot);
    settings.decisionOsFrontendRoot = isAbsolute(frontendRoot) ? resolve(frontendRoot) : resolve(decisionOsRoot, '..', frontendRoot);
  }
  settings.openaiApiKey = raw.openaiApiKey ?? raw.OPENAI_API_KEY;
  settings.transcriptionModel = raw.transcriptionModel ?? raw.OPENAI_TRANSCRIPTION_MODEL;
  if (raw.deliveryProtocol !== undefined) {
    if (raw.deliveryProtocol !== 1) throw new Error('Unsupported Decision OS delivery protocol.');
    for (const key of ['deliveryRepositoryRoot', 'deliveryReleaseRoot', 'deliveryCurrentPointer', 'deliveryDecisionOsRoot']) {
      const value = String(raw[key] ?? '');
      if (!value || !isAbsolute(value)) throw new Error(`${key} must be an absolute path.`);
      settings[key] = resolve(value);
    }
    for (const key of ['deliveryNodeId', 'deliverySupervisorProfile']) {
      if (typeof raw[key] !== 'string' || !raw[key]) throw new Error(`${key} is required for delivery protocol 1.`);
    }
    for (const key of ['deliverySupervisorAdopted', 'deliverySupervisedExit', 'deliveryEmergencyHealth']) {
      if (raw[key] !== true) throw new Error(`${key} must be true for delivery protocol 1.`);
    }
    if (typeof raw.deliveryLocalDispatchToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw.deliveryLocalDispatchToken)) {
      throw new Error('deliveryLocalDispatchToken must be a 32-byte base64url capability.');
    }
  }
  runtime.decisionOsRoot = decisionOsRoot;
  runtime.repositorySettingsFile = repositorySettingsFile;
  runtime.decisionOsSettings = settings;
  runtime.releaseIdentity = decisionOsReleaseHealthIdentity(settings);
  if (settings.decisionOsFrontendRoot) runtime.decisionOsFrontendRoot = String(settings.decisionOsFrontendRoot);
  if (settings.openaiApiKey) runtime.openaiApiKey = String(settings.openaiApiKey);
  if (settings.transcriptionModel) runtime.transcriptionModel = String(settings.transcriptionModel);
  if (typeof settings.transcriptionEnabled === 'boolean') runtime.transcriptionEnabled = settings.transcriptionEnabled;
  return { ok: true, decisionOsRoot, settingsFile, repositorySettingsFile, settings };
}
