/**
 * WHAT: generated worktree apply controller.
 * WHY: apply mode materializes source, tests, telemetry harness, graph, and report configuration.
 */
import type { FileSystemPort, ProcessPort, Result, WorktreePlan } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { buildTestStateContracts } from '../../test/helper/build-test-state-contracts.js';
import { injectTelemetryCalls } from '../../telemetry/helper/inject-telemetry-calls.js';
import { planGeneratedWorktreeController } from './plan-generated-worktree.js';
import { createGitWorktree } from '../effect/create-git-worktree.js';
import { writePlanFiles } from '../effect/write-generated-files.js';

export async function applyGeneratedWorktreeController(
  input: {
    masterLedgerFile: string;
    output: string;
  },
  ports: { fs?: FileSystemPort; process?: ProcessPort; cwd?: string } = {},
): Promise<Result<WorktreePlan>> {
  const planned = await planGeneratedWorktreeController({ mode: 'apply', masterLedgerFile: input.masterLedgerFile, output: input.output }, ports.fs);

  // WHY: apply cannot continue without a valid generation plan.
  // WHAT: return the planning failure.
  if (!planned.ok) {
    return planned;
  }

  const worktree = await createGitWorktree(planned.value.worktreePath, ports);
  telemetry('create-git-worktree', worktree);

  // WHY: generated files must be written inside a real git worktree.
  // WHAT: stop when worktree creation fails.
  if (!worktree.ok) {
    return { ok: false, error: worktree.error };
  }

  buildTestStateContracts(planned.value.functions);
  telemetry('build-test-state-contracts');
  const injected = injectTelemetryCalls(planned.value.sourceFiles);
  telemetry('inject-telemetry-calls');

  // WHY: generated source files without telemetry cannot prove execution.
  // WHAT: stop before writing invalid generated files.
  if (!injected.ok) {
    return injected;
  }

  await writePlanFiles(planned.value, ports.fs);
  telemetry('write-source-file', { count: planned.value.sourceFiles.length });
  telemetry('write-unit-test-file', { count: planned.value.unitTestFiles.length });
  telemetry('write-integration-test-file', { count: planned.value.integrationTestFiles.length });
  telemetry('write-telemetry-harness');
  telemetry('write-dependency-graph-output');
  return planned;
}
