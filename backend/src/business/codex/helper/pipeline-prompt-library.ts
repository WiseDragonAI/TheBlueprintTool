/**
 * WHAT: Stores pipeline-only prompts outside every Codex skill discovery root.
 * WHY: Pipeline prompts must be explicit injections, never naturally visible agent skills.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { atomicCreateTextFile, atomicReplaceTextFile } from './skill-content-file.js';
import { skillRevision, type CodexSkillSummary } from './scan-codex-skills.js';
import { assertCodexPipelineStoreAvailable, readCodexPipelineStore } from './codex-pipeline-store.js';
import type { CodexAuthoredContentRecord } from '../../../../../shared/schemas/codex-pipeline-types.js';

const maximumPromptBytes = 1_000_000;
const safePromptName = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/;
const promptVariable = /\{\{\s*([A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?)\s*\}\}/g;
export const pipelinePromptRuntimeVariables = new Set([
  'MASTER_TASK',
  'SUB_CONTEXT',
  'FULL_THREAD',
  'FILE_MAP',
  'PREVIOUS_SKILL_RESULT',
  'EXECUTION_CONTEXT',
]);

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

export function pipelinePromptRoot(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'pipeline-prompts');
}

export function assertPipelinePromptName(name: string): string {
  const normalized = name.trim();
  if (!safePromptName.test(normalized)) {
    throw new Error('Names must contain 1-64 letters, numbers, underscores, or hyphens and cannot end with an underscore or hyphen.');
  }
  return normalized;
}

export function pipelinePromptTemplateVariables(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(promptVariable)].map((match) => match[1]))];
}

export function expandPipelinePromptTemplates(input: {
  markdown: string;
  resolve: (name: string) => string | null;
  stack?: readonly string[];
}): string {
  const stack = [...(input.stack ?? [])];
  return input.markdown.replace(promptVariable, (token, name: string) => {
    if (pipelinePromptRuntimeVariables.has(name)) return token;
    if (stack.includes(name)) throw new Error(`Pipeline prompt template cycle: ${[...stack, name].join(' -> ')}.`);
    const template = input.resolve(name);
    if (template === null) throw new Error(`Pipeline prompt template "${name}" was not found.`);
    return expandPipelinePromptTemplates({
      markdown: template,
      resolve: input.resolve,
      stack: [...stack, name],
    });
  });
}

export function renderPipelinePromptRuntimeVariables(
  markdown: string,
  values: Readonly<Record<string, string>>,
): string {
  return markdown.replace(promptVariable, (_token, name: string) => {
    if (!pipelinePromptRuntimeVariables.has(name)) {
      throw new Error(`Pipeline prompt template "${name}" was not resolved at admission.`);
    }
    return values[name] ?? '';
  });
}

export function validatePipelinePromptTemplates(input: {
  decisionOsRoot: string;
  name: string;
  markdown: string;
}): { ok: true } | { ok: false; error: string } {
  try {
    expandPipelinePromptTemplates({
      markdown: input.markdown,
      stack: [input.name],
      resolve: (name) => name === input.name
        ? input.markdown
        : readPipelinePrompt(input.decisionOsRoot, name)?.markdown ?? null,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function pipelinePromptFile(decisionOsRoot: string, name: string): string {
  return resolve(pipelinePromptRoot(decisionOsRoot), `${assertPipelinePromptName(name)}.md`);
}

function registeredPrompts(decisionOsRoot: string): Map<string, Extract<CodexAuthoredContentRecord, { kind: 'pipeline-prompt' }>> {
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  return new Map(normalized.store.authoredContent.flatMap((record) =>
    record.kind === 'pipeline-prompt' ? [[record.id, record] as const] : []));
}

function verifiedPromptFile(decisionOsRoot: string, name: string): string {
  const root = pipelinePromptRoot(decisionOsRoot);
  const file = pipelinePromptFile(decisionOsRoot, name);
  if (!existsSync(root) || !existsSync(file)) throw new Error('Pipeline prompt not found.');
  if (lstatSync(file).isSymbolicLink()) throw new Error('Symlinked pipeline prompts cannot be edited.');
  const canonicalRoot = realpathSync(root);
  const canonicalFile = realpathSync(file);
  if (!isInside(canonicalRoot, canonicalFile)) throw new Error('Pipeline prompt resolves outside pipeline-owned storage.');
  return canonicalFile;
}

function validUtf8Text(file: string): string | null {
  try {
    const bytes = readFileSync(file);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function summary(
  decisionOsRoot: string,
  file: string,
  record: Extract<CodexAuthoredContentRecord, { kind: 'pipeline-prompt' }>,
): CodexSkillSummary | null {
  try {
    if (lstatSync(file).isSymbolicLink() || !statSync(file).isFile() || statSync(file).size > maximumPromptBytes) return null;
    const markdown = validUtf8Text(file);
    if (markdown === null || !markdown.trim() || pipelinePromptFile(decisionOsRoot, record.id) !== resolve(file)) return null;
    return {
      name: record.id,
      description: record.description,
      source: 'pipeline-prompt',
      editable: true,
      readOnlyReason: null,
      revision: skillRevision(markdown),
      skillFile: resolve(file),
    };
  } catch {
    return null;
  }
}

export function scanPipelinePrompts(decisionOsRoot: string): CodexSkillSummary[] {
  const root = pipelinePromptRoot(decisionOsRoot);
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) return [];
  const registered = registeredPrompts(decisionOsRoot);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && registered.has(entry.name.slice(0, -3)))
    .slice(0, 512)
    .flatMap((entry) => {
      const record = registered.get(entry.name.slice(0, -3));
      const prompt = record ? summary(decisionOsRoot, resolve(root, entry.name), record) : null;
      return prompt ? [prompt] : [];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function readPipelinePrompt(decisionOsRoot: string, name: string): { skill: CodexSkillSummary; markdown: string } | null {
  const record = registeredPrompts(decisionOsRoot).get(name);
  if (!record) return null;
  const file = pipelinePromptFile(decisionOsRoot, name);
  const skill = summary(decisionOsRoot, file, record);
  const markdown = validUtf8Text(file);
  return skill && markdown !== null ? { skill, markdown } : null;
}

export function validatePipelinePromptMarkdown(markdown: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof markdown !== 'string') return { ok: false, error: 'Pipeline prompt Markdown must be a string.' };
  if (!markdown.trim()) return { ok: false, error: 'Pipeline prompt Markdown cannot be empty.' };
  if (Buffer.byteLength(markdown, 'utf8') > maximumPromptBytes) {
    return { ok: false, error: 'Pipeline prompt Markdown exceeds the 1,000,000 byte limit.' };
  }
  if (Buffer.from(markdown, 'utf8').toString('utf8') !== markdown) {
    return { ok: false, error: 'Pipeline prompt Markdown must be valid UTF-8.' };
  }
  return { ok: true };
}

export function createPipelinePrompt(input: {
  decisionOsRoot: string;
  name: string;
  description: string;
  markdown: string;
}): CodexSkillSummary {
  const validation = validatePipelinePromptMarkdown(input.markdown);
  if (!validation.ok) throw new Error('error' in validation ? validation.error : 'Invalid pipeline prompt Markdown.');
  const file = pipelinePromptFile(input.decisionOsRoot, input.name);
  const decisionOsRoot = resolve(input.decisionOsRoot);
  mkdirSync(decisionOsRoot, { recursive: true });
  if (lstatSync(decisionOsRoot).isSymbolicLink()) throw new Error('Pipeline-owned storage cannot be a symlink.');
  const root = pipelinePromptRoot(decisionOsRoot);
  if (existsSync(root) && lstatSync(root).isSymbolicLink()) throw new Error('Pipeline prompt storage cannot be a symlink.');
  mkdirSync(root, { recursive: true });
  if (!isInside(realpathSync(decisionOsRoot), realpathSync(root))) {
    throw new Error('Pipeline prompt storage resolves outside the owning Decision OS directory.');
  }
  atomicCreateTextFile(file, input.markdown);
  const created = summary(input.decisionOsRoot, file, {
    id: input.name,
    kind: 'pipeline-prompt',
    description: input.description,
    contentFile: `pipeline-prompts/${input.name}.md`,
    createdAt: '',
    updatedAt: '',
  });
  if (!created) throw new Error('The created pipeline prompt could not be reloaded.');
  return created;
}

export function writePipelinePrompt(input: {
  decisionOsRoot: string;
  name: string;
  markdown: string;
  expectedRevision: string;
}): { file: string; priorMarkdown: string; revision: string } {
  const validation = validatePipelinePromptMarkdown(input.markdown);
  if (!validation.ok) throw new Error('error' in validation ? validation.error : 'Invalid pipeline prompt Markdown.');
  const file = verifiedPromptFile(input.decisionOsRoot, input.name);
  const priorMarkdown = readFileSync(file, 'utf8');
  const currentRevision = skillRevision(priorMarkdown);
  if (currentRevision !== input.expectedRevision) {
    const error = new Error('The pipeline prompt changed after it was loaded. Reload it and apply the edit again.');
    Object.assign(error, { code: 'revision_conflict', currentRevision });
    throw error;
  }
  atomicReplaceTextFile(file, input.markdown);
  return { file, priorMarkdown, revision: skillRevision(input.markdown) };
}
