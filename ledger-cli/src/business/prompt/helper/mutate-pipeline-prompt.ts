/**
 * WHAT: Creates prompts from source files and commits directly edited registered prompt working copies.
 * WHY: prompt authors need concise revision-safe commands without temporary replacement files or handcrafted HTTP.
 */
import { readFile } from 'node:fs/promises';
import type { Result } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;
type PromptMutation = {
  action?: 'create' | 'query' | 'update';
  description?: string;
  markdownFile?: string;
  name?: string;
};

const requestDeadlineMs = 30_000;

function record(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function configuredServerUrl(): Result<string> {
  const value = text(process.env.DECISION_OS_SERVER_URL).trim().replace(/\/$/, '');
  // WHAT: return the configured server only when it has a concrete value.
  // WHY: prompt ownership cannot be inferred from the caller directory.
  if (value) return { ok: true, value };
  return { ok: false, error: 'prompt mutation requires DECISION_OS_SERVER_URL.' };
}

async function request(input: {
  body?: JsonObject;
  method?: 'GET' | 'POST' | 'PUT';
  url: string;
}): Promise<Result<JsonObject>> {
  try {
    const response = await fetch(input.url, {
      method: input.method ?? 'GET',
      headers: input.body ? { 'content-type': 'application/json' } : undefined,
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: AbortSignal.timeout(requestDeadlineMs),
    });
    const responseText = await response.text();
    // WHAT: return the server rejection with its exact status and body.
    // WHY: revision conflicts and validation failures require actionable evidence.
    if (!response.ok) return { ok: false, error: `Prompt request failed (${response.status}): ${responseText}` };
    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return { ok: false, error: 'Prompt request returned invalid JSON.' };
    }
    // WHAT: accept only an object response from the authored-content API.
    // WHY: mutation receipts require structured prompt and Git evidence.
    if (!record(payload)) return { ok: false, error: 'Prompt request returned invalid content.' };
    return { ok: true, value: payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Prompt request failed.' };
  }
}

function mutationReceipt(payload: JsonObject, operation: 'create' | 'update', name: string): Result<string> {
  const skill = record(payload.skill) ? payload.skill : null;
  const gitRevision = skill && record(skill.gitRevision) ? skill.gitRevision : null;
  const revision = skill ? text(skill.revision) : '';
  const commit = gitRevision ? text(gitRevision.commit) : '';
  // WHAT: reject a success response missing content and Git revisions.
  // WHY: the CLI must prove the authored transaction reached its committed boundary.
  if (!revision || !commit) return { ok: false, error: 'Prompt mutation returned incomplete revision evidence.' };
  return {
    ok: true,
    value: JSON.stringify({ version: 1, operation, name, revision, commit }, null, 2),
  };
}

export async function mutatePipelinePrompt(input: PromptMutation): Promise<Result<string>> {
  // WHAT: admit only the two mutation operations owned by this helper.
  // WHY: prompt query retains its separate batch-read implementation.
  if (input.action !== 'create' && input.action !== 'update') {
    return { ok: false, error: 'prompt mutation requires create or update.' };
  }
  const name = text(input.name).trim();
  const markdownFile = text(input.markdownFile).trim();
  // WHAT: require one stable prompt identity.
  // WHY: authored-content routes cannot mutate an inferred catalog item.
  if (!name) return { ok: false, error: `prompt ${input.action} requires --name.` };
  // WHAT: require one complete Markdown source file only for prompt creation.
  // WHY: creation has no registered working copy to edit directly.
  if (input.action === 'create' && !markdownFile) return { ok: false, error: 'prompt create requires --markdown-file.' };
  // WHAT: reject replacement-file updates after the direct-edit workflow is selected.
  // WHY: update must commit the registered prompt bytes that the author inspected and edited in place.
  if (input.action === 'update' && markdownFile) return { ok: false, error: 'prompt update requires direct editing and does not accept --markdown-file.' };
  const server = configuredServerUrl();
  // WHAT: stop before file and network work when the server is unavailable.
  // WHY: no local fallback owns pipeline-prompt registration.
  if (!server.ok) return server;

  const collectionUrl = `${server.value}/api/codex/skill-library`;
  // WHAT: create a new registered pipeline prompt in one authored transaction.
  // WHY: creation must couple Markdown, registration metadata, and Git evidence.
  if (input.action === 'create') {
    let markdown = '';
    try {
      markdown = await readFile(markdownFile, 'utf8');
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${markdownFile}.` };
    }
    const description = text(input.description).trim();
    // WHAT: require discoverable purpose for a new prompt identity.
    // WHY: the prompt library must not contain unexplained authored content.
    if (!description) return { ok: false, error: 'prompt create requires --description.' };
    const created = await request({
      method: 'POST',
      url: collectionUrl,
      body: { name, description, markdown, contentKind: 'pipeline-prompt' },
    });
    // WHAT: preserve the exact create failure without issuing another request.
    // WHY: authored mutations must not retry implicitly.
    if (!created.ok) return created;
    return mutationReceipt(created.value, 'create', name);
  }

  const itemUrl = `${server.value}/api/codex/server-skills/${encodeURIComponent(name)}`;
  const current = await request({ url: itemUrl });
  // WHAT: stop when the current optimistic revision cannot be loaded.
  // WHY: update must never overwrite unseen prompt bytes.
  if (!current.ok) return current;
  const currentSkill = record(current.value.skill) ? current.value.skill : null;
  const revision = currentSkill ? text(currentSkill.revision) : '';
  // WHAT: require a concrete loaded content revision before replacement.
  // WHY: the API uses this token to reject concurrent edits.
  if (!revision) return { ok: false, error: 'Prompt update could not load the current revision.' };
  const updated = await request({
    method: 'POST',
    url: `${itemUrl}/revisions/commit`,
    body: { revision },
  });
  // WHAT: preserve the exact working-copy commit failure without retrying stale content.
  // WHY: conflicts require a fresh operator-visible invocation after inspecting the direct edit.
  if (!updated.ok) return updated;
  return mutationReceipt(updated.value, 'update', name);
}
