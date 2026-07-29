/**
 * WHAT: Admits one clean committed pipeline-prompt snapshot and validates transported snapshots.
 * WHY: Pipeline-only instructions must cross local and remote execution solely as immutable run evidence.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type {
  CodexPipelineStep,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { resolveRepositoryContext } from '../../content-authoring/helper/repository-mutation-lock.js';
import { runBoundedProcess, type BoundedProcessResult } from '../../process/helper/run-bounded-process.js';
import {
  codexPipelineStoreWriteBlocker,
  normalizeCodexPipelineStore,
  pipelineStoreFile,
} from './codex-pipeline-store.js';
import {
  expandPipelinePromptTemplates,
  pipelinePromptFile,
  pipelinePromptRoot,
  pipelinePromptRuntimeVariables,
  pipelinePromptTemplateVariables,
  validatePipelinePromptMarkdown,
} from './pipeline-prompt-library.js';

type AnyRecord = Record<string, unknown>;

export const maximumPipelinePromptSnapshotBytes = 1_000_000;

export type AdmittedPipelinePromptSnapshot = {
  contentKind: 'pipeline-prompt';
  contentRevision: string;
  contentCommit: string;
  promptSnapshot: string;
};

export class PipelinePromptAdmissionError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message = code,
  ) {
    super(message === code ? code : `${code}: ${message}`);
    this.name = 'PipelinePromptAdmissionError';
  }
}

function contained(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function decodePrompt(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_malformed',
      400,
      'Pipeline prompt Markdown must be valid UTF-8.',
    );
  }
}

function assertSnapshotShape(input: {
  contentKind?: unknown;
  contentRevision?: unknown;
  contentCommit?: unknown;
  promptSnapshot?: unknown;
}): asserts input is AdmittedPipelinePromptSnapshot {
  if (input.contentKind !== 'pipeline-prompt') {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_kind_mismatch',
      400,
      'Pipeline prompt snapshot kind does not match its run skill.',
    );
  }
  if (typeof input.promptSnapshot !== 'string' || !input.promptSnapshot.trim()) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_missing',
      400,
      'Pipeline prompt snapshot is missing.',
    );
  }
  const bytes = Buffer.from(input.promptSnapshot, 'utf8');
  if (bytes.byteLength > maximumPipelinePromptSnapshotBytes) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_oversized',
      400,
      'Pipeline prompt snapshot exceeds the 1,000,000 byte limit.',
    );
  }
  if (bytes.toString('utf8') !== input.promptSnapshot) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_malformed',
      400,
      'Pipeline prompt snapshot must be valid UTF-8.',
    );
  }
  if (
    typeof input.contentRevision !== 'string'
    || !/^[a-f0-9]{64}$/.test(input.contentRevision)
    || sha256(bytes) !== input.contentRevision
  ) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_revision_mismatch',
      400,
      'Pipeline prompt snapshot does not match its admitted SHA-256 revision.',
    );
  }
  if (typeof input.contentCommit !== 'string' || !/^[a-f0-9]{40,64}$/.test(input.contentCommit)) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_commit_invalid',
      400,
      'Pipeline prompt snapshot has no valid owning Git commit.',
    );
  }
}

export function assertPipelinePromptRunSkillSnapshot(
  skill: {
    contentKind?: unknown;
    contentRevision?: unknown;
    contentCommit?: unknown;
    promptSnapshot?: unknown;
  },
): asserts skill is AdmittedPipelinePromptSnapshot {
  assertSnapshotShape(skill);
}

export function assertPipelineRunSkillPromptEvidence(skill: {
  contentKind?: unknown;
  contentRevision?: unknown;
  contentCommit?: unknown;
  promptSnapshot?: unknown;
}): void {
  if (skill.contentKind === 'pipeline-prompt') {
    assertSnapshotShape(skill);
    return;
  }
  if (skill.contentKind !== 'federated-skill' && skill.contentKind !== 'workspace-skill') {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_kind_mismatch',
      400,
      'Pipeline run skill content kind is missing or invalid.',
    );
  }
  if (skill.contentRevision !== undefined || skill.contentCommit !== undefined || skill.promptSnapshot !== undefined) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_snapshot_kind_mismatch',
      400,
      'Pipeline prompt snapshot evidence is attached to a non-prompt run skill.',
    );
  }
}

async function git(input: {
  cwd: string;
  args: string[];
  operation: string;
  signal?: AbortSignal;
  maximumOutputBytes?: number;
}): Promise<BoundedProcessResult> {
  return await runBoundedProcess({
    command: 'git',
    args: input.args,
    cwd: input.cwd,
    deadlineMs: 20_000,
    signal: input.signal,
    maximumOutputBytes: input.maximumOutputBytes ?? 1024 * 1024,
    context: { component: 'pipeline-prompt-admission', operation: input.operation },
  });
}

function gitFailure(result: BoundedProcessResult): string {
  return (
    result.stderr.trim()
    || result.stdout.trim()
    || result.spawnError
    || result.termination
    || `exit ${result.exitCode}`
  ).slice(0, 1_000);
}

async function requiredGit(input: Parameters<typeof git>[0]): Promise<string> {
  const result = await git(input);
  if (!result.ok || result.stdoutTruncatedBytes > 0 || result.stderrTruncatedBytes > 0) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_git_unavailable',
      503,
      `Pipeline prompt Git admission failed during ${input.operation}: ${gitFailure(result)}.`,
    );
  }
  return result.stdout.trim();
}

function safeRegularFile(file: string, missingCode: string): void {
  if (!existsSync(file)) {
    throw new PipelinePromptAdmissionError(missingCode, 409, 'Pipeline prompt admission content is missing.');
  }
  const status = lstatSync(file);
  if (status.isSymbolicLink()) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_symlink_rejected',
      400,
      'Pipeline prompt admission does not accept symlinked content.',
    );
  }
  if (!status.isFile()) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_path_invalid',
      400,
      'Pipeline prompt admission content must be a regular file.',
    );
  }
}

function samePipelinePromptRegistration(left: AnyRecord | undefined, right: AnyRecord | undefined): boolean {
  return Boolean(
    left
    && right
    && left.id === right.id
    && left.kind === 'pipeline-prompt'
    && right.kind === 'pipeline-prompt'
    && left.description === right.description
    && left.contentFile === right.contentFile
    && left.createdAt === right.createdAt
    && left.updatedAt === right.updatedAt,
  );
}

export async function admitPipelinePromptSnapshots(input: {
  ownerDecisionOsRoot: string;
  steps: readonly CodexPipelineStep[];
  signal?: AbortSignal;
  /** Test-only race injection after exact bytes are captured and before Git identity is resolved. */
  beforeGitValidation?: (context: { name: string; promptFile: string; storeFile: string }) => void | Promise<void>;
}): Promise<Map<string, AdmittedPipelinePromptSnapshot>> {
  const requestedPromptNames = [...new Set(input.steps
    .flatMap((step) => step.skills)
    .filter((skill) => skill.contentKind === 'pipeline-prompt')
    .map((skill) => skill.skillName))];
  const promptNames = [...requestedPromptNames];
  const queuedPromptNames = new Set(promptNames);
  const admitted = new Map<string, AdmittedPipelinePromptSnapshot>();
  if (promptNames.length === 0) return admitted;

  const ownerDecisionOsRoot = resolve(input.ownerDecisionOsRoot);
  const storeFile = pipelineStoreFile(ownerDecisionOsRoot);
  safeRegularFile(storeFile, 'pipeline_prompt_store_missing');
  const storeBytes = readFileSync(storeFile);
  let rawStore: AnyRecord;
  try {
    rawStore = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(storeBytes)) as AnyRecord;
  } catch {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_store_malformed',
      503,
      'Pipeline prompt registration store is malformed.',
    );
  }
  if (rawStore.version !== 2) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_store_version_invalid',
      503,
      'Pipeline prompt registration requires pipeline store version 2.',
    );
  }
  const normalized = normalizeCodexPipelineStore(rawStore);
  const blocker = codexPipelineStoreWriteBlocker(normalized);
  if (blocker) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_store_malformed',
      503,
      `Pipeline prompt registration store is invalid: ${blocker.message}`,
    );
  }

  const root = pipelinePromptRoot(ownerDecisionOsRoot);
  if (!existsSync(ownerDecisionOsRoot) || lstatSync(ownerDecisionOsRoot).isSymbolicLink()) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_symlink_rejected',
      400,
      'Pipeline prompt owner storage cannot be a symlink.',
    );
  }
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) {
    throw new PipelinePromptAdmissionError(
      existsSync(root) ? 'pipeline_prompt_symlink_rejected' : 'pipeline_prompt_missing',
      existsSync(root) ? 400 : 409,
      'Pipeline prompt storage is missing or symlinked.',
    );
  }
  const canonicalOwner = realpathSync(ownerDecisionOsRoot);
  const canonicalRoot = realpathSync(root);
  if (!contained(canonicalOwner, canonicalRoot)) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_path_escape',
      400,
      'Pipeline prompt storage resolves outside its registered owner.',
    );
  }

  const context = await resolveRepositoryContext(ownerDecisionOsRoot, input.signal).catch((error) => {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_git_unavailable',
      503,
      error instanceof Error ? error.message : String(error),
    );
  });
  const storePath = relative(context.root, storeFile).split('\\').join('/');
  if (!contained(context.root, storeFile)) {
    throw new PipelinePromptAdmissionError(
      'pipeline_prompt_path_escape',
      400,
      'Pipeline prompt registration store resolves outside its repository.',
    );
  }

  for (const name of promptNames) {
    const record = normalized.store.authoredContent.find((entry) => entry.id === name);
    if (!record) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_not_registered',
        409,
        `Pipeline prompt ${name} is not registered.`,
      );
    }
    if (record.kind !== 'pipeline-prompt') {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_kind_mismatch',
        409,
        `Pipeline content ${name} is not registered as a pipeline prompt.`,
      );
    }
    const expectedFile = pipelinePromptFile(ownerDecisionOsRoot, name);
    const registeredFile = resolve(ownerDecisionOsRoot, record.contentFile);
    if (registeredFile !== expectedFile || !contained(canonicalRoot, registeredFile)) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_path_escape',
        400,
        `Pipeline prompt ${name} has an unsafe registered file.`,
      );
    }
    safeRegularFile(registeredFile, 'pipeline_prompt_missing');
    const canonicalFile = realpathSync(registeredFile);
    if (!contained(canonicalRoot, canonicalFile) || canonicalFile !== registeredFile) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_path_escape',
        400,
        `Pipeline prompt ${name} resolves outside its registered owner.`,
      );
    }
    const fileStatus = statSync(registeredFile);
    if (fileStatus.size > maximumPipelinePromptSnapshotBytes) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_oversized',
        400,
        `Pipeline prompt ${name} exceeds the 1,000,000 byte limit.`,
      );
    }
    const promptBytes = readFileSync(registeredFile);
    if (promptBytes.byteLength > maximumPipelinePromptSnapshotBytes) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_oversized',
        400,
        `Pipeline prompt ${name} exceeds the 1,000,000 byte limit.`,
      );
    }
    const promptSnapshot = decodePrompt(promptBytes);
    const markdownValidation = validatePipelinePromptMarkdown(promptSnapshot);
    if (!markdownValidation.ok) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_malformed',
        400,
        'error' in markdownValidation ? markdownValidation.error : 'Pipeline prompt Markdown is malformed.',
      );
    }
    for (const variable of pipelinePromptTemplateVariables(promptSnapshot)) {
      if (pipelinePromptRuntimeVariables.has(variable) || queuedPromptNames.has(variable)) continue;
      queuedPromptNames.add(variable);
      promptNames.push(variable);
    }
    await input.beforeGitValidation?.({ name, promptFile: registeredFile, storeFile });
    const commit = await requiredGit({
      cwd: context.root,
      args: ['rev-parse', '--verify', 'HEAD^{commit}'],
      operation: 'resolve-owning-commit',
      signal: input.signal,
    });
    if (!/^[a-f0-9]{40,64}$/.test(commit)) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_commit_unreachable',
        409,
        'Pipeline prompt owning commit is invalid.',
      );
    }

    const promptPath = relative(context.root, registeredFile).split('\\').join('/');
    if (!contained(context.root, registeredFile)) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_path_escape',
        400,
        `Pipeline prompt ${name} resolves outside its repository.`,
      );
    }
    for (const trackedPath of [promptPath, storePath]) {
      const tracked = await git({
        cwd: context.root,
        args: ['ls-files', '--error-unmatch', '--', trackedPath],
        operation: 'verify-tracked-content',
        signal: input.signal,
      });
      if (!tracked.ok) {
        throw new PipelinePromptAdmissionError(
          'pipeline_prompt_untracked',
          409,
          `Pipeline prompt admission requires tracked content: ${trackedPath}.`,
        );
      }
    }

    const headPrompt = await git({
      cwd: context.root,
      args: ['show', `${commit}:${promptPath}`],
      operation: 'read-committed-prompt',
      signal: input.signal,
      maximumOutputBytes: maximumPipelinePromptSnapshotBytes + 1024,
    });
    const headStore = await git({
      cwd: context.root,
      args: ['show', `${commit}:${storePath}`],
      operation: 'read-committed-prompt-registration',
      signal: input.signal,
      maximumOutputBytes: 16 * 1024 * 1024,
    });
    if (!headPrompt.ok || !headStore.ok) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_uncommitted',
        409,
        `Pipeline prompt ${name} and its registration must exist in HEAD.`,
      );
    }
    if (headPrompt.stdoutTruncatedBytes > 0 || headStore.stdoutTruncatedBytes > 0) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_git_unavailable',
        503,
        'Pipeline prompt committed evidence exceeds the bounded Git output.',
      );
    }

    let committedRecord: AnyRecord | undefined;
    try {
      const committedRaw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(headStore.stdout, 'utf8'))) as AnyRecord;
      const committed = normalizeCodexPipelineStore(committedRaw);
      if (codexPipelineStoreWriteBlocker(committed)) throw new Error('invalid committed pipeline store');
      committedRecord = committed.store.authoredContent.find((entry) => entry.id === name) as AnyRecord | undefined;
    } catch {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_uncommitted',
        409,
        `Pipeline prompt ${name} has no valid registration in HEAD.`,
      );
    }
    if (!samePipelinePromptRegistration(record as AnyRecord, committedRecord)) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_dirty',
        409,
        `Pipeline prompt ${name} registration differs from HEAD.`,
      );
    }

    const clean = await git({
      cwd: context.root,
      args: ['diff', '--quiet', commit, '--', promptPath],
      operation: 'verify-clean-content',
      signal: input.signal,
    });
    if (!clean.ok) {
      if (clean.exitCode === 1 && clean.termination === null && clean.spawnError === null) {
        throw new PipelinePromptAdmissionError(
          'pipeline_prompt_dirty',
          409,
          `Pipeline prompt ${name} differs from HEAD.`,
        );
      }
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_git_unavailable',
        503,
        `Pipeline prompt clean-state verification failed: ${gitFailure(clean)}.`,
      );
    }
    if (!Buffer.from(headPrompt.stdout, 'utf8').equals(promptBytes)
      || !readFileSync(storeFile).equals(storeBytes)) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_stale',
        409,
        `Pipeline prompt ${name} changed during admission.`,
      );
    }
    const reachable = await git({
      cwd: context.root,
      args: ['merge-base', '--is-ancestor', commit, 'HEAD'],
      operation: 'verify-commit-reachability',
      signal: input.signal,
    });
    if (!reachable.ok) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_commit_unreachable',
        409,
        `Pipeline prompt ${name} owning commit is not reachable from HEAD.`,
      );
    }

    const snapshot: AdmittedPipelinePromptSnapshot = {
      contentKind: 'pipeline-prompt',
      contentRevision: sha256(promptBytes),
      contentCommit: commit,
      promptSnapshot,
    };
    assertSnapshotShape(snapshot);
    admitted.set(name, snapshot);
  }
  for (const name of requestedPromptNames) {
    const snapshot = admitted.get(name);
    if (!snapshot) continue;
    let expanded: string;
    try {
      expanded = expandPipelinePromptTemplates({
        markdown: snapshot.promptSnapshot,
        stack: [name],
        resolve: (templateName) => admitted.get(templateName)?.promptSnapshot ?? null,
      });
    } catch (error) {
      throw new PipelinePromptAdmissionError(
        'pipeline_prompt_template_invalid',
        409,
        error instanceof Error ? error.message : String(error),
      );
    }
    const resolved = {
      ...snapshot,
      contentRevision: sha256(expanded),
      promptSnapshot: expanded,
    };
    assertSnapshotShape(resolved);
    admitted.set(name, resolved);
  }
  return admitted;
}
