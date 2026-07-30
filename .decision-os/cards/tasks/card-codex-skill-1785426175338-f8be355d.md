## A. Result

1. **Canonical verification** `passes` with exit code `0` through `node bin/decision-os-verify.mjs -- npm run test:front-back`.
2. **Final totals** are frontend `610/610`, backend `661/661`, and browser `182/187` passed with `5` intentional skips, `0` failures, and `0` cancellations.
3. **Metadata behavior** remains protected: the Linux browser suite passes `Responsive pipeline editing preserves unsaved metadata across step addition and removal` and the complete reusable-pipeline progression case.
4. **Repair branch** is `codex/pipeline-metadata-run-test-fix-1785426175338` at worktree `/home/jbb/dev/EditorBP/decision-os/.worktrees/pipeline-metadata-run-test-fix-1785426175338`.
5. **Delivery boundary** remains uncommitted and unpushed because `run-test-and-fix` forbids commit commands. `main` and `origin/main` remain at `808a16a7`.

---

## B. Reproduced Failure Groups

1. **Detached lifecycle settlement — `8` cancellations:** `launch binds Codex stdio directly to durable files`; `execution remains non-terminal until immutable artifacts are finalized`; `asynchronous settlement failures are reported without becoming unhandled rejections`; `execution deadline stops a non-terminating Codex process and reports the scoped failure`; `process-tree cancellation terminates the wrapper and its descendant`; `direct node message execution times out, terminates, and persists a failed manifest`; `shared capacity queues node messages behind task work and never oversubscribes direct children`; `close has a finite deadline when a project publication does not settle`. The detached children and non-persistent watchers could outlive every referenced event-loop owner while their returned promises remained pending.
2. **Exact executor ownership — `8` failures:** `server startup schedules a queued replicated execution discovered after an empty project`; four read-card cases covering chronological diagnostics, Markdown command output, continued JSONL inference, and resumed-segment measurement; `server startup interrupts a replicated running execution whose process registry is missing`; `server startup schedules the queued replicated successor without mutating completed pipeline history`; `card skill process route creates a linked output card and launches codex`. Fixtures persisted `local`, while the hosted runtime owned exact node `workstation`; strict production routing correctly excluded those records.
3. **Fixture contract — `2` failures:** `saved pipeline is idempotent while active and runs five isolated skills strictly in order` asserted transient `pending` after the scheduler could advance the same run to `running`; `normal health reports the active release identity` installed release settings after server construction and did not own the higher-precedence `DECISION_OS_DELIVERY_PROTOCOL=0`.
4. **Second-loop publication observation — `1` failure:** `server startup initializes a child repository and pipeline-prompt save never enters federation publication` counted automatic non-forced library synchronization as authored-skill publication.
5. **Browser save contract — `1` failure:** `Reusable step pipelines preserve defaults and publish visible execution progression` waited for the obsolete publication-failure message after the isolated local save correctly returned publication `not-applicable` and a Git revision.

---

## C. Repairs

1. **Lifecycle owners:** `launch-codex-execution-process.ts` keeps the finite execution and forced-kill deadlines referenced until settlement; `execute-node-message.ts` keeps the execution and forced-settlement deadlines referenced; `watch-project-files.ts` keeps its audit owner referenced from watcher creation until explicit close. Existing bounded deadlines, cancellation, timer clearing, escalation, and failure containment remain intact.
2. **Executor fixtures:** restart recovery, read-card, pipeline resume, and direct skill tests now configure one explicit runtime node identity before server construction and seed plus assert that exact identity through `taskExecutionNodeId(runtime)`.
3. **Stable fixture assertions:** the pipeline idempotency case verifies the stable run identity instead of a transient phase; release health installs delivery settings and protocol before construction and restores environment plus server/files in test cleanup.
4. **Publication-specific evidence:** the pipeline-prompt test returns valid empty peer snapshots, asserts response publication `not-applicable`, and excludes the force-refresh `skills-manifest?refresh=1` request that uniquely identifies authored publication.
5. **Safe browser fixture:** the temporary browser server has an explicit empty relay, empty federation, unique `browser-fixture` node identity, and no production credential. Its save assertion now verifies publication `not-applicable`, the committed `40`-character Git revision, and the visible `Saved as a new Git revision.` state.

---

## D. Verification Evidence

1. **Clean baseline:** canonical exit `1`; frontend `610/610`; backend `643/661`, with `10` failures and `8` cancellations.
2. **Focused executor group:** `19/19` passed.
3. **Focused lifecycle group:** `21/21` passed.
4. **Focused fixture group:** pipeline correction passed; release correction initially exposed environment precedence, then the release file passed `7/7`.
5. **Focused skill-library file:** `13/13` passed.
6. **Focused Linux browser file:** `4/4` passed with `/snap/bin/chromium`.
7. **Canonical rerun one:** backend improved to `660/661`; the publication-observation failure was isolated.
8. **Canonical rerun two:** frontend `610/610` and backend `661/661`; browser `181` passed, `1` failed, and `5` skipped, isolating the obsolete save-message assertion.
9. **Final canonical run:** both typechecks passed; frontend `610/610`; backend `661/661`; browser `182` passed, `5` skipped, `0` failed, and `0` cancelled; command exit `0`.
10. **Static integrity:** `git diff --check` passes for the repair worktree.

---

## E. Logic and Implementation Lessons

1. **Logic changes beyond the metadata design** are limited to lifecycle ownership: bounded settlement timers now remain referenced while awaited detached work exists. Pipeline metadata production logic was not changed.
2. **Fixture ownership must be explicit:** replicated execution tests must seed the same exact executor identity that the hosted runtime resolves; `local` is not a valid alias for a configured node.
3. **Startup inputs must precede construction:** release identity and other admitted runtime settings cannot be mutated into the runtime after `createHttpServer`.
4. **Assert stable contracts:** idempotency is stable run identity, not a scheduler phase sampled after admission; publication tests must observe publication-specific transport rather than every connector request.
5. **Browser servers require explicit isolation:** temporary verification nodes must declare empty federation transport and a unique fixture identity before launch.

---

## F. Remaining Gate

1. **Automated acceptance risk** is resolved by the green canonical run.
2. **Integration risk** remains: the verified repair diff is uncommitted in the task worktree, while the primary checkout already contains unrelated and overlapping uncommitted changes from before this run. The next gate must compare and integrate only the verified `11`-file repair diff without taking those unrelated changes.
3. **Preserved runtime evidence:** `.decision-os/runtime-incidents.json` appeared after verification with resolved `invalid_federation_project_catalog` warnings recorded by isolated server runs. It is valid, untracked, excluded from the `11`-file repair diff, and was not deleted.
4. **Live server** was not restarted, stopped, replaced, and used for verification.
5. **Master task** remains active; closure was not authorized.
