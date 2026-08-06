/**
 * WHAT: Performs one no-fast-forward dev-to-main merge while preserving the admitted main gitlink.
 * WHY: Standalone promotion and production delivery must resolve the protected Decision OS boundary identically.
 */
export type ProtectedMergeCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export type ProtectedMergeExecutor = (
  args: readonly string[],
  acceptedStatuses?: readonly number[],
  operation?: string,
) => Promise<ProtectedMergeCommandResult>;

export type ProtectedMergeReceipt = {
  mainSha: string;
  mergeParents: [string, string];
  protectedGitlink: string;
};

export class ProtectedMergeError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ProtectedMergeError';
  }
}

const protectedConflict = 'CONFLICT (submodule): Merge conflict in .decision-os';

export function protectedMergeConflicts(result: ProtectedMergeCommandResult): string[] {
  return `${result.stdout}\n${result.stderr}`
    .split('\n')
    .filter((line) => line.startsWith('CONFLICT'));
}

export function unownedProtectedMergeConflicts(result: ProtectedMergeCommandResult): string[] {
  return protectedMergeConflicts(result).filter((line) => line !== protectedConflict);
}

export function assertProtectedMergeSimulation(result: ProtectedMergeCommandResult): void {
  const conflicts = protectedMergeConflicts(result);
  const unexpected = unownedProtectedMergeConflicts(result);
  // WHAT: Reject every simulated conflict outside the exact Decision OS gitlink.
  // WHY: The shared merge boundary owns no source-code resolution policy.
  if (unexpected.length > 0) {
    throw new ProtectedMergeError('protected_merge_source_conflict', `Dev cannot be promoted automatically: ${unexpected.join(' | ')}.`);
  }
  // WHAT: Reject a failed simulation that produced no classified conflict.
  // WHY: An unexplained merge-tree failure cannot authorize a repository mutation.
  if (result.status !== 0 && conflicts.length === 0) {
    throw new ProtectedMergeError('protected_merge_simulation_failed', (result.stderr || result.stdout).trim());
  }
}

export async function mergeDevPreservingMainGitlink(input: {
  devSha: string;
  execute: ProtectedMergeExecutor;
  protectedGitlink: string;
}): Promise<ProtectedMergeReceipt> {
  const simulation = await input.execute(
    ['merge-tree', '--write-tree', 'HEAD', input.devSha],
    [0, 1],
    'simulate_protected_merge',
  );
  assertProtectedMergeSimulation(simulation);
  const priorMainSha = (await input.execute(['rev-parse', 'HEAD'], [0], 'read_prior_main_sha')).stdout.trim();
  let mergeStarted = false;
  try {
    mergeStarted = true;
    await input.execute(['merge', '--no-commit', '--no-ff', input.devSha], [0, 1], 'merge_release');
    await input.execute(
      ['restore', '--source=HEAD', '--staged', '--worktree', '--', '.decision-os'],
      [0],
      'restore_protected_gitlink',
    );
    const conflicts = (await input.execute(
      ['diff', '--name-only', '--diff-filter=U'],
      [0],
      'read_unmerged_paths',
    )).stdout.trim();
    // WHAT: Reject unresolved paths remaining after the protected gitlink restoration.
    // WHY: Only the exact Decision OS gitlink conflict is owned by this transaction.
    if (conflicts) {
      throw new ProtectedMergeError('protected_merge_runtime_conflict', `Merge contains unresolved paths: ${conflicts.split('\n').join(', ')}.`);
    }
    const stagedGitlink = (await input.execute(
      ['rev-parse', ':.decision-os'],
      [0],
      'read_staged_gitlink',
    )).stdout.trim();
    // WHAT: Require the staged merge tree to retain the admitted main gitlink.
    // WHY: Dev-owned Decision OS history must never replace the main-owned snapshot.
    if (stagedGitlink !== input.protectedGitlink) {
      throw new ProtectedMergeError('protected_merge_gitlink_changed', `The staged merge changed .decision-os from ${input.protectedGitlink} to ${stagedGitlink}.`);
    }
    await input.execute([
      'commit',
      '-m', 'Merge dev into main',
      '-m', 'WHAT: Merge the admitted dev parent-repository revision into main.\nWHY: Promote dev source while preserving main-owned Decision OS state.',
    ], [0], 'commit_protected_merge');
    mergeStarted = false;
    const mainSha = (await input.execute(['rev-parse', 'HEAD'], [0], 'read_merge_sha')).stdout.trim();
    const parents = (await input.execute(
      ['show', '-s', '--format=%P', mainSha],
      [0],
      'read_merge_parents',
    )).stdout.trim().split(' ');
    // WHAT: Require the canonical no-fast-forward merge parent order.
    // WHY: The receipt must bind the result to the admitted main and dev commits.
    if (parents.length !== 2 || parents[0] !== priorMainSha || parents[1] !== input.devSha) {
      throw new ProtectedMergeError('protected_merge_parent_proof_failed', `Unexpected merge parents: ${parents.join(' ')}.`);
    }
    const finalGitlink = (await input.execute(
      ['rev-parse', 'HEAD:.decision-os'],
      [0],
      'read_final_gitlink',
    )).stdout.trim();
    // WHAT: Require the committed merge tree to retain the admitted main gitlink.
    // WHY: Index validation alone cannot prove the final release boundary.
    if (finalGitlink !== input.protectedGitlink) {
      throw new ProtectedMergeError('protected_merge_final_gitlink_changed', `The final merge changed .decision-os from ${input.protectedGitlink} to ${finalGitlink}.`);
    }
    return {
      mainSha,
      mergeParents: [parents[0], parents[1]],
      protectedGitlink: finalGitlink,
    };
  } catch (error) {
    // WHAT: Abort only an uncommitted merge started by this transaction.
    // WHY: A rejected protected merge must not leave repository operation state behind.
    if (mergeStarted) await input.execute(['merge', '--abort'], [0, 1, 128], 'abort_protected_merge');
    throw error;
  }
}
