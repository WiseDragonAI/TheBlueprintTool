/**
 * WHAT: Reads named server-owned pipeline prompts and renders them as ordered Markdown documents.
 * WHY: execution prompts must inspect the exact live prompt bytes without locating server storage.
 */
import type { Result } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;

const requestDeadlineMs = 10_000;
const maximumPromptQueries = 30;

function record(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function serverUrl(): Result<string> {
  const value = text(process.env.DECISION_OS_SERVER_URL).trim().replace(/\/$/, '');
  return value
    ? { ok: true, value }
    : { ok: false, error: 'prompt query requires DECISION_OS_SERVER_URL.' };
}

async function readPrompt(server: string, name: string): Promise<Result<string>> {
  const url = `${server}/api/codex/server-skills/${encodeURIComponent(name)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestDeadlineMs) });
    // WHAT: reject a failed prompt read before the batch produces any output.
    // WHY: a partial prompt set cannot be used as complete execution context.
    if (!response.ok) return { ok: false, error: `Prompt query failed (${response.status}) for ${name}: ${await response.text()}` };
    const payload: unknown = await response.json();
    // WHAT: accept only a server detail response containing verbatim Markdown.
    // WHY: metadata alone cannot satisfy the prompt-query output contract.
    if (!record(payload) || !record(payload.skill) || typeof payload.skill.markdown !== 'string') {
      return { ok: false, error: `Prompt query returned invalid content for ${name}.` };
    }
    return { ok: true, value: payload.skill.markdown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Prompt query failed for ${name}.` };
  }
}

export async function queryPipelinePrompts(input: {
  action?: 'query';
  names: string[];
}): Promise<Result<string>> {
  const names = input.names.map((name) => text(name).trim()).filter(Boolean);
  // WHAT: require one concrete prompt identity.
  // WHY: an unbounded catalog dump is not part of the command contract.
  if (names.length === 0) return { ok: false, error: 'prompt query requires --name.' };
  // WHAT: bound a chained prompt query to the established CLI batch limit.
  // WHY: prompt retrieval must retain a finite network and output boundary.
  if (names.length > maximumPromptQueries) {
    return { ok: false, error: `prompt query accepts at most ${maximumPromptQueries} --name values.` };
  }
  const server = serverUrl();
  // WHAT: stop before remote reads when no live Decision OS server is configured.
  // WHY: prompt ownership is server-scoped and cannot be inferred from the caller directory.
  if (!server.ok) return server;
  const prompts = await Promise.all(names.map((name) => readPrompt(server.value, name)));
  const documents: string[] = [];
  for (let index = 0; index < prompts.length; index += 1) {
    const prompt = prompts[index];
    // WHAT: withhold every document when a requested prompt cannot be read.
    // WHY: callers must not mistake partial stdout for a complete prompt chain.
    if (!prompt.ok) return prompt;
    documents.push(['---', `# ${names[index]}`, prompt.value].join('\n'));
  }
  return { ok: true, value: documents.join('\n') };
}
