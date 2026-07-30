## A. Repository Intent

1. **Decision OS keeps replicated task execution state authoritative for lifecycle and ownership.**
2. **Codex JSONL, stderr, telemetry, and result files remain execution artifacts used for diagnostics and presentation.**
3. **The Codex Log panel presents one selected execution segment from a retained provider session without writing log events into the conversation thread.**

---

## B. Current Iteration Intent

1. **Epoch 4 replaced legacy Codex execution authorities with replicated task-execution entities.**
2. **The detailed run endpoint must combine authoritative lifecycle state with artifact-derived presentation data.**
3. **The frontend contract requires each `executions` entry to include `segment`, `startLine`, `turnStartLine`, `endLine`, and per-execution counters so it can isolate the selected execution.**

---

## C. Findings

1. **Regression:** commit `89d4d41b` changed `readCardSkillRunController()` to build `executionHistory` from replicated lifecycle records, but the returned entries omit `segment`, `turnStartedAt`, `startLine`, `turnStartLine`, `endLine`, `toolCallCount`, `agentMessageCount`, `fileChangeCount`, `thinkingCount`, `warningCount`, `errorCount`, and `transportStatus`.
2. **First incorrect transition:** `backend/src/business/codex/controller/read-card-skill-run-controller.ts` returns an incomplete execution-history DTO even though it returns the JSONL events themselves.
3. **Frontend normalization:** `normalizedExecution()` in `frontend/src/runtime/codex/effect/request-card-skill-run-status.ts` converts the absent `startLine` and `endLine` properties to `0`.
4. **Event loss:** `executionEvents()` in `frontend/src/runtime/thread/effect/render-thread-codex-log.ts` retains JSONL events only when `event.line > execution.startLine && event.line <= endLine`. The incomplete DTO therefore becomes `event.line > 0 && event.line <= 0`, which rejects every event.
5. **Visible result:** the authoritative execution remains `running`, so the status row and stopwatch render correctly; the selected event list is empty, so the panel renders `Waiting for Codex output.`
6. **Live evidence:** the affected endpoint returned `status: "running"`, `lineCount: 82`, `toolCallCount: 38`, and `82` events. Its single `executions` entry contained lifecycle fields only and omitted every segment boundary and counter required by the frontend.
7. **Artifact evidence:** the affected JSONL file contained `82` lines, and its stderr file contained a valid `decision-os:codex-run-segment` marker with `executionId: "voice-execution-note-1784960267666-204795e64ef1a"` and `startLine: 0`.
8. **Test omission:** commit `89d4d41b` removed the assertions for `startLine` and `toolCallCount` from the resumed-segment backend test. Frontend unit coverage still supplies a complete execution DTO, so it does not exercise the broken backend-to-frontend contract.
9. **No process-output failure:** process capture, artifact resolution, JSONL parsing, endpoint routing, polling, event merging, and panel rerendering all executed successfully in the reproduced request. No runtime exception occurs; this is a silent DTO contract regression.

---

## D. Remediation Path

1. **Patch `readCardSkillRunController()` only.** Restore a complete execution-history presentation DTO while retaining replicated task execution as the exclusive lifecycle authority.
2. **Parse `codexRunExecutions({ log: stderrLog, runId })` once.** Match markers to authoritative history entries by `executionId`.
3. **Derive presentation boundaries from artifacts.** Use the matched marker for `segment`, `turnStartedAt`, `startLine`, and `turnStartLine`. Set each `endLine` from the next execution start boundary. Set the active final execution boundary to `null`. Set a terminal final boundary to the last parsed JSONL line.
4. **Handle an admitted execution before its marker exists.** Use the current last JSONL line as its `startLine`; this keeps a queued continuation from displaying the preceding execution.
5. **Calculate per-execution counters from the events inside those boundaries.** Keep `status`, `active`, `startedAt`, `finishedAt`, and `elapsedMs` sourced from the replicated lifecycle record.
6. **Do not persist artifact line offsets in replicated task state.** They are presentation indexes into one provider-session artifact, not task lifecycle authority.
7. **Restore the removed backend assertions.** The resumed-session test must assert `segment`, `startLine`, `endLine`, and per-execution counters. Add the same boundary assertions to the single active-execution fixture that matches the reported panel state.
8. **Run the focused backend controller test and frontend thread-panel unit test through `node bin/decision-os-verify.mjs -- <direct command>`.** Then run backend typecheck and the full repository suite once after the patch stabilizes.

---

## E. Operator Decision Summary

1. **Selected correction:** restore the complete execution-history DTO in the backend detailed-run projection.
2. **Expected scope:** one backend controller plus focused regression assertions.
3. **Rejected correction:** changing the frontend default for absent `endLine` would conceal the producer contract violation and would merge continuation output across execution boundaries.
4. **Rejected correction:** replicating JSONL line offsets in task state would couple authoritative lifecycle state to executor-local artifact layout.
