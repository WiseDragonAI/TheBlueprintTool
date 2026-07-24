/**
 * WHAT: Runs explicit post-convergence execution artifact collection for one project.
 * WHY: Destructive byte cleanup requires an operator-provided retention cutoff and a recorded converged root.
 */
import { resolve } from 'node:path';
import { collectExecutionArtifacts } from '../business/task-state/helper/collect-execution-artifacts.js';
import { createTaskCurrentStateStore } from '../business/task-state/helper/task-current-state-store.js';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? '') : '';
}

const decisionOsRootArgument = argument('--decision-os-root');
const projectId = argument('--project-id');
const nodeId = argument('--node-id');
const eligibleBefore = argument('--eligible-before');
const convergedRoot = argument('--converged-root').toLowerCase();
const offlineConfirmed = process.argv.includes('--offline-confirmed');
if (!decisionOsRootArgument || !projectId || !nodeId || !eligibleBefore || !convergedRoot || !offlineConfirmed) {
  throw new Error('Usage: collect-execution-artifacts --decision-os-root <path> --project-id <id> --node-id <id> --eligible-before <ISO-8601> --converged-root <sha256> --offline-confirmed');
}

const decisionOsRoot = resolve(decisionOsRootArgument);
const store = createTaskCurrentStateStore({ decisionOsRoot, projectId });
const report = await collectExecutionArtifacts({
  store,
  decisionOsRoot,
  projectId,
  nodeId,
  eligibleBefore,
  convergedRoot,
});
process.stdout.write(`${JSON.stringify(report)}\n`);
