/**
 * WHAT: Resolves public skill-library records and safely saves editable SKILL.md content with run defaults.
 * WHY: The client must never choose a filesystem path or partially update Markdown and default settings.
 */
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import type { Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import type { CodexEffort, CodexModel, CodexPipelineStoreNormalization } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from './codex-pipeline-store.js';
import {
  parseSkillFrontmatter,
  scanCodexSkills,
  skillRevision,
  type CodexSkillSource,
  type CodexSkillSummary,
} from './scan-codex-skills.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from './resolve-codex-command.js';
import { runtimeServerRoot } from './server-skill-context.js';
import { codexSkillTags, normalizeCodexSkillTags } from './codex-skill-tags.js';

export { codexSkillTags } from './codex-skill-tags.js';

type AnyRecord = Record<string, unknown>;

export type CodexSkillCatalogEntry = {
  name: string;
  description: string;
  source: CodexSkillSource;
  editable: boolean;
  readOnlyReason: string | null;
  revision: string;
  favorite: boolean;
  tags: string[];
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
  effectiveCodexModel: string;
  effectiveCodexEffort: string;
};

export type CodexSkillLibraryDetail = CodexSkillCatalogEntry & {
  markdown: string;
  references: CodexSkillReference[];
};

export type CodexSkillReference = {
  name: string;
  markdown: string;
};

export type SkillMarkdownValidation = {
  ok: boolean;
  error?: string;
  name?: string;
  description?: string;
};

export type CodexSkillCatalog = {
  skills: CodexSkillCatalogEntry[];
  normalization: CodexPipelineStoreNormalization;
};

type SaveSkillResult =
  | { ok: true; statusCode: 200; skill: CodexSkillLibraryDetail }
  | { ok: false; statusCode: number; error: string; skillName?: string; currentRevision?: string };

class SkillRevisionConflict extends Error {
  currentRevision: string;

  constructor(currentRevision: string) {
    super('The skill changed after it was loaded. Reload it and apply the edit again.');
    this.currentRevision = currentRevision;
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

function codexHome(): string {
  return resolve(process.env.CODEX_HOME || resolve(homedir(), '.codex'));
}

function editableRoot(input: { skill: CodexSkillSummary; workspaceRoot: string }): string | null {
  if (input.skill.source === 'workspace') return resolve(input.workspaceRoot, '.skills');
  if (input.skill.source === 'user') return resolve(codexHome(), 'skills');
  return null;
}

function verifiedEditableFile(input: { skill: CodexSkillSummary; workspaceRoot: string }): string {
  if (!input.skill.editable || input.skill.source === 'system' || input.skill.source === 'plugin') {
    throw new Error(input.skill.readOnlyReason || 'This skill is read-only.');
  }
  const root = editableRoot(input);
  if (!root || !existsSync(root)) throw new Error('The editable skill root does not exist.');
  if (lstatSync(input.skill.skillFile).isSymbolicLink()) throw new Error('Symlinked skill files cannot be edited.');
  const canonicalRoot = realpathSync(root);
  const canonicalFile = realpathSync(input.skill.skillFile);
  const canonicalDirectory = realpathSync(dirname(input.skill.skillFile));
  if (!isInside(canonicalRoot, canonicalFile) || !isInside(canonicalRoot, canonicalDirectory)) {
    throw new Error('The skill file resolves outside its editable root.');
  }
  if (input.skill.source === 'user') {
    const systemRoot = resolve(root, '.system');
    if (existsSync(systemRoot) && isInside(realpathSync(systemRoot), canonicalFile)) {
      throw new Error('System skills are read-only.');
    }
  }
  return canonicalFile;
}

function atomicWriteFile(file: string, content: string): void {
  const mode = statSync(file).mode & 0o777;
  const temporaryFile = resolve(dirname(file), `.${randomUUID()}.skill.tmp`);
  try {
    writeFileSync(temporaryFile, content, { encoding: 'utf8', flag: 'wx', mode });
    chmodSync(temporaryFile, mode);
    renameSync(temporaryFile, file);
  } finally {
    if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
  }
}

export function validateSkillMarkdown(markdown: unknown, expectedName: string): SkillMarkdownValidation {
  if (typeof markdown !== 'string') return { ok: false, error: 'Skill Markdown must be a string.' };
  const parsed = parseSkillFrontmatter(markdown);
  if (!parsed) return { ok: false, error: 'SKILL.md must contain opening and closing YAML frontmatter delimiters and a name.' };
  if (parsed.name !== expectedName) return { ok: false, error: 'The SKILL.md frontmatter name cannot be changed.' };
  if (!parsed.description.trim()) return { ok: false, error: 'The SKILL.md frontmatter description cannot be empty.' };
  if (!parsed.body.trim()) return { ok: false, error: 'SKILL.md must contain a Markdown instruction body.' };
  return { ok: true, name: parsed.name, description: parsed.description };
}

export function writeEditableSkillFile(input: {
  skill: CodexSkillSummary;
  workspaceRoot: string;
  markdown: string;
  expectedRevision: string;
}): { revision: string } {
  const file = verifiedEditableFile(input);
  const currentMarkdown = readFileSync(file, 'utf8');
  const currentRevision = skillRevision(currentMarkdown);
  if (currentRevision !== input.expectedRevision) throw new SkillRevisionConflict(currentRevision);
  atomicWriteFile(file, input.markdown);
  return { revision: skillRevision(input.markdown) };
}

function catalogEntry(input: {
  skill: CodexSkillSummary;
  defaults: Map<string, { favorite: boolean; tags: readonly string[]; defaultCodexModel: CodexModel | null; defaultCodexEffort: CodexEffort | null }>;
  fallbackModel: string;
  fallbackEffort: string;
}): CodexSkillCatalogEntry {
  const defaults = input.defaults.get(input.skill.name);
  const defaultCodexModel = defaults?.defaultCodexModel ?? null;
  const defaultCodexEffort = defaults?.defaultCodexEffort ?? null;
  return {
    name: input.skill.name,
    description: input.skill.description,
    source: input.skill.source,
    editable: input.skill.editable,
    readOnlyReason: input.skill.readOnlyReason,
    revision: input.skill.revision,
    favorite: defaults?.favorite === true,
    tags: defaults?.tags.length ? [...defaults.tags] : [],
    defaultCodexModel,
    defaultCodexEffort,
    effectiveCodexModel: defaultCodexModel || input.fallbackModel,
    effectiveCodexEffort: defaultCodexEffort || input.fallbackEffort,
  };
}

const referenceExtensions = new Set(['.md', '.markdown', '.txt', '.xml', '.json', '.yaml', '.yml', '.csv', '.tsv']);
const maximumReferenceBytes = 1_000_000;

function referenceMarkdown(file: string, extension: string): string | null {
  try {
    const stats = statSync(file);
    if (!stats.isFile() || stats.size > maximumReferenceBytes) return null;
    const content = readFileSync(file, 'utf8');
    if (content.includes('\0')) return null;
    if (extension === '.md' || extension === '.markdown') return content;
    const language = extension.slice(1) || 'text';
    return `\`\`\`${language}\n${content.replace(/\n?$/, '\n')}\`\`\`\n`;
  } catch {
    return null;
  }
}

export function readCodexSkillReferences(skillFile: string): CodexSkillReference[] {
  const referenceRoot = resolve(dirname(skillFile), 'references');
  if (!existsSync(referenceRoot) || lstatSync(referenceRoot).isSymbolicLink()) return [];
  const references: CodexSkillReference[] = [];
  const visit = (directory: string, depth: number): void => {
    if (depth > 8 || references.length >= 256) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      return;
    }
    for (const entry of entries) {
      if (references.length >= 256) break;
      const file = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        visit(file, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name).toLowerCase();
      if (!referenceExtensions.has(extension)) continue;
      const markdown = referenceMarkdown(file, extension);
      if (markdown === null) continue;
      references.push({ name: relative(referenceRoot, file).split('\\').join('/'), markdown });
    }
  };
  visit(referenceRoot, 0);
  return references;
}

function catalogFromSkills(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  workspaceRoot: string;
  skills: CodexSkillSummary[];
}): CodexSkillCatalog {
  const normalization = readCodexPipelineStore({
    decisionOsRoot: input.decisionOsRoot,
    availableSkillNames: input.skills.map((skill) => skill.name),
  });
  const defaults = new Map(normalization.store.skillLibrary.map((entry) => [entry.skillName, entry]));
  const fallback = resolveCodexCommand({ workspaceRoot: input.workspaceRoot, runtime: input.runtime ?? {} });
  return {
    skills: input.skills.map((skill) => catalogEntry({
      skill,
      defaults,
      fallbackModel: fallback.model,
      fallbackEffort: fallback.effort,
    })),
    normalization,
  };
}

export function readCodexSkillCatalog(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
}): CodexSkillCatalog {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = scanCodexSkills({ workspaceRoot, serverRoot: runtimeServerRoot(input.runtime ?? {}) });
  return catalogFromSkills({ ...input, workspaceRoot, skills });
}

export function readCodexSkillLibraryDetail(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
}): CodexSkillLibraryDetail | null {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = scanCodexSkills({ workspaceRoot, serverRoot: runtimeServerRoot(input.runtime ?? {}) });
  const skill = skills.find((candidate) => candidate.name === input.skillName);
  if (!skill) return null;
  const markdown = readFileSync(skill.skillFile, 'utf8');
  const catalog = catalogFromSkills({ ...input, workspaceRoot, skills });
  const entry = catalog.skills.find((candidate) => candidate.name === input.skillName);
  if (!entry) return null;
  return { ...entry, revision: skillRevision(markdown), markdown, references: readCodexSkillReferences(skill.skillFile) };
}

function defaultModel(value: unknown): CodexModel | null | undefined {
  if (value === null) return null;
  if (!isAllowedCodexModel(value)) return undefined;
  return text(value) as CodexModel;
}

function defaultEffort(value: unknown): CodexEffort | null | undefined {
  if (value === null) return null;
  if (!isAllowedCodexEffort(value)) return undefined;
  return text(value) as CodexEffort;
}

function savedTags(value: unknown): string[] | undefined {
  return normalizeCodexSkillTags(value);
}

export function saveCodexSkillLibrary(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
  payload: AnyRecord;
}): SaveSkillResult {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const allSkills = scanCodexSkills({ workspaceRoot, serverRoot: runtimeServerRoot(input.runtime ?? {}) });
  const skill = allSkills.find((candidate) => candidate.name === input.skillName);
  if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName: input.skillName };
  if ('skillFile' in input.payload || 'filePath' in input.payload || 'path' in input.payload) {
    return { ok: false, statusCode: 400, error: 'Filesystem paths are not accepted.', skillName: input.skillName };
  }
  const availableSkillNames = allSkills.map((entry) => entry.name);
  const before = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
  const priorRecord = before.store.skillLibrary.find((entry) => entry.skillName === skill.name);
  const metadataKeys = Object.keys(input.payload);
  const metadataOnly = metadataKeys.length > 0 && metadataKeys.every((key) => key === 'favorite' || key === 'tags');
  const requestedFavorite = Object.prototype.hasOwnProperty.call(input.payload, 'favorite')
    ? typeof input.payload.favorite === 'boolean' ? input.payload.favorite : undefined
    : priorRecord?.favorite ?? false;
  const requestedTags = Object.prototype.hasOwnProperty.call(input.payload, 'tags')
    ? savedTags(input.payload.tags)
    : [...(priorRecord?.tags ?? [])];
  if (metadataOnly) {
    if (requestedFavorite === undefined) return { ok: false, statusCode: 400, error: 'Favorite must be a boolean.', skillName: input.skillName };
    if (requestedTags === undefined) return { ok: false, statusCode: 400, error: `Tags must contain at most one value from: ${codexSkillTags.join(', ')}.`, skillName: input.skillName };
    const updatedAt = new Date().toISOString();
    const skillLibrary = [
      ...before.store.skillLibrary.filter((entry) => entry.skillName !== skill.name),
      {
        skillName: skill.name,
        favorite: requestedFavorite,
        tags: requestedTags,
        defaultCodexModel: priorRecord?.defaultCodexModel ?? null,
        defaultCodexEffort: priorRecord?.defaultCodexEffort ?? null,
        updatedAt,
      },
    ];
    try {
      writeCodexPipelineStore({
        decisionOsRoot: input.decisionOsRoot,
        availableSkillNames,
        store: { ...before.store, skillLibrary },
      });
    } catch {
      return { ok: false, statusCode: 500, error: 'Could not save the skill library.', skillName: input.skillName };
    }
    const detail = readCodexSkillLibraryDetail({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, skillName: input.skillName });
    return detail
      ? { ok: true, statusCode: 200, skill: detail }
      : { ok: false, statusCode: 500, error: 'The saved skill could not be reloaded.', skillName: input.skillName };
  }
  if (!skill.editable || skill.source === 'system' || skill.source === 'plugin') {
    return { ok: false, statusCode: 403, error: skill.readOnlyReason || 'This skill is read-only.', skillName: input.skillName };
  }
  if (!Object.prototype.hasOwnProperty.call(input.payload, 'markdown')
    || !Object.prototype.hasOwnProperty.call(input.payload, 'revision')
    || !Object.prototype.hasOwnProperty.call(input.payload, 'defaultCodexModel')
    || !Object.prototype.hasOwnProperty.call(input.payload, 'defaultCodexEffort')) {
    return { ok: false, statusCode: 400, error: 'Missing markdown, revision, defaultCodexModel, or defaultCodexEffort.', skillName: input.skillName };
  }
  const markdown = typeof input.payload.markdown === 'string' ? input.payload.markdown : null;
  const revision = text(input.payload.revision);
  const codexModel = defaultModel(input.payload.defaultCodexModel);
  const codexEffort = defaultEffort(input.payload.defaultCodexEffort);
  if (codexModel === undefined) return { ok: false, statusCode: 400, error: 'Unsupported default Codex model.', skillName: input.skillName };
  if (codexEffort === undefined) return { ok: false, statusCode: 400, error: 'Unsupported default Codex effort.', skillName: input.skillName };
  if (markdown === null || !revision) return { ok: false, statusCode: 400, error: 'Markdown and revision are required.', skillName: input.skillName };
  const validation = validateSkillMarkdown(markdown, skill.name);
  if (!validation.ok) return { ok: false, statusCode: 400, error: validation.error || 'Invalid SKILL.md.', skillName: input.skillName };

  const currentMarkdown = readFileSync(skill.skillFile, 'utf8');
  const currentRevision = skillRevision(currentMarkdown);
  if (currentRevision !== revision) {
    return {
      ok: false,
      statusCode: 409,
      error: 'The skill changed after it was loaded. Reload it and apply the edit again.',
      skillName: input.skillName,
      currentRevision,
    };
  }
  const updatedAt = new Date().toISOString();
  const skillLibrary = [
    ...before.store.skillLibrary.filter((entry) => entry.skillName !== skill.name),
    { skillName: skill.name, favorite: priorRecord?.favorite === true, tags: priorRecord?.tags ?? [], defaultCodexModel: codexModel, defaultCodexEffort: codexEffort, updatedAt },
  ];

  let writtenRevision = '';
  try {
    writtenRevision = writeEditableSkillFile({ skill, workspaceRoot, markdown, expectedRevision: revision }).revision;
    try {
      writeCodexPipelineStore({
        decisionOsRoot: input.decisionOsRoot,
        availableSkillNames,
        store: { ...before.store, skillLibrary },
      });
    } catch (error) {
      writeEditableSkillFile({ skill: { ...skill, revision: writtenRevision }, workspaceRoot, markdown: currentMarkdown, expectedRevision: writtenRevision });
      throw error;
    }
  } catch (error) {
    if (error instanceof SkillRevisionConflict) {
      return { ok: false, statusCode: 409, error: error.message, skillName: input.skillName, currentRevision: error.currentRevision };
    }
    return {
      ok: false,
      statusCode: 500,
      error: 'Could not save the skill library.',
      skillName: input.skillName,
    };
  }

  const detail = readCodexSkillLibraryDetail({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    skillName: input.skillName,
  });
  if (!detail) return { ok: false, statusCode: 500, error: 'The saved skill could not be reloaded.', skillName: input.skillName };
  return { ok: true, statusCode: 200, skill: detail };
}
