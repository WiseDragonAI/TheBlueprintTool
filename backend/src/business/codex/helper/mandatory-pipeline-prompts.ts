/**
 * WHAT: Ensures every Decision OS server owns the mandatory pipeline-prompt identities and Markdown files.
 * WHY: Core execution prompts must not depend on whichever project workspace happened to launch the server.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CodexAuthoredContentRecord,
  CodexSkillLibraryRecord,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import {
  assertCodexPipelineStoreAvailable,
  mutateCodexPipelineStore,
  pipelineStoreFile,
  readCodexPipelineStore,
} from './codex-pipeline-store.js';
import {
  compilePipelinePromptGraph,
  createPipelinePrompt,
  pipelinePromptFile,
  readPipelinePrompt,
  validatePipelinePromptMarkdown,
} from './pipeline-prompt-library.js';
import { atomicReplaceTextFile } from './skill-content-file.js';

type MandatoryPromptName = 'CLI_TOOLS' | 'CODEX_RUN' | 'SKILL' | 'SYSTEM_PROMPT';
type MandatoryPromptDefinition = {
  description: string;
  name: MandatoryPromptName;
};

const maximumGitOutputBytes = 1024 * 1024;
const gitDeadlineMs = 20_000;
const packagedPromptTemplateRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../templates/pipeline-prompts',
);

export const mandatoryPipelinePromptDefinitions: readonly MandatoryPromptDefinition[] = [
  { name: 'SYSTEM_PROMPT', description: 'Common Decision OS developer instructions.' },
  { name: 'SKILL', description: 'Decision OS developer wrapper for pipeline skill execution.' },
  { name: 'CODEX_RUN', description: 'Decision OS developer instructions for direct card and thread Codex runs.' },
  { name: 'CLI_TOOLS', description: 'Decision OS commands available to pipeline prompts for compact repository maps, card reads, task inspection, operator replies, dynamic continuation, progress, output handoff, and authorized completion.' },
] as const;

export const mandatoryPipelinePromptNames = mandatoryPipelinePromptDefinitions
  .map((definition) => definition.name);

function git(input: {
  args: string[];
  decisionOsRoot: string;
  operation: string;
}): string {
  const result = spawnSync('git', input.args, {
    cwd: input.decisionOsRoot,
    encoding: 'utf8',
    timeout: gitDeadlineMs,
    maxBuffer: maximumGitOutputBytes,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
  });
  // WHAT: reject a failed or interrupted Git operation before prompt ownership advances.
  // WHY: mandatory prompt files and their registration must share committed evidence.
  if (result.status !== 0) {
    const detail = String(
      result.stderr
      || result.stdout
      || result.error?.message
      || (result.signal ? `terminated by ${result.signal}` : `exit ${result.status}`),
    ).trim();
    throw new Error(`Mandatory prompt Git ${input.operation} failed: ${detail}.`);
  }
  return String(result.stdout).trim();
}

function packagedPromptTemplateMarkdown(definition: MandatoryPromptDefinition): string {
  const file = resolve(packagedPromptTemplateRoot, `${definition.name}.md`);
  // WHAT: fail bootstrap when a packaged mandatory template is absent or not a regular file.
  // WHY: startup cannot invent the exact operating instructions for a missing server prompt.
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`Packaged mandatory pipeline prompt template is unavailable: ${file}`);
  }
  const markdown = readFileSync(file, 'utf8');
  const validation = validatePipelinePromptMarkdown(markdown);
  // WHAT: reject an invalid packaged template before touching server-owned state.
  // WHY: a bad release asset must not become durable authored content.
  if (validation.ok === false) {
    throw new Error(`Packaged mandatory pipeline prompt template ${definition.name} is invalid: ${validation.error}`);
  }
  return markdown;
}

function existingPromptMarkdown(file: string, name: MandatoryPromptName): string {
  // WHAT: distinguish a missing prompt from invalid durable content.
  // WHY: missing mandatory content may be restored, while existing invalid bytes must be preserved.
  if (!existsSync(file)) return '';
  // WHAT: reject symlinked and non-file mandatory prompt paths without replacing them.
  // WHY: server-authored prompt ownership requires a contained regular file.
  if (lstatSync(file).isSymbolicLink() || !statSync(file).isFile()) {
    throw new Error(`Mandatory pipeline prompt ${name} is not a contained regular file: ${file}`);
  }
  let markdown = '';
  try {
    markdown = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
  } catch (error) {
    throw new Error(`Mandatory pipeline prompt ${name} is not valid UTF-8: ${error instanceof Error ? error.message : String(error)}`);
  }
  const validation = validatePipelinePromptMarkdown(markdown);
  // WHAT: preserve and reject invalid existing Markdown.
  // WHY: startup recovery must never rewrite operator-authored durable bytes.
  if (validation.ok === false) {
    throw new Error(`Mandatory pipeline prompt ${name} is invalid and was preserved: ${validation.error}`);
  }
  return markdown;
}

function assertRegistration(
  record: CodexAuthoredContentRecord,
  definition: MandatoryPromptDefinition,
): void {
  const expectedFile = `pipeline-prompts/${definition.name}.md`;
  // WHAT: reject a mandatory identity owned by another content kind or path.
  // WHY: silently replacing conflicting authored metadata would destroy durable ownership evidence.
  if (record.kind !== 'pipeline-prompt' || record.contentFile !== expectedFile) {
    throw new Error(`Mandatory pipeline prompt ${definition.name} has conflicting registration metadata.`);
  }
}

function assertBootstrapPathsWritable(input: {
  decisionOsRoot: string;
  paths: readonly string[];
  storeMutationRequired: boolean;
}): void {
  const staged = git({
    decisionOsRoot: input.decisionOsRoot,
    args: ['diff', '--cached', '--name-only', 'HEAD', '--', ...input.paths],
    operation: 'inspect-staged-paths',
  });
  // WHAT: stop before touching any operator-approved staged prompt path.
  // WHY: startup bootstrap cannot absorb or overwrite protected authored hunks.
  if (staged) throw new Error(`Mandatory prompt paths are already staged: ${staged}`);
  // WHAT: require a clean registration file before adding missing identities.
  // WHY: a path-level bootstrap commit cannot separate unrelated uncommitted metadata edits.
  if (input.storeMutationRequired && existsSync(pipelineStoreFile(input.decisionOsRoot))) {
    const registrationStatus = git({
      decisionOsRoot: input.decisionOsRoot,
      args: ['status', '--short', '--', 'codex-pipelines.json'],
      operation: 'inspect-registration-status',
    });
    // WHAT: stop when the shared registration file contains uncommitted changes.
    // WHY: the bootstrap commit must not capture unrelated runtime or operator edits.
    if (registrationStatus) {
      throw new Error('The server pipeline registration file has uncommitted changes; mandatory prompt bootstrap was not applied.');
    }
  }
}

function commitBootstrap(input: { decisionOsRoot: string; paths: readonly string[] }): void {
  git({
    decisionOsRoot: input.decisionOsRoot,
    args: ['add', '--', ...input.paths],
    operation: 'stage',
  });
  git({
    decisionOsRoot: input.decisionOsRoot,
    args: [
      'commit',
      '--only',
      '-m',
      'Install mandatory pipeline prompts',
      '-m',
      'WHAT: Restore missing server-owned mandatory prompt files and registrations.',
      '-m',
      'WHY: Decision OS execution must not depend on project-local prompt copies.',
      '--',
      ...input.paths,
    ],
    operation: 'commit',
  });
}

function restoreRegistrationBytes(input: {
  decisionOsRoot: string;
  existed: boolean;
  bytes: string;
}): void {
  const file = pipelineStoreFile(input.decisionOsRoot);
  // WHAT: restore the exact prior registration bytes after a failed bootstrap.
  // WHY: failed startup recovery must not leave partially installed prompt ownership.
  if (input.existed) atomicReplaceTextFile(file, input.bytes);
  else rmSync(file, { force: true });
}

export function ensureMandatoryPipelinePrompts(input: {
  serverDecisionOsRoot: string;
}): {
  createdPromptIds: MandatoryPromptName[];
  registeredPromptIds: MandatoryPromptName[];
} {
  const decisionOsRoot = resolve(input.serverDecisionOsRoot);
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  const registrations = new Map(normalized.store.authoredContent.map((record) => [record.id, record]));
  const metadata = new Map(normalized.store.skillLibrary.map((record) => [record.skillName, record]));
  const promptMarkdown = new Map<string, string>();
  const createdPromptIds: MandatoryPromptName[] = [];
  const registeredPromptIds: MandatoryPromptName[] = [];
  const createdFiles: string[] = [];

  for (const definition of mandatoryPipelinePromptDefinitions) {
    const registration = registrations.get(definition.name);
    // WHAT: validate existing mandatory registration ownership before considering recovery.
    // WHY: a conflicting identity is durable evidence, not an absent default.
    if (registration) assertRegistration(registration, definition);
    const file = pipelinePromptFile(decisionOsRoot, definition.name);
    const current = existingPromptMarkdown(file, definition.name);
    const markdown = current || packagedPromptTemplateMarkdown(definition);
    promptMarkdown.set(definition.name, markdown);
    // WHAT: mark only genuinely absent files for creation.
    // WHY: valid authored prompt Markdown must remain byte-identical across restart.
    if (!current) {
      createdPromptIds.push(definition.name);
      createdFiles.push(file);
    }
    // WHAT: register an existing or newly restored mandatory prompt exactly once.
    // WHY: filesystem presence alone does not make a prompt discoverable or admissible.
    if (!registration) registeredPromptIds.push(definition.name);
  }

  const resolvePrompt = (name: string): string | null => promptMarkdown.get(name)
    ?? readPipelinePrompt(decisionOsRoot, name)?.markdown
    ?? null;
  compilePipelinePromptGraph({ roots: ['SYSTEM_PROMPT', 'SKILL'], resolve: resolvePrompt });
  compilePipelinePromptGraph({ roots: ['SYSTEM_PROMPT', 'CODEX_RUN'], resolve: resolvePrompt });
  compilePipelinePromptGraph({ roots: ['CLI_TOOLS'], resolve: resolvePrompt });

  const missingMetadata = mandatoryPipelinePromptDefinitions
    .filter((definition) => !metadata.has(definition.name));
  const storeMutationRequired = registeredPromptIds.length > 0 || missingMetadata.length > 0;
  const changedFiles = [
    ...createdFiles,
    ...(storeMutationRequired ? [pipelineStoreFile(decisionOsRoot)] : []),
  ];
  // WHAT: return without mutation when every mandatory prompt is already valid and registered.
  // WHY: startup checks must not rewrite or recommit healthy authored state.
  if (changedFiles.length === 0) return { createdPromptIds, registeredPromptIds };

  const relativePaths = changedFiles.map((file) => relative(decisionOsRoot, file).split('\\').join('/'));
  assertBootstrapPathsWritable({ decisionOsRoot, paths: relativePaths, storeMutationRequired });
  const storeFile = pipelineStoreFile(decisionOsRoot);
  const storeExisted = existsSync(storeFile);
  const storeBytes = storeExisted ? readFileSync(storeFile, 'utf8') : '';
  try {
    for (const name of createdPromptIds) {
      const definition = mandatoryPipelinePromptDefinitions.find((candidate) => candidate.name === name)!;
      createPipelinePrompt({
        decisionOsRoot,
        name,
        description: definition.description,
        markdown: promptMarkdown.get(name)!,
      });
    }
    // WHAT: add every missing identity and System metadata record in one store mutation.
    // WHY: mandatory prompt files and discovery metadata must become visible atomically.
    if (storeMutationRequired) {
      const now = new Date().toISOString();
      mutateCodexPipelineStore({
        decisionOsRoot,
        mutate: (store) => {
          const authoredContent: CodexAuthoredContentRecord[] = [...store.authoredContent];
          const skillLibrary: CodexSkillLibraryRecord[] = [...store.skillLibrary];
          for (const definition of mandatoryPipelinePromptDefinitions) {
            // WHAT: add only a missing mandatory authored-content identity.
            // WHY: existing valid registration timestamps and descriptions remain authoritative.
            if (!authoredContent.some((record) => record.id === definition.name)) {
              authoredContent.push({
                id: definition.name,
                kind: 'pipeline-prompt',
                description: definition.description,
                contentFile: `pipeline-prompts/${definition.name}.md`,
                createdAt: now,
                updatedAt: now,
              });
            }
            // WHAT: create System metadata only when the mandatory prompt has no owner record.
            // WHY: startup must preserve existing favorites, tags, and execution defaults.
            if (!skillLibrary.some((record) => record.skillName === definition.name)) {
              skillLibrary.push({
                skillName: definition.name,
                favorite: false,
                tags: ['System'],
                defaultCodexModel: null,
                defaultCodexEffort: null,
                updatedAt: now,
              });
            }
          }
          return { ...store, authoredContent, skillLibrary };
        },
      });
    }
    commitBootstrap({ decisionOsRoot, paths: relativePaths });
    return { createdPromptIds, registeredPromptIds };
  } catch (error) {
    for (const file of createdFiles) rmSync(file, { force: true });
    // WHAT: restore registration bytes only when this attempt could have changed them.
    // WHY: unrelated healthy stores must remain untouched after a file-creation failure.
    if (storeMutationRequired && (storeExisted || existsSync(storeFile))) {
      restoreRegistrationBytes({ decisionOsRoot, existed: storeExisted, bytes: storeBytes });
    }
    try {
      git({
        decisionOsRoot,
        args: ['restore', '--staged', '--', ...relativePaths],
        operation: 'unstage-rollback',
      });
    } catch {}
    throw error;
  }
}
