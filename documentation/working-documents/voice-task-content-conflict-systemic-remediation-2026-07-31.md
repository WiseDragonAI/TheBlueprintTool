## A. Repository Intent

1. Decision OS persists task structure in causal current-state entities while task card and thread Markdown remain immutable-object-backed resources with explicit causal heads.
2. A task mutation must preserve all existing task and thread content, publish one verified successor, and fail closed when independent replicas produced genuinely concurrent content.

---

## B. Current Iteration Intent

1. Prevent concurrent local task mutations from preparing Markdown successors from the same stale projection.
2. Preserve `task_content_conflict` for genuine cross-node divergence while ensuring voice lifecycle patches, browser notes, Codex notes, and watcher-originated task changes share one project transaction boundary.

---

## C. Findings

1. **First incorrect transition:** `create-project-controller-runtime.ts` cloned the project projection and materialized mutation inputs before calling `ProjectTaskState.executeMutation()`.
2. **Serialization gap:** `ProjectTaskState.commandQueue` serialized only the final causal commit. Two requests could read the same projection, mutate the same thread Markdown, then publish independent resource-head successors.
3. **Observed symptom:** the next task mutation saw multiple hashes in `materializeTaskMutationInputs()` and correctly returned `409 task_content_conflict`. The voice endpoint had already persisted the audio, so the frontend retained its local upload and rendered the retry state shown by the operator.
4. **Live conflict inventory:** the current Decision OS project has exactly two thread resources with distinct hashes. Their owning cards are **Nest incidents in expandable project status rows** and **Study a Unified Markdown Diff Editor Model**. In both cases the workstation candidate contains every stable note identity from the phone candidate plus later notes; no phone-only note identity exists.
5. **Containment gap:** `finishVoiceUploadOrchestration()` still silently returns when its first `queued -> transcribing` patch fails. That separate lifecycle settlement gap can strand an already accepted note and requires its own terminal incident and retry contract.
6. **Timeout drift:** the backend and frontend use a `120000ms` transcription deadline while the canonical voice requirement records `30000ms`.

---

## D. Remediation Paths

1. **Implemented:** add `ProjectTaskState.executePreparedMutation()` so the authoritative project queue owns the fresh projection read, content materialization, Markdown mutation, and causal commit.
2. **Implemented:** route `runtime.persistTaskLedgerMutation` through that transaction instead of preparing outside the queue.
3. **Implemented:** add a regression proving a second mutation cannot prepare until the first commits and that it observes the first mutation's projection.
4. **Implemented:** automatically reconcile a thread conflict only when the current local candidate byte-verifiably contains every stable note from every retained candidate. The replacement resource head causally observes all candidates before the original mutation is retried once.
5. **Retained safety boundary:** keep same-note divergent bodies, missing candidate objects, remote-only notes, card Markdown, and binary assets in explicit conflict state.
6. **Required follow-up:** persist a terminal retryable voice state plus an actionable incident when any post-acceptance lifecycle patch fails, and align both client and server deadlines to `30000ms` with cancellation.

---

## E. Operator Decision Summary

1. The systemic local race is corrected at the shared project mutation owner, not hidden in the voice UI.
2. The two verified live conflicts satisfy the lossless-superset rule and will reconcile causally when the retained audio is retried after deployment.
