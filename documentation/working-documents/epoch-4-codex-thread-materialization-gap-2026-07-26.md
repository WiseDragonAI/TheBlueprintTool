# Epoch 4 Codex Thread Materialization Gap

## A. Repository Intent

1. Epoch 4 separates **causal resource heads** from locally materialized mutable files.
2. A missing mutable thread file means **content is not materialized locally**.
3. Only an explicit note mutation may publish a replacement thread head.

---

## B. Current Iteration Intent

1. The local-first iteration atomically persists note identity, pending state, `threadFiles/<threadId>`, and the thread content head.
2. It repairs an orphan thread mapping by adopting an existing canonical sidecar without inventing note content.
3. It does not change Codex-start content materialization.

---

## C. Findings

1. **Critical gap — Codex start still converts a missing mutable thread file into an empty thread.**
   1. `start-thread-codex-process-controller.ts:169-172` resolves and writes the thread file before validating the prompt.
   2. `threadContentFile()` calls `hydrateLedgerThreadNotesFor()`, reads an empty note collection when the mutable file is absent, then calls `writeThreadNotesFile()`.
   3. `hydrateLedgerThreadNotesFor()` in `thread-content-file.ts:164-169` reads only the mutable workspace file. It does not resolve the active Epoch 4 resource head.
   4. `writeThreadNotesFile()` in `thread-content-file.ts:172-186` writes `formatThreadMarkdown([])`, which is one newline byte.
   5. Prompt validation runs afterward at `start-thread-codex-process-controller.ts:172-179`.
2. **Confirmed access-path drift.**
   1. The local HTTP thread route uses `readTaskContentOnDemand()` when the mutable file is missing.
   2. `readTaskContentOnDemand()` resolves the causally selected content head from the local immutable object store before requesting its exact hash from federation.
   3. Codex start bypasses that resolver.
3. **Watcher publication remains reachable.**
   1. Thread files are watched by `watch-card-content-files.ts`.
   2. The ownership resolver recognizes the rewritten canonical thread path.
   3. The one-byte write can therefore be captured as a new intentional content revision.
4. **Coverage omission.**
   1. Existing Codex admission tests validate tombstone filtering and timestamp requirements.
   2. No test starts Codex with a valid active thread head, a retained immutable object, and a missing mutable workspace file.
   3. No test proves failure leaves the mutable file, resource head, causal clock, and watcher publication unchanged.
5. **Iteration status correction.**
   1. The local-first iteration is complete for its implemented mutation, replica, voice, execution, event, image, regression, and orphan-mapping boundaries.
   2. It is not complete for safe Codex execution from a non-materialized active thread head.

---

## D. Remediation Path

1. Add one task-content materialization service that accepts `projectId`, task-state store, resource key, and destination file.
2. Resolve exactly one active resource head.
3. Read and verify the immutable object by its advertised SHA-256 and byte length.
4. Fetch the exact object through the existing on-demand content lane when it is not local.
5. Return `503 task_thread_content_unavailable` without creating or changing the mutable file when the object cannot be obtained.
6. Install verified bytes atomically at the canonical mutable path.
7. Parse and validate the latest timestamped operator note from the verified bytes.
8. Only after validation may Codex admission persist queued execution state.
9. Remove the unconditional `writeThreadNotesFile()` call from `threadContentFile()`.
10. Add a regression that proves:
    1. a retained immutable object materializes byte-identically before Codex admission;
    2. unavailable content returns `503`;
    3. unavailable content creates no mutable file;
    4. resource head and causal clock remain unchanged;
    5. no watcher-visible content mutation is published;
    6. invalid thread content fails before any mutation.

---

## E. Operator Decision Summary

1. Treat this as a **separate critical completion gate**.
2. Implement the shared verified materialization boundary before claiming Epoch 4 thread execution is lossless.
