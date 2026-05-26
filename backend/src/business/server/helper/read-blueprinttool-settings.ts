/**
 * WHAT: Reads optional .blueprinttool/.settings.json into backend runtime state.
 * WHY: Workspace-specific server settings must follow the launch cwd, not shell env only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveBlueprinttoolRoot } from './resolve-blueprinttool-root.js';

type AnyRecord = Record<string, unknown>;

export function readBlueprinttoolSettings(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('read-blueprinttool-settings', { role: 'helper', action: 'read-blueprinttool-settings' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const blueprinttoolRoot = resolveBlueprinttoolRoot({ action_payload: payload, runtime_state: runtime });
  const settingsFile = resolve(blueprinttoolRoot, '.settings.json');
  const raw = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) as AnyRecord : {};
  const settings: AnyRecord = { ...raw };
  settings.corev2FrontendRoot = raw.corev2FrontendRoot ?? raw.frontendRoot ?? raw.COREV2_FRONTEND_ROOT;
  if (settings.corev2FrontendRoot) {
    const frontendRoot = String(settings.corev2FrontendRoot);
    settings.corev2FrontendRoot = isAbsolute(frontendRoot) ? resolve(frontendRoot) : resolve(blueprinttoolRoot, '..', frontendRoot);
  }
  settings.openaiApiKey = raw.openaiApiKey ?? raw.OPENAI_API_KEY;
  settings.transcriptionModel = raw.transcriptionModel ?? raw.OPENAI_TRANSCRIPTION_MODEL;
  runtime.blueprinttoolRoot = blueprinttoolRoot;
  runtime.blueprinttoolSettings = settings;
  if (settings.corev2FrontendRoot) runtime.corev2FrontendRoot = String(settings.corev2FrontendRoot);
  if (settings.openaiApiKey) runtime.openaiApiKey = String(settings.openaiApiKey);
  if (settings.transcriptionModel) runtime.transcriptionModel = String(settings.transcriptionModel);
  if (typeof settings.transcriptionEnabled === 'boolean') runtime.transcriptionEnabled = settings.transcriptionEnabled;
  return { ok: true, blueprinttoolRoot, settingsFile, settings };
}
