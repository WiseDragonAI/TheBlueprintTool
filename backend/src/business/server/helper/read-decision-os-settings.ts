/**
 * WHAT: Merges repository defaults and workspace .decision-os settings into backend runtime state.
 * WHY: Catalog projects need app-owned defaults while retaining explicit workspace overrides.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from './resolve-decision-os-root.js';

type AnyRecord = Record<string, unknown>;

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
  runtime.decisionOsRoot = decisionOsRoot;
  runtime.repositorySettingsFile = repositorySettingsFile;
  runtime.decisionOsSettings = settings;
  if (settings.decisionOsFrontendRoot) runtime.decisionOsFrontendRoot = String(settings.decisionOsFrontendRoot);
  if (settings.openaiApiKey) runtime.openaiApiKey = String(settings.openaiApiKey);
  if (settings.transcriptionModel) runtime.transcriptionModel = String(settings.transcriptionModel);
  if (typeof settings.transcriptionEnabled === 'boolean') runtime.transcriptionEnabled = settings.transcriptionEnabled;
  return { ok: true, decisionOsRoot, settingsFile, repositorySettingsFile, settings };
}
