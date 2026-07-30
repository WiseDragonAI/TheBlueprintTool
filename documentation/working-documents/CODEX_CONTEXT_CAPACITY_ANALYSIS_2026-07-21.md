## A. Repository Intent

1. **Decision OS intent:** run Codex work against cards and threads, retain each run as append-only JSONL, and continue a durable Codex session when the operator adds a new note.
2. **Codex intent:** retain authoritative session history and token usage, expose session lifecycle through the app-server protocol, and render current context capacity in the interactive status line.
3. **Analyzed Codex revision:** `/home/jbb/dev/codex` was fast-forwarded to `a30aee8d906c2ec4dfa07c794504d4ee7099f98a` on `2026-07-21`. Two pre-existing local sample-skill edits were preserved and reapplied after the pull.

---

## B. Current Iteration Intent

1. **Objective:** carry Codex's authoritative current-context capacity into Decision OS run artifacts so the run UI and continuation controller can use the same state as the Codex status line.
2. **Boundary:** preserve the installed native Codex CLI, the current `codex exec --json` child-process architecture, and the existing Decision OS JSONL persistence path.
3. **Source constraint:** do not patch, rebuild, replace, or fork the Codex CLI.

---

## C. How Codex Computes Context Left

1. **Source data:** Codex receives upstream Responses API usage and stores it as `TokenUsageInfo`. `last_token_usage.total_tokens` is the latest active context size; `total_token_usage` is accumulated session usage. Evidence: `codex-rs/protocol/src/protocol.rs:2026-2261`.
2. **Effective model window:** `TurnContext::model_context_window()` applies the model's `effective_context_window_percent` to its resolved context window. Evidence: `codex-rs/core/src/session/turn_context.rs:213-219`.
3. **Reserved baseline:** Codex subtracts `12,000` tokens from both the active-context numerator and effective-window denominator. Evidence: `codex-rs/protocol/src/protocol.rs:2216` and `:2250-2260`.
4. **Formula:** `round(100 * max(0, (window - 12000) - max(0, used - 12000)) / (window - 12000))`, clamped to `0..100`.
5. **Status-line selection:** the TUI uses `last_token_usage`, never accumulated session totals, and falls back to `100%` only while the model window is unknown. Evidence: `codex-rs/tui/src/chatwidget/status_controls.rs:353-379`.
6. **Resume restoration:** Codex persists token-count events in the rollout and restores the latest token snapshot when a session resumes. Evidence: `codex-rs/core/src/session/mod.rs:1440` and the token-count persistence policy in `codex-rs/core/src/rollout/policy.rs`.

---

## D. Verified Transport Gap

1. **The data reaches `codex exec`:** the JSONL processor receives `ThreadTokenUsageUpdated` and retains the complete `ThreadTokenUsage`, which contains `total`, `last`, and `model_context_window`. Evidence: `codex-rs/exec/src/event_processor_with_jsonl_output.rs:58-64` and `:497-499`; protocol shape: `codex-rs/app-server-protocol/src/protocol/v2/thread.rs:1459-1494`.
2. **The adapter drops current-context fields:** `usage_from_last_total()` copies only accumulated `total` counters, and `TurnCompletedEvent` contains only `usage`. Evidence: `codex-rs/exec/src/event_processor_with_jsonl_output.rs:117-127` and `:521-523`; `codex-rs/exec/src/exec_events.rs:49-72`.
3. **Decision OS cannot reconstruct the percentage:** existing `turn.completed.usage.input_tokens` values are accumulated session totals. A verified 16-turn Decision OS artifact rises from `4,246,583` to `95,442,196` input tokens, far beyond a model context window.
4. **Decision OS drops usage during normalization:** `normalizeCardSkillRunEvent()` maps `turn.completed` to a generic completion record without the producer usage object. Evidence: `backend/src/business/codex/helper/normalize-card-skill-run-event.ts:128-139`.
5. **No capacity contract exists downstream:** `NormalizedRunEvent`, `readCardSkillRunController()`, `CardSkillRunExecution`, and `CardSkillRunSummary` contain no context-capacity field. Evidence: `backend/src/business/codex/helper/card-skill-run-event-types.ts:13-28`, `backend/src/business/codex/controller/read-card-skill-run-controller.ts:302-408`, and `frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:29-90`.
6. **Continuation always resumes when a session ID exists:** `newSession` is currently `!sessionId`, and that boolean alone selects ordinary `exec` against `exec resume`. Evidence: `backend/src/business/codex/controller/continue-card-skill-run-controller.ts:166-170` and `:207-209`.

---

## E. Selected Native-CLI Remediation

1. **Resolve the native rollout through the CLI read surface:** after Decision OS receives `thread.started`, invoke a short-lived native `codex app-server` process, send `initialize`, then call the read-only `thread/read` method with the recorded thread ID. The returned `Thread` contains the native rollout `path`. `thread/read` is documented, while the `path` field is explicitly marked unstable; the adapter must validate it and fail closed when absent. Evidence: `codex-rs/app-server/README.md:85-96` and `:495-507`; `codex-rs/app-server-protocol/src/protocol/v2/thread_data.rs:170-204`.
2. **Read only the latest persisted capacity record:** scan backward from the end of the resolved rollout file until the latest `{"type":"event_msg","payload":{"type":"token_count"}}` record is found. Extract `payload.info.last_token_usage.total_tokens` and `payload.info.model_context_window`.
3. **Reproduce the inspected native formula in Decision OS:** calculate `remaining_percent` with the verified `12,000`-token baseline and retain the raw inputs beside the result. Store the native CLI version returned in the `Thread` object with the snapshot so a CLI upgrade is detectable.
4. **Append a Decision OS-owned event:** after native `turn.completed`, append `decision_os.context_usage` to the existing run JSONL with `session_id`, `used_tokens`, `window_tokens`, `remaining_tokens`, `remaining_percent`, `codex_cli_version`, and `observed_at`. The namespace distinguishes derived Decision OS telemetry from native Codex output.
5. **Project one typed snapshot:** add a pure backend parser that reads the latest valid `decision_os.context_usage` for the active session. Expose it as `contextUsage` on the status response and current execution. Derive it from the complete JSONL independently of the incremental `since` cursor.
6. **Show one operator metric:** add `Context` to the card-run widget and thread Codex status strip. Display `remaining_percent`; display `—` until Decision OS records an authoritative native snapshot.
7. **Gate only verified exhaustion:** when `remaining_percent` is `0`, start a replacement session through the existing `newSessionContext` reconstruction path. When it is above `0`, keep `codex exec resume`. Legacy artifacts without a snapshot retain current resume behavior.
8. **Backfill lazily:** when a legacy run is continued without `decision_os.context_usage`, perform the same read-only extraction before selecting the continuation command.

---

## F. Rejected Remediation Paths

1. **Do not derive capacity from `turn.completed.usage`:** those counters are accumulated usage and do not represent active context occupancy.
2. **Do not scan `~/.codex/sessions`:** use native `thread/read` to resolve the exact rollout path for the recorded thread ID.
3. **Do not duplicate a model-window table in Decision OS:** Codex already resolves the active model window and effective percentage.
4. **Do not replace `codex exec` with app-server turns:** use a short-lived app-server only for read-only thread-path resolution. Replacing the run transport expands lifecycle, input, approval, cancellation, and recovery scope.
5. **Do not call `thread/resume` for observation:** it loads the thread and replays `thread/tokenUsage/updated`, but it is a stateful lifecycle operation. `thread/read` provides the path without resuming the session.
6. **Do not patch the Codex JSON adapter:** the operator requires the installed native CLI to remain unchanged.

---

## G. Verification Contract

1. **Native resolver regression:** emulate `initialize` and `thread/read`, then assert Decision OS captures the rollout path and CLI version without sending `thread/resume`.
2. **Rollout parser regression:** place several token-count records in a large fixture and assert the backward reader returns the last complete record without reading the entire file.
3. **Formula regression:** assert Decision OS matches Codex fixtures at `100%`, an intermediate percentage, and `0%` using the `12,000`-token baseline.
4. **Decision OS projection regression:** use multiple derived snapshots and assert the status endpoint returns the latest snapshot after a server-state reconstruction.
5. **Decision OS continuation regression:** assert positive remaining capacity launches `exec resume`; zero remaining capacity launches fresh `exec` with `newSessionContext`; missing context performs lazy extraction and retains legacy resume when extraction is unavailable.
6. **Frontend regression:** assert incremental polling preserves `contextUsage` and both run surfaces render known and unknown capacity.
7. **End-to-end observation:** complete one Decision OS Codex turn and compare its displayed percentage with `/status` in the same session.

---

## H. Operator Decision Summary

1. **Recommended implementation:** use native `codex app-server` `thread/read` to resolve the exact rollout, derive the status-line percentage from the latest persisted token-count record, and append a namespaced Decision OS capacity event.
2. **Why this boundary wins:** it leaves the native CLI untouched, keeps `codex exec` as the run transport, avoids global session scanning, and remains recoverable after a Decision OS restart.
3. **Implementation scope:** one native app-server read adapter, one backward rollout parser, one Decision OS projection and continuation gate, two compact UI metric additions, and targeted regressions.
