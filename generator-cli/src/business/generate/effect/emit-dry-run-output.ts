/**
 * WHAT: Dry-run output effect.
 * WHY: dry-run mode must print planned files, imports, graph, and generation output without writes.
 */
import type { WorktreePlan } from '../../../lib/types.js';

export function emitDryRunOutput(plan: WorktreePlan, write: (message: string) => void = console.log): void {
  write(
    JSON.stringify(
      {
        worktreePath: plan.worktreePath,
        files: [
          ...plan.sourceFiles.map((file) => file.path),
          ...plan.unitTestFiles.map((file) => file.path),
          ...plan.integrationTestFiles.map((file) => file.path),
          plan.telemetryHarness.path,
          plan.graphOutput.path,
          plan.reportConfig.path,
        ],
      },
      null,
      2,
    ),
  );
}
