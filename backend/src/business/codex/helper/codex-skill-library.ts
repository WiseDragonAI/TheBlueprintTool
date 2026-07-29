/**
 * WHAT: Resolves public skill-library records and safely saves editable SKILL.md content with run defaults.
 * WHY: The client must never choose a filesystem path or partially update Markdown and default settings.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import type { Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import type {
  CodexAuthoredContentRecord,
  CodexEffort,
  CodexModel,
  CodexPipelineStoreNormalization,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import {
  assertCodexPipelineStoreAvailable,
  codexPipelineStoreContentRevision,
  codexPipelineStoreWriteBlocker,
  mutateCodexPipelineStore,
  pipelineStoreFile,
  readCodexPipelineStore,
} from './codex-pipeline-store.js';
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
import {
  assertPipelinePromptName,
  createPipelinePrompt,
  readPipelinePrompt,
  scanPipelinePrompts,
  validatePipelinePromptMarkdown,
  validatePipelinePromptTemplates,
  writePipelinePrompt,
} from './pipeline-prompt-library.js';
import { atomicCreateTextFile, atomicReplaceTextFile } from './skill-content-file.js';
import {
  assertSkillFileRevisionWritable,
  commitSkillFileRevision,
  readSkillGitHistory,
  readSkillGitHistoryPage,
  readSkillGitRevision,
  retrySkillFileRevision,
  type SkillGitFailurePoint,
  type SkillGitHistoryPage,
  type SkillGitRevision,
  type SkillGitRevisionDetail,
  type SkillRevisionPersistence,
} from './skill-git-revisions.js';
import { serverPipelineDecisionOsRoot } from './server-pipeline-catalog.js';
import { readProjectRegistry } from '../../server/helper/project-registry.js';

export { codexSkillTags } from './codex-skill-tags.js';

type AnyRecord = Record<string, unknown>;
export type CodexSkillContentKind = 'federated-skill' | 'workspace-skill' | 'pipeline-prompt' | 'external-skill';
const maximumAuthoredMarkdownBytes = 1_000_000;

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
  contentKind: CodexSkillContentKind;
  executionVisibility: 'agent' | 'pipeline-only';
  projectId: string | null;
  gitRevision: SkillGitRevision | null;
};

export type CodexSkillLibraryDetail = CodexSkillCatalogEntry & {
  markdown: string;
  references: CodexSkillReference[];
  history: SkillGitRevision[];
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

export type CodexPublication = {
  status: 'not-applicable' | 'published' | 'failed';
  retryable?: boolean;
  retryPath?: string;
  incidentId?: string;
};

type AuthoredContentSuccess = {
  ok: true;
  statusCode: 200 | 201;
  skill: CodexSkillLibraryDetail;
  publication: CodexPublication;
};

type AuthoredContentFailure = {
  ok: false;
  statusCode: number;
  code?: string;
  error: string;
  field?: string;
  skillName?: string;
  currentRevision?: string;
  sourceClass?: CodexContentIdentity['sourceClass'];
  readOnlyReason?: string;
  conflict?: CodexContentIdentity;
  recovery?: {
    authoredBytesPreserved: true;
    gitRevisionCreated: false;
    contentRevision: string;
    recoveryToken: string;
    incidentId: string;
  };
};

type SaveSkillResult = AuthoredContentSuccess | AuthoredContentFailure;
type CreateSkillResult = AuthoredContentSuccess | AuthoredContentFailure;

export type CodexContentIdentity = {
  name: string;
  contentKind: CodexSkillContentKind;
  sourceClass: 'canonical-server' | 'registered-workspace' | 'pipeline-prompt' | 'user' | 'system' | 'plugin' | 'imported';
  projectId?: string;
};

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
  if (input.skill.source === 'server') return resolve(input.skill.skillFile, '../..');
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

export function validateSkillMarkdown(markdown: unknown, expectedName: string): SkillMarkdownValidation {
  if (typeof markdown !== 'string') return { ok: false, error: 'Skill Markdown must be a string.' };
  if (Buffer.byteLength(markdown, 'utf8') > maximumAuthoredMarkdownBytes) {
    return { ok: false, error: 'Skill Markdown exceeds the 1,000,000 byte limit.' };
  }
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
  atomicReplaceTextFile(file, input.markdown);
  return { revision: skillRevision(input.markdown) };
}

function contentKind(skill: CodexSkillSummary): CodexSkillContentKind {
  if (skill.source === 'server') return 'federated-skill';
  if (skill.source === 'workspace') return 'workspace-skill';
  if (skill.source === 'pipeline-prompt') return 'pipeline-prompt';
  return 'external-skill';
}

function skillSourceClass(skill: CodexSkillSummary): CodexContentIdentity['sourceClass'] {
  if (skill.readOnlyReason?.startsWith('Imported federated')) return 'imported';
  if (skill.source === 'server') return 'canonical-server';
  if (skill.source === 'workspace') return 'registered-workspace';
  if (skill.source === 'pipeline-prompt') return 'pipeline-prompt';
  return skill.source;
}

function stableGitFailure(input: {
  error: unknown;
  skillName: string;
  contentRevision: string;
}): AuthoredContentFailure {
  const value = input.error && typeof input.error === 'object' ? input.error as AnyRecord : {};
  const code = text(value.code);
  if (code === 'repository_mutation_locked') {
    return { ok: false, statusCode: 423, code, error: input.error instanceof Error ? input.error.message : 'The repository mutation lock is held.', skillName: input.skillName };
  }
  if (code === 'authored_owner_staged') {
    return { ok: false, statusCode: 409, code: 'authored_path_staged', error: input.error instanceof Error ? input.error.message : 'The authored path is staged.', skillName: input.skillName };
  }
  if (code === 'content_revision_conflict') {
    return {
      ok: false,
      statusCode: 409,
      code,
      error: input.error instanceof Error ? input.error.message : 'The authored content changed.',
      skillName: input.skillName,
      currentRevision: input.contentRevision,
    };
  }
  if (code === 'git_revision_pending_recovery') {
    return {
      ok: false,
      statusCode: 503,
      code,
      error: input.error instanceof Error ? input.error.message : 'The authored Git revision requires explicit retry.',
      skillName: input.skillName,
      currentRevision: input.contentRevision,
      recovery: {
        authoredBytesPreserved: true,
        gitRevisionCreated: false,
        contentRevision: input.contentRevision,
        recoveryToken: text(value.recoveryToken),
        incidentId: text(value.incidentId),
      },
    };
  }
  return {
    ok: false,
    statusCode: Number(value.statusCode) || 503,
    code: code || 'git_revision_failed',
    error: input.error instanceof Error ? input.error.message : 'Could not create the authored Git revision.',
    skillName: input.skillName,
  };
}

async function gitHistory(skill: CodexSkillSummary): Promise<SkillGitRevision[]> {
  try {
    return await readSkillGitHistory(skill.skillFile);
  } catch {
    return [];
  }
}

function catalogEntry(input: {
  skill: CodexSkillSummary;
  projectId: string;
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
    contentKind: contentKind(input.skill),
    executionVisibility: input.skill.source === 'pipeline-prompt' ? 'pipeline-only' : 'agent',
    projectId: input.skill.source === 'workspace' ? input.projectId || null : null,
    gitRevision: null,
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
  assertCodexPipelineStoreAvailable(normalization);
  const defaults = new Map(normalization.store.skillLibrary.map((entry) => [entry.skillName, entry]));
  const fallback = resolveCodexCommand({ workspaceRoot: input.workspaceRoot, runtime: input.runtime ?? {} });
  return {
    skills: input.skills.map((skill) => catalogEntry({
      skill,
      projectId: text(input.runtime?.projectId),
      defaults,
      fallbackModel: fallback.model,
      fallbackEffort: fallback.effort,
    })),
    normalization,
  };
}

function pipelinePromptDecisionOsRoot(input: { decisionOsRoot: string; runtime?: AnyRecord }): string {
  return serverPipelineDecisionOsRoot(input.runtime ?? {}, input.decisionOsRoot);
}

function librarySkills(
  input: { decisionOsRoot: string; runtime?: AnyRecord },
  includePipelinePrompts = false,
): CodexSkillSummary[] {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = scanCodexSkills({ workspaceRoot, serverRoot: runtimeServerRoot(input.runtime ?? {}) });
  if (!includePipelinePrompts) return skills;
  const prompts = scanPipelinePrompts(pipelinePromptDecisionOsRoot(input));
  const names = new Set(skills.map((skill) => skill.name));
  return [...skills, ...prompts.filter((prompt) => !names.has(prompt.name))]
    .sort((left, right) => left.name.localeCompare(right.name));
}

function registeredWorkspaceRoots(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
}): Array<{ projectId: string; root: string }> {
  const runtime = input.runtime ?? {};
  const supplied = Array.isArray(runtime.registeredProjects) ? runtime.registeredProjects : [];
  const roots = supplied.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const entry = value as AnyRecord;
    const projectId = text(entry.projectId ?? entry.id);
    const root = text(entry.root);
    return projectId && root ? [{ projectId, root: resolve(root) }] : [];
  });
  const serverRoot = runtimeServerRoot(runtime);
  if (serverRoot) {
    try {
      const registry = readProjectRegistry(resolve(serverRoot, '.decision-os'));
      for (const entry of Object.values(registry?.projects ?? {})) {
        const root = resolve(serverRoot, entry.relativePath);
        if (!existsSync(resolve(root, '.decision-os', 'state.json'))) continue;
        roots.push({ projectId: entry.id, root });
      }
    } catch {
      // An invalid project registry cannot authorize additional authored identities.
    }
  }
  const activeProjectId = text(runtime.projectId);
  if (activeProjectId) roots.push({ projectId: activeProjectId, root: dirname(resolve(input.decisionOsRoot)) });
  return [...new Map(
    roots
      .sort((left, right) => left.projectId.localeCompare(right.projectId) || left.root.localeCompare(right.root))
      .map((entry) => [`${entry.projectId}\0${entry.root}`, entry]),
  ).values()];
}

export function readCodexContentIdentityIndex(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
}): CodexContentIdentity[] {
  const serverRoot = runtimeServerRoot(input.runtime ?? {});
  const identities: CodexContentIdentity[] = [];
  if (serverRoot) {
    for (const skill of scanCodexSkills({ workspaceRoot: serverRoot, serverRoot })) {
      identities.push({
        name: skill.name,
        contentKind: contentKind(skill),
        sourceClass: skillSourceClass(skill),
      });
    }
  }
  for (const project of registeredWorkspaceRoots(input)) {
    for (const skill of scanCodexSkills({ workspaceRoot: project.root })) {
      identities.push({
        name: skill.name,
        contentKind: contentKind(skill),
        sourceClass: skillSourceClass(skill),
        ...(skill.source === 'workspace' ? { projectId: project.projectId } : {}),
      });
    }
  }
  const promptRoot = pipelinePromptDecisionOsRoot(input);
  for (const prompt of scanPipelinePrompts(promptRoot)) {
    identities.push({ name: prompt.name, contentKind: 'pipeline-prompt', sourceClass: 'pipeline-prompt' });
  }
  const priority = new Map<CodexContentIdentity['sourceClass'], number>([
    ['canonical-server', 0],
    ['registered-workspace', 1],
    ['pipeline-prompt', 2],
    ['user', 3],
    ['system', 4],
    ['plugin', 5],
    ['imported', 6],
  ]);
  return [...new Map(
    identities
      .sort((left, right) =>
        left.name.localeCompare(right.name)
        || (priority.get(left.sourceClass) ?? 99) - (priority.get(right.sourceClass) ?? 99)
        || (left.projectId ?? '').localeCompare(right.projectId ?? ''))
      .map((identity) => [identity.name, identity]),
  ).values()];
}

export function readCodexSkillCatalog(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
}): CodexSkillCatalog {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = librarySkills(input);
  return catalogFromSkills({ ...input, workspaceRoot, skills });
}

export function readCodexContentCatalog(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
}): CodexSkillCatalog {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = librarySkills(input, true);
  return catalogFromSkills({ ...input, workspaceRoot, skills });
}

export async function readCodexSkillLibraryDetail(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
}): Promise<CodexSkillLibraryDetail | null> {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const skills = librarySkills(input, true);
  const skill = skills.find((candidate) => candidate.name === input.skillName);
  if (!skill) return null;
  const markdown = skill.source === 'pipeline-prompt'
    ? readPipelinePrompt(pipelinePromptDecisionOsRoot(input), skill.name)?.markdown ?? ''
    : readFileSync(skill.skillFile, 'utf8');
  const catalog = catalogFromSkills({ ...input, workspaceRoot, skills });
  const entry = catalog.skills.find((candidate) => candidate.name === input.skillName);
  if (!entry) return null;
  const history = skillSourceClass(skill) === 'imported' ? [] : await gitHistory(skill);
  return {
    ...entry,
    revision: skillRevision(markdown),
    markdown,
    references: skill.source === 'pipeline-prompt' ? [] : readCodexSkillReferences(skill.skillFile),
    gitRevision: history[0] ?? null,
    history,
  };
}

export async function readCodexSkillRevisionHistory(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
  cursor?: string | null;
  limit?: number;
}): Promise<
  { ok: true; statusCode: 200; history: SkillGitRevision[]; nextCursor: string | null }
  | { ok: false; statusCode: number; code: string; error: string }
> {
  const skill = librarySkills(input, true).find((candidate) => candidate.name === input.skillName);
  if (!skill) return { ok: false, statusCode: 404, code: 'content_not_found', error: 'Skill or pipeline prompt not found.' };
  if (skillSourceClass(skill) === 'imported') {
    return { ok: true, statusCode: 200, history: [], nextCursor: null };
  }
  try {
    const page: SkillGitHistoryPage = await readSkillGitHistoryPage({
      file: skill.skillFile,
      cursor: input.cursor,
      limit: input.limit,
      allowUnversioned: skill.source === 'pipeline-prompt',
    });
    return { ok: true, statusCode: 200, history: page.revisions, nextCursor: page.nextCursor };
  } catch (error) {
    return { ok: false, statusCode: 503, code: 'content_history_unavailable', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function readCodexSkillRevisionContent(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
  commit: string;
}): Promise<{ ok: true; statusCode: 200; revision: SkillGitRevisionDetail } | { ok: false; statusCode: number; code: string; error: string }> {
  const skill = librarySkills(input, true).find((candidate) => candidate.name === input.skillName);
  if (!skill) return { ok: false, statusCode: 404, code: 'content_not_found', error: 'Skill or pipeline prompt not found.' };
  if (skillSourceClass(skill) === 'imported') {
    return { ok: false, statusCode: 404, code: 'content_revision_not_found', error: 'Imported federated skills expose only their current revision on this node.' };
  }
  try {
    return { ok: true, statusCode: 200, revision: await readSkillGitRevision(skill.skillFile, input.commit) };
  } catch (error) {
    return { ok: false, statusCode: 404, code: 'content_revision_not_found', error: error instanceof Error ? error.message : String(error) };
  }
}

function authoredMarkdown(input: { name: string; description: string; instructions: string; markdown?: unknown }): string {
  if (typeof input.markdown === 'string') return input.markdown.replace(/\r\n?/g, '\n').replace(/\n?$/, '\n');
  return `---\nname: ${input.name}\ndescription: ${JSON.stringify(input.description)}\n---\n\n${input.instructions.trim()}\n`;
}

function verifiedSkillCreationRoot(ownerRoot: string): string {
  const owner = resolve(ownerRoot);
  if (!existsSync(owner) || lstatSync(owner).isSymbolicLink()) {
    throw new Error('The authored skill owner root is unavailable or symlinked.');
  }
  const root = resolve(owner, '.skills');
  if (existsSync(root) && lstatSync(root).isSymbolicLink()) {
    throw new Error('The authored skill root cannot be a symlink.');
  }
  mkdirSync(root, { recursive: true });
  if (!isInside(realpathSync(owner), realpathSync(root))) {
    throw new Error('The authored skill root resolves outside its owner.');
  }
  return root;
}

export async function createCodexSkillLibrary(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  payload: AnyRecord;
}): Promise<CreateSkillResult> {
  if ('skillFile' in input.payload || 'filePath' in input.payload || 'path' in input.payload) {
    return { ok: false, statusCode: 422, code: 'browser_path_forbidden', field: 'path', error: 'Filesystem paths are not accepted.' };
  }
  let name = '';
  try {
    name = assertPipelinePromptName(text(input.payload.name));
  } catch (error) {
    return { ok: false, statusCode: 422, code: 'invalid_content_identity', field: 'name', error: error instanceof Error ? error.message : String(error) };
  }
  const kind = text(input.payload.contentKind) as CodexSkillContentKind;
  if (kind !== 'federated-skill' && kind !== 'workspace-skill' && kind !== 'pipeline-prompt') {
    return { ok: false, statusCode: 422, code: 'invalid_content_kind', field: 'contentKind', error: 'Content kind must be federated-skill, workspace-skill, or pipeline-prompt.', skillName: name };
  }
  const description = text(input.payload.description);
  const instructions = typeof input.payload.instructions === 'string' ? input.payload.instructions : '';
  if (!description || (!instructions.trim() && typeof input.payload.markdown !== 'string')) {
    return { ok: false, statusCode: 422, code: 'invalid_content_markdown', field: 'markdown', error: 'Description and instructions are required.', skillName: name };
  }
  const collision = readCodexContentIdentityIndex(input).find((candidate) => candidate.name === name);
  if (collision) {
    return {
      ok: false,
      statusCode: 409,
      code: 'content_identity_conflict',
      error: 'An authored content identity with this name already exists.',
      skillName: name,
      conflict: collision,
    };
  }
  const markdown = kind === 'pipeline-prompt'
    ? (typeof input.payload.markdown === 'string'
        ? input.payload.markdown.replace(/\r\n?/g, '\n').replace(/\n?$/, '\n')
        : `${instructions.trim()}\n`)
    : authoredMarkdown({ name, description, instructions, markdown: input.payload.markdown });
  const validation = kind === 'pipeline-prompt'
    ? validatePipelinePromptMarkdown(markdown)
    : validateSkillMarkdown(markdown, name);
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: /1,000,000 byte limit/.test('error' in validation ? validation.error : '') ? 413 : 422,
      code: /1,000,000 byte limit/.test('error' in validation ? validation.error : '') ? 'content_too_large' : 'invalid_content_markdown',
      field: 'markdown',
      error: 'error' in validation ? validation.error : 'Invalid authored Markdown.',
      skillName: name,
    };
  }
  if (kind === 'pipeline-prompt') {
    const templates = validatePipelinePromptTemplates({
      decisionOsRoot: pipelinePromptDecisionOsRoot(input),
      name,
      markdown,
    });
    if (!templates.ok) {
      return {
        ok: false,
        statusCode: 422,
        code: 'pipeline_prompt_template_invalid',
        field: 'markdown',
        error: 'error' in templates ? templates.error : 'Invalid pipeline prompt template.',
        skillName: name,
      };
    }
  }
  const workspaceRoot = dirname(input.decisionOsRoot);
  const serverRoot = runtimeServerRoot(input.runtime ?? {});
  if (kind === 'federated-skill' && !serverRoot) {
    return { ok: false, statusCode: 503, code: 'content_owner_unavailable', error: 'The server skill root is unavailable.', skillName: name };
  }
  if (kind === 'workspace-skill' && (!text(input.runtime?.projectId) || (serverRoot && resolve(workspaceRoot) === resolve(serverRoot)))) {
    return {
      ok: false,
      statusCode: 422,
      code: 'workspace_project_required',
      field: 'projectId',
      error: 'Workspace skill creation requires an explicit available project identity.',
      skillName: name,
    };
  }
  const promptDecisionOsRoot = pipelinePromptDecisionOsRoot(input);
  let createdFile = '';
  let createdDirectory = '';
  const promptMetadataFile = pipelineStoreFile(promptDecisionOsRoot);
  const promptMetadataExisted = existsSync(promptMetadataFile);
  const promptMetadataBefore = promptMetadataExisted ? readFileSync(promptMetadataFile, 'utf8') : '';
  let createdContentRevision = '';
  let promptMetadataRevision = '';
  try {
    const ownerRoot = kind === 'federated-skill' ? serverRoot! : workspaceRoot;
    const futureFile = kind === 'pipeline-prompt'
      ? resolve(promptDecisionOsRoot, 'pipeline-prompts', `${name}.md`)
      : resolve(ownerRoot, '.skills', name, 'SKILL.md');
    const revisionPersistence = await assertSkillFileRevisionWritable({
      file: futureFile,
      additionalFiles: kind === 'pipeline-prompt' && promptMetadataExisted ? [promptMetadataFile] : [],
      repositoryRoot: ownerRoot,
      allowUnversioned: kind === 'pipeline-prompt',
    });
    if (kind === 'pipeline-prompt') {
      const before = readCodexPipelineStore({
        decisionOsRoot: promptDecisionOsRoot,
        availableSkillNames: librarySkills(input, true).map((candidate) => candidate.name),
      });
      assertCodexPipelineStoreAvailable(before);
      const blocker = codexPipelineStoreWriteBlocker(before);
      if (blocker) throw new Error(`The pipeline content store is invalid and was preserved: ${blocker.message}`);
      const mutation = mutateCodexPipelineStore({
        decisionOsRoot: promptDecisionOsRoot,
        availableSkillNames: [...librarySkills(input, true).map((candidate) => candidate.name), name],
        mutate: (store) => {
          const immediateCollision = readCodexContentIdentityIndex(input).find((candidate) => candidate.name === name);
          if (immediateCollision) {
            const error = new Error('An authored content identity with this name already exists.');
            Object.assign(error, { code: 'content_identity_conflict', conflict: immediateCollision });
            throw error;
          }
          const created = createPipelinePrompt({
            decisionOsRoot: promptDecisionOsRoot,
            name,
            description,
            markdown,
          });
          createdFile = created.skillFile;
          createdContentRevision = skillRevision(markdown);
          const now = new Date().toISOString();
          const record: CodexAuthoredContentRecord = {
            id: name,
            kind: 'pipeline-prompt',
            description,
            contentFile: `pipeline-prompts/${name}.md`,
            createdAt: now,
            updatedAt: now,
          };
          return {
            ...store,
            authoredContent: [...store.authoredContent.filter((entry) => entry.id !== name), record],
          };
        },
      });
      promptMetadataRevision = codexPipelineStoreContentRevision(mutation.store);
    } else {
      const immediateCollision = readCodexContentIdentityIndex(input).find((candidate) => candidate.name === name);
      if (immediateCollision) {
        const error = new Error('An authored content identity with this name already exists.');
        Object.assign(error, { code: 'content_identity_conflict', conflict: immediateCollision });
        throw error;
      }
      const root = verifiedSkillCreationRoot(kind === 'federated-skill' ? serverRoot! : workspaceRoot);
      createdDirectory = resolve(root, name);
      createdFile = resolve(createdDirectory, 'SKILL.md');
      if (existsSync(createdDirectory)) throw new Error('A skill directory with this name already exists.');
      mkdirSync(createdDirectory, { recursive: false });
      atomicCreateTextFile(createdFile, markdown);
      createdContentRevision = skillRevision(markdown);
    }
    if (revisionPersistence === 'git') {
      await commitSkillFileRevision({
        file: createdFile,
        contentRevision: createdContentRevision,
        additionalFiles: kind === 'pipeline-prompt'
          ? [{ file: promptMetadataFile, contentRevision: promptMetadataRevision }]
          : [],
        subject: `Create ${kind} ${name}`,
      });
    }
  } catch (error) {
    const code = error && typeof error === 'object' ? text((error as AnyRecord).code) : '';
    const currentRevision = createdFile && existsSync(createdFile) ? skillRevision(readFileSync(createdFile, 'utf8')) : skillRevision(markdown);
    if (code === 'git_revision_pending_recovery') return stableGitFailure({ error, skillName: name, contentRevision: currentRevision });
    if (createdFile && existsSync(createdFile)) rmSync(createdFile, { force: true });
    if (createdDirectory && existsSync(createdDirectory)) rmSync(createdDirectory, { recursive: true, force: true });
    if (kind === 'pipeline-prompt' && existsSync(promptMetadataFile)) {
      if (promptMetadataExisted) atomicReplaceTextFile(promptMetadataFile, promptMetadataBefore);
      else rmSync(promptMetadataFile, { force: true });
    }
    if (code === 'content_identity_conflict') {
      return {
        ok: false,
        statusCode: 409,
        code,
        error: error instanceof Error ? error.message : 'An authored content identity with this name already exists.',
        skillName: name,
        conflict: (error as AnyRecord).conflict as CodexContentIdentity,
      };
    }
    return stableGitFailure({ error, skillName: name, contentRevision: currentRevision });
  }
  const detail = await readCodexSkillLibraryDetail({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, skillName: name });
  return detail
    ? { ok: true, statusCode: 201, skill: detail, publication: { status: 'not-applicable' } }
    : { ok: false, statusCode: 500, code: 'content_reload_failed', error: 'The created content could not be reloaded.', skillName: name };
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

function withSavedMetadata(
  detail: CodexSkillLibraryDetail,
  record: {
    favorite: boolean;
    tags: readonly string[];
    defaultCodexModel: CodexModel | null;
    defaultCodexEffort: CodexEffort | null;
  },
): CodexSkillLibraryDetail {
  return {
    ...detail,
    favorite: record.favorite,
    tags: [...record.tags],
    defaultCodexModel: record.defaultCodexModel,
    defaultCodexEffort: record.defaultCodexEffort,
    effectiveCodexModel: record.defaultCodexModel || detail.effectiveCodexModel,
    effectiveCodexEffort: record.defaultCodexEffort || detail.effectiveCodexEffort,
  };
}

export async function saveCodexSkillLibrary(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
  payload: AnyRecord;
  /** Focused regression injection; HTTP controllers never set this field. */
  gitFailureAt?: SkillGitFailurePoint;
  /** Focused post-save race injection; HTTP controllers never set this field. */
  beforeGitRevision?: () => void | Promise<void>;
}): Promise<SaveSkillResult> {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const allSkills = librarySkills(input, true);
  const skill = allSkills.find((candidate) => candidate.name === input.skillName);
  if (!skill) return { ok: false, statusCode: 404, code: 'content_not_found', error: 'Skill or pipeline prompt not found.', skillName: input.skillName };
  if ('skillFile' in input.payload || 'filePath' in input.payload || 'path' in input.payload) {
    return { ok: false, statusCode: 422, code: 'browser_path_forbidden', field: 'path', error: 'Filesystem paths are not accepted.', skillName: input.skillName };
  }
  const availableSkillNames = allSkills.map((entry) => entry.name);
  const metadataDecisionOsRoot = skill.source === 'server' || skill.source === 'pipeline-prompt'
    ? pipelinePromptDecisionOsRoot(input)
    : input.decisionOsRoot;
  const ownerRepositoryRoot = skill.source === 'server' || skill.source === 'pipeline-prompt'
    ? dirname(metadataDecisionOsRoot)
    : workspaceRoot;
  const before = readCodexPipelineStore({ decisionOsRoot: metadataDecisionOsRoot, availableSkillNames });
  assertCodexPipelineStoreAvailable(before);
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
    let savedRecord: CodexPipelineStoreNormalization['store']['skillLibrary'][number] | undefined;
    try {
      mutateCodexPipelineStore({
        decisionOsRoot: metadataDecisionOsRoot,
        availableSkillNames,
        mutate: (store) => {
          const latest = store.skillLibrary.find((entry) => entry.skillName === skill.name);
          savedRecord = {
            skillName: skill.name,
            favorite: requestedFavorite,
            tags: requestedTags,
            defaultCodexModel: latest?.defaultCodexModel ?? null,
            defaultCodexEffort: latest?.defaultCodexEffort ?? null,
            updatedAt,
          };
          return {
            ...store,
            skillLibrary: [...store.skillLibrary.filter((entry) => entry.skillName !== skill.name), savedRecord],
          };
        },
      });
    } catch {
      return { ok: false, statusCode: 500, error: 'Could not save the skill library.', skillName: input.skillName };
    }
    const detail = await readCodexSkillLibraryDetail({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, skillName: input.skillName });
    return detail
      ? { ok: true, statusCode: 200, skill: withSavedMetadata(detail, savedRecord!), publication: { status: 'not-applicable' } }
      : { ok: false, statusCode: 500, error: 'The saved skill could not be reloaded.', skillName: input.skillName };
  }
  if (!skill.editable || skill.source === 'system' || skill.source === 'plugin') {
    const readOnlyReason = skill.readOnlyReason || 'This content is read-only.';
    return {
      ok: false,
      statusCode: 403,
      code: 'content_read_only',
      error: readOnlyReason,
      readOnlyReason,
      sourceClass: skillSourceClass(skill),
      skillName: input.skillName,
    };
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
  const validation = skill.source === 'pipeline-prompt'
    ? validatePipelinePromptMarkdown(markdown)
    : validateSkillMarkdown(markdown, skill.name);
  if (!validation.ok) {
    const error = 'error' in validation ? validation.error : 'Invalid authored Markdown.';
    const oversized = /1,000,000 byte limit/.test(error);
    return {
      ok: false,
      statusCode: oversized ? 413 : 422,
      code: oversized ? 'content_too_large' : 'invalid_content_markdown',
      field: 'markdown',
      error,
      skillName: input.skillName,
    };
  }
  if (skill.source === 'pipeline-prompt') {
    const templates = validatePipelinePromptTemplates({
      decisionOsRoot: pipelinePromptDecisionOsRoot(input),
      name: skill.name,
      markdown,
    });
    if (!templates.ok) {
      return {
        ok: false,
        statusCode: 422,
        code: 'pipeline_prompt_template_invalid',
        field: 'markdown',
        error: 'error' in templates ? templates.error : 'Invalid pipeline prompt template.',
        skillName: input.skillName,
      };
    }
  }

  const currentMarkdown = readFileSync(skill.skillFile, 'utf8');
  const currentRevision = skillRevision(currentMarkdown);
  if (currentRevision !== revision) {
    return {
      ok: false,
      statusCode: 409,
      code: 'content_revision_conflict',
      error: 'The skill changed after it was loaded. Reload it and apply the edit again.',
      skillName: input.skillName,
      currentRevision,
    };
  }
  if (markdown === currentMarkdown) {
    return {
      ok: false,
      statusCode: 422,
      code: 'content_not_changed',
      error: 'The submitted Markdown is unchanged.',
      skillName: input.skillName,
      currentRevision,
    };
  }
  const updatedAt = new Date().toISOString();
  let savedRecord: CodexPipelineStoreNormalization['store']['skillLibrary'][number] | undefined;
  const metadataFile = pipelineStoreFile(metadataDecisionOsRoot);
  const metadataExisted = existsSync(metadataFile);
  const metadataBefore = metadataExisted ? readFileSync(metadataFile, 'utf8') : '';

  let contentWritten = false;
  let confirmedContentRevision = '';
  let confirmedMetadataRevision = '';
  let revisionPersistence: SkillRevisionPersistence = 'git';
  try {
    revisionPersistence = await assertSkillFileRevisionWritable({
      file: skill.skillFile,
      additionalFiles: skill.source === 'pipeline-prompt' ? [metadataFile] : [],
      repositoryRoot: ownerRepositoryRoot,
      allowUnversioned: skill.source === 'pipeline-prompt',
    });
    if (skill.source === 'pipeline-prompt') {
      confirmedContentRevision = writePipelinePrompt({
        decisionOsRoot: pipelinePromptDecisionOsRoot(input),
        name: skill.name,
        markdown,
        expectedRevision: revision,
      }).revision;
    } else {
      confirmedContentRevision = writeEditableSkillFile({
        skill,
        workspaceRoot,
        markdown,
        expectedRevision: revision,
      }).revision;
    }
    contentWritten = true;
    try {
      const mutation = mutateCodexPipelineStore({
        decisionOsRoot: metadataDecisionOsRoot,
        availableSkillNames,
        mutate: (store) => {
          const latest = store.skillLibrary.find((entry) => entry.skillName === skill.name);
          savedRecord = {
            skillName: skill.name,
            favorite: latest?.favorite === true,
            tags: latest?.tags ?? [],
            defaultCodexModel: codexModel,
            defaultCodexEffort: codexEffort,
            updatedAt,
          };
          const authoredContent = skill.source === 'pipeline-prompt'
            ? [
                ...store.authoredContent.filter((entry) => entry.id !== skill.name),
                {
                  id: skill.name,
                  kind: 'pipeline-prompt' as const,
                  description: skill.description,
                  contentFile: `pipeline-prompts/${skill.name}.md` as const,
                  createdAt: store.authoredContent.find((entry) => entry.id === skill.name)?.createdAt ?? updatedAt,
                  updatedAt,
                },
              ]
            : store.authoredContent;
          return {
            ...store,
            skillLibrary: [...store.skillLibrary.filter((entry) => entry.skillName !== skill.name), savedRecord],
            authoredContent,
          };
        },
      });
      confirmedMetadataRevision = codexPipelineStoreContentRevision(mutation.store);
    } catch (error) {
      atomicReplaceTextFile(skill.skillFile, currentMarkdown);
      throw error;
    }
    if (revisionPersistence === 'git') {
      await input.beforeGitRevision?.();
      await commitSkillFileRevision({
        file: skill.skillFile,
        contentRevision: confirmedContentRevision,
        additionalFiles: skill.source === 'pipeline-prompt'
          ? [{ file: metadataFile, contentRevision: confirmedMetadataRevision }]
          : [],
        subject: `Revise ${contentKind(skill)} ${skill.name}`,
        failureAt: input.gitFailureAt,
      });
    }
  } catch (error) {
    if (error instanceof SkillRevisionConflict) {
      return { ok: false, statusCode: 409, code: 'content_revision_conflict', error: error.message, skillName: input.skillName, currentRevision: error.currentRevision };
    }
    const conflict = error && typeof error === 'object' && (error as AnyRecord).code === 'revision_conflict';
    if (conflict) {
      return {
        ok: false,
        statusCode: 409,
        code: 'content_revision_conflict',
        error: error instanceof Error ? error.message : 'The content changed after it was loaded.',
        skillName: input.skillName,
        currentRevision: String((error as AnyRecord).currentRevision ?? ''),
      };
    }
    const failure = stableGitFailure({
      error,
      skillName: input.skillName,
      contentRevision: skillRevision(markdown),
    });
    if (failure.code !== 'git_revision_pending_recovery') {
      if (
        contentWritten
        && skillRevision(readFileSync(skill.skillFile, 'utf8')) === confirmedContentRevision
      ) {
        atomicReplaceTextFile(skill.skillFile, currentMarkdown);
      }
      const metadataCurrentRevision = existsSync(metadataFile)
        ? skillRevision(readFileSync(metadataFile, 'utf8'))
        : '';
      if (metadataCurrentRevision === confirmedMetadataRevision) {
        if (metadataExisted) atomicReplaceTextFile(metadataFile, metadataBefore);
        else if (existsSync(metadataFile)) rmSync(metadataFile, { force: true });
      }
    }
    return failure;
  }

  const detail = await readCodexSkillLibraryDetail({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    skillName: input.skillName,
  });
  if (!detail) return { ok: false, statusCode: 500, error: 'The saved skill could not be reloaded.', skillName: input.skillName };
  return { ok: true, statusCode: 200, skill: withSavedMetadata(detail, savedRecord!), publication: { status: 'not-applicable' } };
}

export async function retryCodexSkillRevision(input: {
  decisionOsRoot: string;
  runtime?: AnyRecord;
  skillName: string;
  recoveryToken: string;
  contentRevision: string;
}): Promise<SaveSkillResult> {
  const skill = librarySkills(input, true).find((candidate) => candidate.name === input.skillName);
  if (!skill) return { ok: false, statusCode: 404, code: 'content_not_found', error: 'Skill or pipeline prompt not found.', skillName: input.skillName };
  if (!skill.editable) {
    const readOnlyReason = skill.readOnlyReason || 'This content is read-only.';
    return {
      ok: false,
      statusCode: 403,
      code: 'content_read_only',
      error: readOnlyReason,
      readOnlyReason,
      sourceClass: skillSourceClass(skill),
      skillName: input.skillName,
    };
  }
  const currentMarkdown = readFileSync(skill.skillFile, 'utf8');
  const currentRevision = skillRevision(currentMarkdown);
  if (!input.contentRevision || currentRevision !== input.contentRevision) {
    return {
      ok: false,
      statusCode: 409,
      code: 'content_revision_conflict',
      error: 'The authored content changed after the Git recovery was created.',
      skillName: input.skillName,
      currentRevision,
    };
  }
  if (!input.recoveryToken) {
    return { ok: false, statusCode: 422, code: 'invalid_recovery_token', field: 'recoveryToken', error: 'A recovery token is required.', skillName: input.skillName };
  }
  try {
    await retrySkillFileRevision({ file: skill.skillFile, recoveryToken: input.recoveryToken });
  } catch (error) {
    return stableGitFailure({ error, skillName: input.skillName, contentRevision: currentRevision });
  }
  const detail = await readCodexSkillLibraryDetail(input);
  return detail
    ? { ok: true, statusCode: 200, skill: detail, publication: { status: 'not-applicable' } }
    : { ok: false, statusCode: 500, code: 'content_reload_failed', error: 'The recovered content could not be reloaded.', skillName: input.skillName };
}
