/**
 * WHAT: Persists the project-scoped Codex process limit without rewriting unrelated settings.
 * WHY: Operators need to change scheduler capacity from the UI while secrets and other workspace settings remain intact.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDecisionOsSettings } from './read-decision-os-settings.js';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export const minimumConcurrentCodexProcesses = 1;
export const maximumConcurrentCodexProcesses = 32;

export function normalizedConcurrentCodexProcesses(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < minimumConcurrentCodexProcesses || parsed > maximumConcurrentCodexProcesses) return null;
  return parsed;
}

export function saveCodexProcessSettings(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  maxConcurrentCodexProcesses: unknown;
  voicePipelineId?: unknown;
  masterTaskCompletionPipelineId?: unknown;
  availableVoicePipelineIds?: readonly string[];
  availableMasterTaskCompletionPipelineIds?: readonly string[];
}): AnyRecord {
  const value = normalizedConcurrentCodexProcesses(input.maxConcurrentCodexProcesses);
  if (value === null) return {
    ok: false,
    statusCode: 400,
    error: `maxConcurrentCodexProcesses must be an integer from ${minimumConcurrentCodexProcesses} to ${maximumConcurrentCodexProcesses}.`,
  };
  const settingsFile = resolve(input.decisionOsRoot, '.settings.json');
  let settings: AnyRecord = {};
  try {
    const parsed = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) as unknown : {};
    if (!isRecord(parsed)) {
      return { ok: false, statusCode: 409, code: 'invalid_project_settings_root', error: 'Project settings must be a JSON object; the existing file was preserved.' };
    }
    settings = parsed;
  } catch (error) {
    return { ok: false, statusCode: 500, error: `Could not read project settings: ${error instanceof Error ? error.message : String(error)}.` };
  }
  const temporaryFile = resolve(input.decisionOsRoot, `.settings-${process.pid}-${randomUUID()}.tmp`);
  const hasVoicePipelineId = typeof input.voicePipelineId === 'string';
  const voicePipelineId = hasVoicePipelineId ? String(input.voicePipelineId).trim() : String(settings.voicePipelineId ?? '');
  const hasMasterTaskCompletionPipelineId = typeof input.masterTaskCompletionPipelineId === 'string';
  const masterTaskCompletionPipelineId = hasMasterTaskCompletionPipelineId
    ? String(input.masterTaskCompletionPipelineId).trim()
    : String(settings.masterTaskCompletionPipelineId ?? '');
  if (input.availableVoicePipelineIds && voicePipelineId && !input.availableVoicePipelineIds.includes(voicePipelineId)) {
    return { ok: false, statusCode: 400, error: 'voicePipelineId must identify an available pipeline.' };
  }
  if (input.availableMasterTaskCompletionPipelineIds
    && masterTaskCompletionPipelineId
    && !input.availableMasterTaskCompletionPipelineIds.includes(masterTaskCompletionPipelineId)) {
    return { ok: false, statusCode: 400, error: 'masterTaskCompletionPipelineId must identify an available pipeline.' };
  }
  try {
    writeFileSync(temporaryFile, `${JSON.stringify({
      ...settings,
      maxConcurrentCodexProcesses: value,
      ...(hasVoicePipelineId ? { voicePipelineId } : {}),
      ...(hasMasterTaskCompletionPipelineId ? { masterTaskCompletionPipelineId } : {}),
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporaryFile, settingsFile);
    const refreshed = readDecisionOsSettings({ action_payload: { decisionOsRoot: input.decisionOsRoot }, runtime_state: input.runtime });
    return { ok: true, statusCode: 200, maxConcurrentCodexProcesses: value, voicePipelineId, masterTaskCompletionPipelineId, settings: refreshed.settings };
  } catch (error) {
    return { ok: false, statusCode: 500, error: `Could not save project settings: ${error instanceof Error ? error.message : String(error)}.` };
  } finally {
    if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
  }
}
