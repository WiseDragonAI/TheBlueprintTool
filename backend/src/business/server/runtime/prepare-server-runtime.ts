/**
 * WHAT: Owns one deadline-bounded worker for server-wide repository and pipeline startup preparation.
 * WHY: Listener responsiveness requires all synchronous multi-project admission to execute off-thread exactly once.
 */
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import type { DecisionOsProject } from '../helper/project-catalog.js';

export type ServerRuntimePreparationReceipt = {
  version: 1;
  availableSkillNames: string[];
  failures: Array<{
    component: string;
    operation: string;
    error: string;
    stack: string;
  }>;
  ledgerCliShimDirectory: string;
  projectCount: number;
  projects: DecisionOsProject[];
  repositoryCount: number;
};

const preparationDeadlineMs = 120_000;

export function prepareServerRuntime(input: {
  ledgerLauncher: string;
  masterDecisionOsRoot: string;
  masterRoot: string;
  nodeExecutable: string;
  pausedBackgroundComponents: readonly string[];
  signal: AbortSignal;
  webpageLauncher: string;
}): Promise<ServerRuntimePreparationReceipt> {
  return new Promise((resolvePreparation, rejectPreparation) => {
    const workerModule = new URL('./server-runtime-preparation-worker.ts', import.meta.url).href;
    const tsxApi = import.meta.resolve('tsx/esm/api');
    const tsconfig = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url));
    const worker = new Worker(
      `import(${JSON.stringify(tsxApi)}).then(({ register }) => { register({ tsconfig: ${JSON.stringify(tsconfig)} }); return import(${JSON.stringify(workerModule)}); })`,
      { eval: true, execArgv: [] },
    );
    let settled = false;
    const settle = (error?: Error, receipt?: ServerRuntimePreparationReceipt): void => {
      // WHAT: Ignore duplicate worker, timeout, and cancellation settlement.
      // WHY: Exactly one owner may resolve global startup preparation and release its resources.
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      input.signal.removeEventListener('abort', abort);
      void worker.terminate().catch(() => undefined);
      // WHAT: Reject every failed settlement before considering its optional receipt.
      // WHY: Worker errors cannot authorize main-thread runtime construction.
      if (error) rejectPreparation(error);
      else {
        // WHAT: Require one explicit, versioned preparation receipt.
        // WHY: Worker exit alone cannot prove repository and pipeline admission settled.
        if (
          receipt?.version !== 1
          || !receipt.ledgerCliShimDirectory
          || !Array.isArray(receipt.projects)
          || receipt.projectCount !== receipt.projects.length
        ) {
          rejectPreparation(new Error('server_runtime_preparation_receipt_missing'));
          return;
        }
        resolvePreparation(receipt);
      }
    };
    // WHAT: Preserve an explicit shutdown reason and otherwise use the stable server-close code.
    // WHY: Cancellation diagnostics must retain their owning scope without depending on arbitrary signal values.
    const abort = (): void => settle(
      input.signal.reason instanceof Error
        ? input.signal.reason
        : new Error('server_closed'),
    );
    const deadline = setTimeout(() => {
      settle(new Error('server_runtime_preparation_timeout'));
    }, preparationDeadlineMs);
    deadline.unref?.();
    worker.once('message', (message: {
      ok?: boolean;
      receipt?: ServerRuntimePreparationReceipt;
      error?: string;
      stack?: string;
    }) => {
      // WHAT: Admit only the explicit successful worker receipt.
      // WHY: Malformed responses cannot establish prepared global state.
      if (message.ok === true) settle(undefined, message.receipt);
      else {
        const error = new Error(message.error || 'server_runtime_preparation_worker_failed');
        error.stack = message.stack || error.stack;
        settle(error);
      }
    });
    worker.once('error', (error) => settle(error));
    worker.once('exit', (code) => {
      // WHAT: Reject an unsettled worker exit regardless of its numeric status.
      // WHY: Only the explicit receipt proves all global preparation scopes were observed.
      if (!settled) settle(new Error(`server_runtime_preparation_worker_exit:${code}`));
    });
    // WHAT: Cancel before dispatch when server shutdown already owns startup.
    // WHY: A closed listener must not begin repository or pipeline preparation.
    if (input.signal.aborted) {
      abort();
      return;
    }
    input.signal.addEventListener('abort', abort, { once: true });
    worker.postMessage({
      ledgerLauncher: input.ledgerLauncher,
      masterDecisionOsRoot: input.masterDecisionOsRoot,
      masterRoot: input.masterRoot,
      nodeExecutable: input.nodeExecutable,
      pausedBackgroundComponents: input.pausedBackgroundComponents,
      webpageLauncher: input.webpageLauncher,
    });
  });
}
