/**
 * WHAT: Owns one deadline-bounded worker that prepares a local task-state restart checkpoint.
 * WHY: Project bootstrap must preserve the synchronous store API without running cold reconstruction on the listener thread.
 */
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { TaskStateBootstrapReceipt } from "../helper/task-current-state-checkpoint.js";

type BootstrapInput = {
  decisionOsRoot: string;
  forceCanonicalValidation: boolean;
  initialize: boolean;
  projectId: string;
  signal: AbortSignal;
  tasksLedgerFile: string;
  writerId: string;
};

const bootstrapDeadlineMs = 120_000;

export function prepareLocalTaskState(input: BootstrapInput): Promise<TaskStateBootstrapReceipt> {
  return new Promise((resolveBootstrap, rejectBootstrap) => {
    const workerModule = new URL(
      "./local-task-state-bootstrap-worker.ts",
      import.meta.url,
    ).href;
    const tsxApi = import.meta.resolve("tsx/esm/api");
    const tsconfig = fileURLToPath(
      new URL("../../../../tsconfig.json", import.meta.url),
    );
    const worker = new Worker(
      `import(${JSON.stringify(tsxApi)}).then(({ register }) => { register({ tsconfig: ${JSON.stringify(tsconfig)} }); return import(${JSON.stringify(workerModule)}); })`,
      {
        eval: true,
        execArgv: [],
      },
    );
    let settled = false;
    const settle = (error?: Error, receipt?: TaskStateBootstrapReceipt): void => {
      // WHAT: Ignore duplicate worker, timeout, and cancellation settlement.
      // WHY: Exactly one owner may resolve project bootstrap and release its resources.
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      input.signal.removeEventListener("abort", abort);
      void worker.terminate().catch(() => undefined);
      // WHAT: Reject every failed settlement before considering its optional receipt.
      // WHY: Worker errors cannot transfer project authority.
      if (error) rejectBootstrap(error);
      else {
        // WHAT: Require the explicit receipt on every successful settlement.
        // WHY: A bare worker success recreates the duplicate main-thread store admission being removed.
        if (!receipt) {
          rejectBootstrap(new Error("task_state_bootstrap_receipt_missing"));
          return;
        }
        resolveBootstrap(receipt);
      }
    };
    const abort = (): void =>
      settle(
        input.signal.reason instanceof Error
          ? input.signal.reason
          : new Error("server_closed"),
      );
    const deadline = setTimeout(() => {
      settle(new Error(`task_state_bootstrap_timeout:${input.projectId}`));
    }, bootstrapDeadlineMs);
    deadline.unref?.();
    worker.once(
      "message",
      (message: { ok?: boolean; receipt?: TaskStateBootstrapReceipt; error?: string; stack?: string }) => {
        // WHAT: Admit only an explicit successful worker receipt.
        // WHY: Worker exit and malformed responses cannot establish a locally ready project.
        if (message.ok === true) settle(undefined, message.receipt);
        else {
          const error = new Error(
            message.error || "task_state_bootstrap_worker_failed",
          );
          error.stack = message.stack || error.stack;
          settle(error);
        }
      },
    );
    worker.once("error", (error) => settle(error));
    worker.once("exit", (code) => {
      // WHAT: Reject an unsettled worker exit regardless of its numeric status.
      // WHY: Only the explicit receipt proves that durable reconstruction and checkpoint settlement completed.
      if (!settled)
        settle(
          new Error(
            `task_state_bootstrap_worker_exit:${input.projectId}:${code}`,
          ),
        );
    });
    // WHAT: Cancel before dispatch when server shutdown already owns this bootstrap.
    // WHY: A closed server must not begin new filesystem reconstruction.
    if (input.signal.aborted) {
      abort();
      return;
    }
    input.signal.addEventListener("abort", abort, { once: true });
    worker.postMessage({
      decisionOsRoot: input.decisionOsRoot,
      forceCanonicalValidation: input.forceCanonicalValidation,
      initialize: input.initialize,
      projectId: input.projectId,
      tasksLedgerFile: input.tasksLedgerFile,
      writerId: input.writerId,
    });
  });
}
