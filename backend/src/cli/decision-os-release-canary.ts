/**
 * WHAT: Parses the fixed release-canary CLI and owns its immutable snapshot and manifest boundary.
 * WHY: Canary proof needs one source-defined command that cannot redirect Git, state, Worker, relay, or cleanup authority.
 */
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createReleaseCanarySnapshot,
  recordReleaseCanaryProofComplete,
  type ReleaseCanaryManifest,
} from '../business/delivery/helper/release-canary-harness.js';
import { proveReleaseCanaryGitSandbox, type ReleaseCanaryGitReceipt } from '../business/delivery/helper/release-canary-git-sandbox.js';
import { proveReleaseCanaryDelivery, type ReleaseCanaryDeliveryProof } from '../business/delivery/helper/release-canary-delivery-proof.js';
import {
  cleanupReleaseCanaryCompletedRun,
  proveReleaseCanaryCompletedPhases,
  type ReleaseCanaryCompletedPhases,
} from '../business/delivery/helper/release-canary-proof-orchestrator.js';

type ReleaseBump = 'maj' | 'min' | 'fix';
const requiredProofPhases = [
  'snapshot',
  'canonical-release',
  'delivery-success',
  'delivery-resume',
  'delivery-rollback',
  'watcher-recovery',
  'worker-runtime',
  'termux-runtime',
  'reconnect-quiescence',
  'incident-recovery',
  'cleanup-readiness',
] as const;
type ReleaseCanaryProofPhase = typeof requiredProofPhases[number];
type ReleaseCanaryPhaseEvidence = { receiptFile: string; receiptId: string };

export type ReleaseCanaryCliCommand =
  | { command: 'prove'; bump: ReleaseBump; json: true }
  | { command: 'cleanup'; runId: string; json: true };

export type ReleaseCanaryProofReceipt = {
  ok: boolean;
  command: 'prove';
  status: 'snapshot-ready' | 'release-proven' | 'proof-complete';
  runId: string;
  receiptId: string;
  candidateSha: string;
  bump: ReleaseBump;
  manifestFile: string;
  sourceInventory: {
    digest: string;
    fileCount: number;
    byteCount: number;
  };
  release: ReleaseCanaryGitReceipt | null;
  phases: Record<ReleaseCanaryProofPhase, ReleaseCanaryPhaseEvidence | null>;
};

export type ReleaseCanaryCliRuntime = {
  prove(bump: ReleaseBump): Promise<ReleaseCanaryProofReceipt>;
  cleanup(runId: string): Promise<{ cleaned: boolean; runId: string; status: 'cleaned' | 'external-worker-drift' }>;
};

export class ReleaseCanaryCliError extends Error {
  constructor(readonly code: string, message: string, readonly exitCode: 2 | 3 | 4 = 3) {
    super(message);
    this.name = 'ReleaseCanaryCliError';
  }
}

function optionMap(argv: readonly string[]): Map<string, string | true> {
  const values = new Map<string, string | true>();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = String(argv[index] ?? '');
    // WHAT: Reject positional and non-option input after the command.
    // WHY: The canary must expose no hidden path, ref, endpoint, or identity selector.
    if (!argument.startsWith('--')) throw new ReleaseCanaryCliError('release_canary_cli_usage', `Unsupported positional argument: ${argument}.`, 2);
    // WHAT: Reject duplicate options.
    // WHY: A single canonical value must own each admitted input.
    if (values.has(argument)) throw new ReleaseCanaryCliError('release_canary_cli_usage', `Duplicate option: ${argument}.`, 2);
    // WHAT: Treat JSON as the only valueless option.
    // WHY: Machine-readable receipts are mandatory for admission evidence.
    if (argument === '--json') {
      values.set(argument, true);
      continue;
    }
    const value = String(argv[++index] ?? '');
    // WHAT: Reject missing option values.
    // WHY: Empty selectors must never fall back to inferred external authority.
    if (!value || value.startsWith('--')) throw new ReleaseCanaryCliError('release_canary_cli_usage', `${argument} requires a value.`, 2);
    values.set(argument, value);
  }
  return values;
}

function exactOptions(values: Map<string, string | true>, allowed: readonly string[]): void {
  const unsupported = [...values.keys()].find((key) => !allowed.includes(key));
  // WHAT: Reject every option outside the fixed command contract.
  // WHY: Canary callers cannot choose paths, refs, endpoints, Workers, namespaces, ports, or credentials.
  if (unsupported) throw new ReleaseCanaryCliError('release_canary_cli_usage', `Unsupported canary option: ${unsupported}.`, 2);
  // WHAT: Require JSON output.
  // WHY: Proof and cleanup need durable machine-verifiable receipts.
  if (values.get('--json') !== true) throw new ReleaseCanaryCliError('release_canary_cli_json_required', '--json is required.', 2);
}

export function parseDecisionOsReleaseCanaryArguments(argv: readonly string[]): ReleaseCanaryCliCommand {
  const command = String(argv[0] ?? '');
  const values = optionMap(argv);
  // WHAT: Admit proof with one canonical SemVer bump token.
  // WHY: The sandbox must exercise the unchanged promotion CLI contract without accepting a release identity override.
  if (command === 'prove') {
    exactOptions(values, ['--bump', '--json']);
    const bump = String(values.get('--bump') ?? '');
    // WHAT: Accept only the three bump tokens implemented by decision-os-merge-dev.
    // WHY: A free-form tag would bypass canonical paired-tag inference.
    if (bump !== 'maj' && bump !== 'min' && bump !== 'fix') {
      throw new ReleaseCanaryCliError('release_canary_bump_invalid', '--bump must be maj, min, or fix.', 2);
    }
    return { command, bump, json: true };
  }
  // WHAT: Admit cleanup with one manifest identity.
  // WHY: Cleanup targets are resolved only from the fixed run store.
  if (command === 'cleanup') {
    exactOptions(values, ['--run-id', '--json']);
    const runId = String(values.get('--run-id') ?? '');
    // WHAT: Reject path-like cleanup identities at the CLI boundary.
    // WHY: Operators cannot redirect deletion outside a manifest-owned run.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(runId)) {
      throw new ReleaseCanaryCliError('release_canary_run_id_invalid', '--run-id is invalid.', 2);
    }
    return { command, runId, json: true };
  }
  throw new ReleaseCanaryCliError('release_canary_cli_usage', 'Command must be prove or cleanup.', 2);
}

function gitHead(repositoryRoot: string): string {
  const result = spawnSync('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  const candidateSha = String(result.stdout ?? '').trim();
  // WHAT: Require an exact current-checkout commit without mutating or fetching Git.
  // WHY: The proof receipt must bind to the reviewed candidate source.
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(candidateSha)) {
    throw new ReleaseCanaryCliError('release_canary_candidate_sha_unavailable', 'Current candidate Git identity is unavailable.', 3);
  }
  return candidateSha;
}

function settingsOwnedCanaryContext(catalogRoot: string): { masterRoot: string; primaryRepositoryRoot: string } {
  const settingsFile = resolve(catalogRoot, '.decision-os', '.settings.json');
  let settings: Record<string, unknown>;
  try {
    const value = JSON.parse(readFileSync(settingsFile, 'utf8')) as unknown;
    // WHAT: Accept only a settings object.
    // WHY: The harness cannot infer live state authority from an invalid document.
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    settings = value as Record<string, unknown>;
  } catch {
    throw new ReleaseCanaryCliError('release_canary_settings_invalid', 'Catalog delivery settings are unavailable or invalid.', 3);
  }
  const masterRoot = String(settings.deliveryDecisionOsRoot ?? '');
  // WHAT: Require the settings-owned absolute Decision OS root.
  // WHY: CLI flags and repository discovery must not select production state.
  if (!isAbsolute(masterRoot)) {
    throw new ReleaseCanaryCliError('release_canary_master_root_invalid', 'deliveryDecisionOsRoot must be an absolute path.', 3);
  }
  const resolved = resolve(masterRoot);
  // WHAT: Require the resolved settings file to describe the same master root.
  // WHY: A project-local settings file cannot redirect the live catalog snapshot.
  if (resolved !== resolve(catalogRoot, '.decision-os')) {
    throw new ReleaseCanaryCliError('release_canary_catalog_authority_mismatch', 'deliveryDecisionOsRoot does not match the invoking catalog root.', 3);
  }
  const primaryRepositoryRoot = String(settings.deliveryRepositoryRoot ?? '');
  // WHAT: Require the settings-owned primary repository as the sole credential and env.dev lock authority.
  // WHY: A published checkout has no copied secrets and must not infer another repository from its filesystem location.
  if (!isAbsolute(primaryRepositoryRoot)) {
    throw new ReleaseCanaryCliError('release_canary_repository_authority_invalid', 'deliveryRepositoryRoot must be an absolute path.', 3);
  }
  return { masterRoot: resolved, primaryRepositoryRoot: resolve(primaryRepositoryRoot) };
}

function receiptForSnapshot(input: {
  manifest: ReleaseCanaryManifest;
  candidateSha: string;
  bump: ReleaseBump;
  release?: ReleaseCanaryGitReceipt;
  delivery?: ReleaseCanaryDeliveryProof;
  completed?: ReleaseCanaryCompletedPhases;
}): ReleaseCanaryProofReceipt {
  const snapshotPhaseFile = resolve(input.manifest.runRoot, 'snapshot-phase-receipt.json');
  const snapshotPhaseBytes = `${JSON.stringify({
    phase: 'snapshot',
    status: 'passed',
    evidence: {
      sourceInventory: input.manifest.sourceInventory,
      copiedInventory: input.manifest.copiedInventory,
      projectCount: input.manifest.projectCount,
    },
  }, null, 2)}\n`;
  writeFileSync(snapshotPhaseFile, snapshotPhaseBytes, { mode: 0o600 });
  const phases: Record<ReleaseCanaryProofPhase, ReleaseCanaryPhaseEvidence | null> = {
    snapshot: {
      receiptFile: snapshotPhaseFile,
      receiptId: `sha256:${createHash('sha256').update(snapshotPhaseBytes).digest('hex')}`,
    },
    'canonical-release': input.release ? { receiptFile: input.release.receiptFile, receiptId: input.release.receiptId } : null,
    'delivery-success': input.delivery?.['delivery-success'] ?? null,
    'delivery-resume': input.delivery?.['delivery-resume'] ?? null,
    'delivery-rollback': input.delivery?.['delivery-rollback'] ?? null,
    'watcher-recovery': input.completed?.['watcher-recovery'] ?? null,
    'worker-runtime': input.completed?.['worker-runtime'] ?? null,
    'termux-runtime': input.completed?.['termux-runtime'] ?? null,
    'reconnect-quiescence': input.completed?.['reconnect-quiescence'] ?? null,
    'incident-recovery': input.completed?.['incident-recovery'] ?? null,
    'cleanup-readiness': input.completed?.['cleanup-readiness'] ?? null,
  };
  const receiptDocument = {
    candidateSha: input.candidateSha,
    bump: input.bump,
    runId: input.manifest.runId,
    sourceInventory: input.manifest.sourceInventory,
    copiedInventory: input.manifest.copiedInventory,
    release: input.release ?? null,
    delivery: input.delivery ?? null,
    completed: input.completed ?? null,
    phases,
  };
  const receiptId = `sha256:${createHash('sha256').update(JSON.stringify(receiptDocument)).digest('hex')}`;
  const receipt: ReleaseCanaryProofReceipt = {
    ok: Boolean(input.completed),
    command: 'prove',
    status: input.completed ? 'proof-complete' : input.release ? 'release-proven' : 'snapshot-ready',
    runId: input.manifest.runId,
    receiptId,
    candidateSha: input.candidateSha,
    bump: input.bump,
    manifestFile: input.manifest.manifestFile,
    sourceInventory: {
      digest: input.manifest.sourceInventory.digest,
      fileCount: input.manifest.sourceInventory.fileCount,
      byteCount: input.manifest.sourceInventory.byteCount,
    },
    release: input.release ?? null,
    phases,
  };
  writeFileSync(resolve(input.manifest.runRoot, 'snapshot-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return receipt;
}

export function createDefaultReleaseCanaryCliRuntime(input: {
  repositoryRoot: string;
  catalogRoot: string;
  proveCompletedPhases?: typeof proveReleaseCanaryCompletedPhases;
}): ReleaseCanaryCliRuntime {
  const repositoryRoot = resolve(input.repositoryRoot);
  const catalogRoot = resolve(input.catalogRoot);
  return {
    async prove(bump) {
      const candidateSha = gitHead(repositoryRoot);
      const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
      const canaryContext = settingsOwnedCanaryContext(catalogRoot);
      let manifest: ReleaseCanaryManifest;
      try {
        manifest = createReleaseCanarySnapshot({
          repositoryRoot,
          sourceMasterRoot: canaryContext.masterRoot,
          runId,
        });
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : 'release_canary_snapshot_failed';
        throw new ReleaseCanaryCliError(code, `${error instanceof Error ? error.message : String(error)} Retained run ID: ${runId}.`, 4);
      }
      const release = await proveReleaseCanaryGitSandbox({
        repositoryRoot,
        runId: manifest.runId,
        bump,
      });
      // WHAT: Require the snapshot and release sandbox to bind the same candidate HEAD.
      // WHY: A source ref change between phases invalidates the consolidated proof.
      if (release.candidateSha !== candidateSha) {
        throw new ReleaseCanaryCliError('release_canary_candidate_changed', 'Candidate Git identity changed during proof.', 4);
      }
      const delivery = await proveReleaseCanaryDelivery({
        runRoot: manifest.runRoot,
        release,
      });
      const completed = await (input.proveCompletedPhases ?? proveReleaseCanaryCompletedPhases)({
        repositoryRoot,
        primaryRepositoryRoot: canaryContext.primaryRepositoryRoot,
        manifest,
        release,
      });
      recordReleaseCanaryProofComplete({ repositoryRoot, runId: manifest.runId });
      return receiptForSnapshot({ manifest, candidateSha, bump, release, delivery, completed });
    },
    async cleanup(runId) {
      const canaryContext = settingsOwnedCanaryContext(catalogRoot);
      return await cleanupReleaseCanaryCompletedRun({
        repositoryRoot,
        primaryRepositoryRoot: canaryContext.primaryRepositoryRoot,
        runId,
      });
    },
  };
}

export async function runDecisionOsReleaseCanaryCli(input: {
  argv: readonly string[];
  runtime: ReleaseCanaryCliRuntime;
  write?: (value: string) => void;
}): Promise<number> {
  const parsed = parseDecisionOsReleaseCanaryArguments(input.argv);
  const write = input.write ?? ((value) => process.stdout.write(value));
  // WHAT: Execute the fixed proof runtime for the selected canonical bump.
  // WHY: The runtime, not operator inputs, owns all state and deployment targets.
  if (parsed.command === 'prove') {
    const receipt = await input.runtime.prove(parsed.bump);
    const runRoot = dirname(receipt.manifestFile);
    const complete = requiredProofPhases.every((phase) => {
      try {
        const evidence = receipt.phases[phase];
        // WHAT: Reject a missing or malformed phase pointer.
        // WHY: A hash string without its exact evidence artifact cannot prove behavior.
        if (!evidence || !/^sha256:[a-f0-9]{64}$/.test(evidence.receiptId)) return false;
        const receiptFile = resolve(evidence.receiptFile);
        const relation = relative(runRoot, receiptFile);
        // WHAT: Require an ordinary evidence file inside the manifest-owned run root.
        // WHY: Symlinks and external paths could substitute unrelated proof bytes.
        if (relation.startsWith('..') || isAbsolute(relation) || !lstatSync(receiptFile).isFile() || lstatSync(receiptFile).isSymbolicLink()) return false;
        const bytes = readFileSync(receiptFile);
        // WHAT: Require the receipt ID to hash the exact retained artifact bytes.
        // WHY: Evidence identity must change with every content change.
        if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== evidence.receiptId) return false;
        const document = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
        return document.phase === phase && document.status === 'passed' && Object.hasOwn(document, 'evidence');
      } catch {
        return false;
      }
    });
    // WHAT: Reject a runtime success claim until every accepted proof phase has hash-bound evidence.
    // WHY: Snapshot and release setup must never be reported as deployed, flood-free, repaired, and clean.
    if ((receipt.ok || receipt.status === 'proof-complete') && !complete) {
      throw new ReleaseCanaryCliError('release_canary_proof_incomplete', 'Canary runtime claimed success without every required proof phase.', 4);
    }
    write(`${JSON.stringify(receipt)}\n`);
    return receipt.ok && receipt.status === 'proof-complete' && complete ? 0 : 4;
  }
  const receipt = await input.runtime.cleanup(parsed.runId);
  write(`${JSON.stringify({ ok: receipt.cleaned, command: 'cleanup', ...receipt })}\n`);
  return receipt.cleaned ? 0 : 4;
}

async function main(): Promise<void> {
  try {
    const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../../../..');
    process.exitCode = await runDecisionOsReleaseCanaryCli({
      argv: process.argv.slice(2),
      runtime: createDefaultReleaseCanaryCliRuntime({ repositoryRoot, catalogRoot: process.cwd() }),
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'release_canary_failed';
    const requestedExit = error && typeof error === 'object' && 'exitCode' in error
      ? Number((error as { exitCode?: unknown }).exitCode)
      : Number.NaN;
    const exitCode = requestedExit === 2 || requestedExit === 3 || requestedExit === 4 ? requestedExit : 3;
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: code,
      message: error instanceof Error ? error.message : String(error),
    })}\n`);
    process.exitCode = exitCode;
  }
}

// WHAT: Run the command only when this module is the process entrypoint.
// WHY: Tests import the parser and runtime without executing filesystem mutations.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
