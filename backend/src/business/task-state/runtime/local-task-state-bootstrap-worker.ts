/**
 * WHAT: Reconstructs one local task-state store outside the HTTP listener event loop.
 * WHY: Thousands of synchronous shard reads and materializations must not stall health or unrelated projects.
 */
import { parentPort } from "node:worker_threads";
import { createProjectTaskState } from "../helper/project-task-state.js";

type BootstrapRequest = {
  decisionOsRoot: string;
  initialize: boolean;
  projectId: string;
  tasksLedgerFile: string;
  writerId: string;
};

// WHAT: Reject execution without the worker-owned message channel.
// WHY: This module has no safe standalone mutation contract.
if (!parentPort)
  throw new Error("local_task_state_bootstrap_worker_channel_missing");

parentPort.once("message", (request: BootstrapRequest) => {
  void (async () => {
    const state = createProjectTaskState({
      decisionOsRoot: request.decisionOsRoot,
      initialize: request.initialize,
      projectId: request.projectId,
      tasksLedgerFile: request.tasksLedgerFile,
      writerId: request.writerId,
    });
    await state.flush();
    parentPort!.postMessage({
      ok: true,
      diagnostics: state.store.diagnostics(),
    });
  })().catch((error: unknown) => {
    parentPort!.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? "") : "",
    });
  });
});
