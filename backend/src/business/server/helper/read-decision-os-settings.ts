/**
 * WHAT: Reads optional .decision-os/.settings.json into backend runtime state.
 * WHY: Workspace-specific server settings must follow the launch cwd, not shell env only.
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
  const raw = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) as AnyRecord : {};
  const settings: AnyRecord = { ...raw };
  settings.decisionOsFrontendRoot = raw.decisionOsFrontendRoot ?? raw.frontendRoot ?? raw.DECISION_OS_FRONTEND_ROOT;
  if (settings.decisionOsFrontendRoot) {
    const frontendRoot = String(settings.decisionOsFrontendRoot);
    settings.decisionOsFrontendRoot = isAbsolute(frontendRoot) ? resolve(frontendRoot) : resolve(decisionOsRoot, '..', frontendRoot);
  }
  settings.openaiApiKey = raw.openaiApiKey ?? raw.OPENAI_API_KEY;
  settings.transcriptionModel = raw.transcriptionModel ?? raw.OPENAI_TRANSCRIPTION_MODEL;
  runtime.decisionOsRoot = decisionOsRoot;
  runtime.decisionOsSettings = settings;
  if (settings.decisionOsFrontendRoot) runtime.decisionOsFrontendRoot = String(settings.decisionOsFrontendRoot);
  if (settings.openaiApiKey) runtime.openaiApiKey = String(settings.openaiApiKey);
  if (settings.transcriptionModel) runtime.transcriptionModel = String(settings.transcriptionModel);
  if (typeof settings.transcriptionEnabled === 'boolean') runtime.transcriptionEnabled = settings.transcriptionEnabled;
  return { ok: true, decisionOsRoot, settingsFile, settings };
}
