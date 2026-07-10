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
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
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

type AnyRecord = Record<string, unknown>;

export type CodexSkillCatalogEntry = {
  name: string;
  description: string;
  source: CodexSkillSource;
  editable: boolean;
  readOnlyReason: string | null;
  revision: string;
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
  effectiveCodexModel: string;
  effectiveCodexEffort: string;
};

export type CodexSkillLibraryDetail = CodexSkillCatalogEntry & {
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
  defaults: Map<string, { defaultCodexModel: CodexModel | null; defaultCodexEffort: CodexEffort | null }>;
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
    defaultCodexModel,
    defaultCodexEffort,
    effectiveCodexModel: defaultCodexModel || input.fallbackModel,
    effectiveCodexEffort: defaultCodexEffort || input.fallbackEffort,
  };
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
  const skills = scanCodexSkills({ workspaceRoot });
  return catalogFromSkills({ ...input, workspaceRoot, skills });
}

export function readCodexSkillLibraryDetail(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
}): CodexSkillLibraryDetail | null {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = scanCodexSkills({ workspaceRoot });
  const skill = skills.find((candidate) => candidate.name === input.skillName);
  if (!skill) return null;
  const markdown = readFileSync(skill.skillFile, 'utf8');
  const catalog = catalogFromSkills({ ...input, workspaceRoot, skills });
  const entry = catalog.skills.find((candidate) => candidate.name === input.skillName);
  if (!entry) return null;
  return { ...entry, revision: skillRevision(markdown), markdown };
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

export function saveCodexSkillLibrary(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
  payload: AnyRecord;
}): SaveSkillResult {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const allSkills = scanCodexSkills({ workspaceRoot });
  const skill = allSkills.find((candidate) => candidate.name === input.skillName);
  if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName: input.skillName };
  if (!skill.editable || skill.source === 'system' || skill.source === 'plugin') {
    return { ok: false, statusCode: 403, error: skill.readOnlyReason || 'This skill is read-only.', skillName: input.skillName };
  }
  if ('skillFile' in input.payload || 'filePath' in input.payload || 'path' in input.payload) {
    return { ok: false, statusCode: 400, error: 'Filesystem paths are not accepted.', skillName: input.skillName };
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
  const availableSkillNames = allSkills.map((entry) => entry.name);
  const before = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
  const updatedAt = new Date().toISOString();
  const skillLibrary = [
    ...before.store.skillLibrary.filter((entry) => entry.skillName !== skill.name),
    { skillName: skill.name, defaultCodexModel: codexModel, defaultCodexEffort: codexEffort, updatedAt },
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
