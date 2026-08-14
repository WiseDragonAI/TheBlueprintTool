/**
 * WHAT: Compiles registered prompt graphs and renders typed runtime tokens for pipeline skills and direct Codex runs.
 * WHY: SYSTEM_PROMPT, SKILL, and CODEX_RUN must share one single-pass template authority without entering skill discovery.
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
const runtimeToken = /<([A-Z][A-Z0-9_]*)>/g;
export const pipelinePromptSyntaxVersion = 2 as const;
export const pipelinePromptRuntimeTokenNames = [
  'PLATFORM',
  'SKILL_NAME',
  'PIPELINE_RUN_ID',
  'PIPELINE_NAME',
  'LEDGER_FILE',
  'SOURCE_CARD_ID',
  'SOURCE_CARD_TITLE',
  'STEP_ID',
  'STEP_TITLE',
  'STEP_INPUT_CARD_ID',
  'STEP_INPUT_CARD_CONTENT',
  'OUTPUT_PARENT_CARD_ID',
  'OUTPUT_CARD_ID',
  'OUTPUT_SUBTASK_POSITION',
  'OUTPUT_MARKDOWN_FILE',
  'SERVER_SKILL_CONTEXT',
  'MASTER_TASK',
  'SUB_CONTEXT',
  'SUB_TASKS',
  'FULL_THREAD',
  'PENDING_NOTES',
  'FILE_MAP',
  'PREVIOUS_SKILL_RESULT',
  'EXECUTION_CONTEXT',
  'PROJECT_ID',
  'CARD_ID',
  'THREAD_ID',
  'RUN_SKILL_POLICY',
  'PROTECTED_GIT_PATCH',
] as const;
export type PipelinePromptRuntimeToken = typeof pipelinePromptRuntimeTokenNames[number];
export type PipelinePromptRuntimeProvider = () => string;
export type PipelinePromptRuntimeContext = {
  readonly [Token in PipelinePromptRuntimeToken]: PipelinePromptRuntimeProvider;
};
const pipelinePromptRuntimeTokenSet = new Set<string>(pipelinePromptRuntimeTokenNames);

/**
 * Version-1 prompts used double braces for both prompt references and runtime data.
 * Keep this set only for persisted runs without a syntaxVersion discriminator.
 */
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

export function pipelinePromptRuntimeTokens(markdown: string): PipelinePromptRuntimeToken[] {
  const names = [...new Set([...markdown.matchAll(runtimeToken)].map((match) => match[1]))];
  const unknown = names.find((name) => !pipelinePromptRuntimeTokenSet.has(name));
  if (unknown) throw new Error(`Unknown pipeline prompt runtime token <${unknown}>.`);
  return names as PipelinePromptRuntimeToken[];
}

export function createPipelinePromptRuntimeContext(
  providers: { readonly [Token in PipelinePromptRuntimeToken]: PipelinePromptRuntimeProvider },
): PipelinePromptRuntimeContext {
  const values = new Map<PipelinePromptRuntimeToken, string>();
  return Object.fromEntries(pipelinePromptRuntimeTokenNames.map((name) => [
    name,
    () => {
      if (!values.has(name)) values.set(name, String(providers[name]()));
      return values.get(name)!;
    },
  ])) as PipelinePromptRuntimeContext;
}

export function compilePipelinePromptGraph(input: {
  roots: readonly string[];
  resolve: (name: string) => string | null;
}): { developerPromptSnapshot: string; dependencies: string[] } {
  const dependencies: string[] = [];
  const expanded = new Map<string, string>();
  const compile = (name: string, stack: readonly string[]): string => {
    if (stack.includes(name)) throw new Error(`Pipeline prompt template cycle: ${[...stack, name].join(' -> ')}.`);
    const cached = expanded.get(name);
    if (cached !== undefined) return cached;
    const markdown = input.resolve(name);
    if (markdown === null) throw new Error(`Pipeline prompt template "${name}" was not found.`);
    dependencies.push(name);
    const compiled = markdown.replace(promptVariable, (_token, referenceName: string) =>
      compile(referenceName, [...stack, name]));
    expanded.set(name, compiled);
    return compiled;
  };
  const developerPromptSnapshot = input.roots.map((name) => compile(name, [])).join('\n\n');
  if (Buffer.byteLength(developerPromptSnapshot, 'utf8') > maximumPromptBytes) {
    throw new Error('Compiled pipeline developer prompt exceeds the 1,000,000 byte limit.');
  }
  return { developerPromptSnapshot, dependencies };
}

export function renderPipelineDeveloperPrompt(
  developerPromptSnapshot: string,
  context: PipelinePromptRuntimeContext,
): string {
  const required = pipelinePromptRuntimeTokens(developerPromptSnapshot);
  const values = new Map(required.map((name) => [name, context[name]()]));
  return developerPromptSnapshot.replace(runtimeToken, (_token, name: PipelinePromptRuntimeToken) => values.get(name)!);
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
