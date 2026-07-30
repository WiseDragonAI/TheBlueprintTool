Created at: 2026-07-21T07:56:31.000Z

## A. Objective

1. **Outcome:** Decision OS records and displays native Codex context-window usage for every observable run.
2. **Decision enabled:** Continuation logic distinguishes a resumable session from a session whose usable context is exhausted.

---

## B. Verified native contract

1. **Installed client:** `codex-cli 0.144.6`.
2. **Read path:** Native `codex app-server --stdio` accepted `initialize`, `initialized`, then read-only `thread/read` for thread `019f82d0-4707-7b62-a5d0-648affa5dd8c`.
3. **Resolved rollout:** `/home/jbb/.codex/sessions/2026/07/21/rollout-2026-07-21T10-55-15-019f82d0-4707-7b62-a5d0-648affa5dd8c.jsonl`; thread status remained `notLoaded`.
4. **Observed metric:** Latest `token_count` reported `160625` used tokens and a `258400` token window. The native statusline calculation yields `40%` remaining.
5. **Boundary:** Codex CLI source and binaries remain unchanged.

---

## C. Required behavior

1. **Lookup:** Resolve the rollout from the run session id through read-only `thread/read`.
2. **Extract:** Read the newest persisted `token_count` event and validate its token fields.
3. **Calculate:** Apply the native `12000`-token baseline and clamp the rounded remaining percentage to `0..100`.
4. **Persist:** Append a versioned `decision_os.context_usage` event to Decision OS run storage.
5. **Project:** Expose the latest snapshot in normalized run status independently of event cursors.
6. **Present:** Show used tokens, model window, remaining tokens, and remaining percentage.
7. **Continue:** Create a fresh session only at verified `0%`; preserve current behavior when capacity is unavailable.

---

## D. Constraints

1. **Native CLI:** Use the installed executable through app-server; do not modify Codex.
2. **Observation:** Never call `thread/resume` while collecting metrics.
3. **Failure:** Missing paths, malformed events, unsupported fields, and subprocess failures produce an unavailable metric without changing continuation behavior.
4. **Cost:** Tail backward and stop at the newest valid event.
5. **Ownership:** Write derived data only to Decision OS storage.
6. **Compatibility:** Collect legacy-run metrics lazily.

---

## E. Acceptance evidence

1. **CLI:** A native probe resolves a known rollout while the thread remains `notLoaded`.
2. **Extraction:** Fixtures cover valid, malformed, partial, and missing data.
3. **Formula:** Tests reproduce `40%` for `160625 / 258400` and cover both clamps.
4. **Persistence:** A snapshot survives restart and is independent of event cursors.
5. **Continuation:** Tests cover exhausted, positive, and unavailable capacity.
6. **Surface:** Unavailable metrics remain distinct from zero capacity.

---

## F. Contract risks

1. **Thread path:** App-server marks `Thread.path` unstable; isolate it behind one runtime-validated adapter.
2. **Rollout schema:** Validate nested token fields and retain native events as the source of truth.
3. **Diagnostics:** Collection failures are logged without blocking run completion.

---
