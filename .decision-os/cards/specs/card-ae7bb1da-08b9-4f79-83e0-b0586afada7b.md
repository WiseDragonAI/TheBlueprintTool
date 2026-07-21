## A. Operator conclusion

1. **The recurring production failure is a closed Codex stdout pipe.** During this audit Android recorded three native Codex aborts at `23:27:22`, `23:27:25`, and `23:27:46` with `failed printing to stdout: Broken pipe (os error 32)`. The affected processes were this RCA run, the Pink run, and the related lifecycle implementation run.
2. **Decision OS recovered work after the damage instead of preserving execution through server loss.** The replacement backend started at `16:27:54` UTC and spawned resume processes for all three runs at `16:27:58` UTC. Every original Codex process had already terminated with `SIGABRT`.
3. **The durable correction is one host-owned runner for every Codex run.** Codex standard input, JSONL output, and error output must bind directly to files; lifecycle and cancellation must use a durable manifest plus validated process identity; the HTTP server must not own Codex transport.

---

## B. Verified failure chains

1. **Execution chain:** `runsv` owns `decision-os-server.mjs`; the launcher owns the backend child; the backend spawns a Node Codex wrapper; the wrapper spawns the Termux native binary. `start-thread-codex-process-controller.ts` still uses `stdio: ['pipe','pipe','pipe']`, ingests stdout in Node, pipes both outputs to files, sends the prompt through Node, and settles state from child callbacks.
2. **Crash transition:** the backend-side stdout reader disappears; the native process reaches its next JSON write; the Termux binary treats `EPIPE` as a fatal print failure; Android records `SIGABRT` in `codex-main`. Three fresh crash records prove the same transition across two projects and three independent runs.
3. **Restart transition:** the supervisor created a replacement backend, which read the run files and session IDs and launched continuations. The replacement PIDs prove recovery; the original processes did not survive.
4. **Unresolved initiating event:** available service logs begin with replacement startup and Android logs contain no low-memory kill record for the old backend. The reason the backend exited is not verified. This report does not assign that exit to tests, OOM, a signal sender, or a source change.

---

## C. Queue and concurrent-agent findings

1. **Related implementation is active but not ready:** [Analyze Codex run lifecycle and status consistency](card:card-f6904e45-8e15-4691-9619-b17165567797) has an uncommitted `codex-run-lifecycle` worktree with a new manifest, host launcher, reconciler, cancellation changes, frontend hydration changes, and `292` added plus `503` removed lines. Its focused frontend run still reported a missing `terminal-button.css` fixture, and the production server disappeared during the run.
2. **Queue restart recovery solved a different defect:** [Recover queued Codex runs after server restart](card:card-b85c6294-593d-4870-8c6e-ec559386df3c) corrected a lost scheduler wake-up for durable pending items. It does not remove server-owned pipes from running Codex processes.
3. **Verification admission remains incomplete:** [Make worktree verification one-command and environment-safe](card:card-1adba778-1e57-4160-858e-e9ebfec1999a) remains open. The live lifecycle agent invoked `node bin/decision-os-verify.mjs -- npm run test:front-back`, then `npm test --prefix frontend`. The wrapper sees `npm`, so its concurrency rewrite does not apply; observed workers ran with `--test-concurrency=0` while production Codex runs were active.
4. **The suite overlap is a proven safety defect, not a proven crash cause.** The lease serializes verification commands only; it does not exclude production Codex work, cap test workers hidden behind npm scripts, or protect the serving backend.

---

## D. Selected correction

1. **Complete the unified host-owned runner before merging the active lifecycle branch.** Open the prompt, JSONL, and error files before spawn; start Codex in its own process session with those file descriptors; persist PID, Linux start identity, process-group ID, run kind, queue order, lifecycle revision, retry timestamp, terminal status, and exit code in one manifest.
2. **Replace child-handle lifecycle authority.** Reconcile from validated OS identity and terminal JSONL; cancel through the validated process group; make queue release, retry admission, card projection, pipeline advancement, and notification idempotent manifest transitions.
3. **Harden the supervised server boundary.** Keep `runsv` as the single owner, make readiness follow successful `listen`, record backend exit code and signal, and refuse replacement startup while another verified port owner remains.
4. **Make mobile verification admission enforceable.** Expand repository scripts to direct bounded test commands, reject repo-wide suites while durable Codex manifests are running, and require an operator-authorized maintenance window for the single full-suite run. The lease must terminate the complete verification process group on interruption.
5. **Track the Termux binary defect independently.** Report the reproducible stdout `EPIPE` abort, pin the corrected build once available, and retain the direct-file runner so server survival never depends on that upstream fix.

---

## E. Acceptance gate

1. **Server independence:** one thread run and one pipeline run continue with the same PID/start identity and growing JSONL while the backend is absent; restart creates no duplicate.
2. **Lifecycle authority:** completion, failure, cancellation, retry, capacity release, card status, and pipeline advancement each persist exactly once and survive reload.
3. **Mobile safety:** repo-wide verification is rejected while a production Codex manifest is running; direct tests never exceed three workers; interruption leaves no verification descendants.
4. **Crash evidence:** Android logs show no new `failed printing to stdout: Broken pipe` entry during controlled server loss.
5. **Merge gate:** do not merge the active lifecycle worktree until focused checks, bounded package checks, both typechecks, the maintenance-window full suite, and served mobile status consistency pass.

---

## F. Subtasks

1. [Preserve the Original Broken-Pipe RCA](card:card-531f36de-d6cd-44e1-8cba-cf5473e47714)
