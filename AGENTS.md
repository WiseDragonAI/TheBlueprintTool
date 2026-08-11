# decision-os Agent Instructions

## Language Policy

- All agent responses MUST be written in English only.
- The operator may speak or write in French; do not mirror the operator's language.
- decision-os `# AGENT` thread replies must be in English, even when the corresponding `# OPERATOR` note is French.
- Do not write French acknowledgements such as `Traité`; use English equivalents such as `Treated`.
- Never write `you are right`.
- Never add any kind of over-explanation unless explicitly ordered by the operator.
- When the operator refers to a `prompt` or `prompts`, inspect `/home/jbb/.decision-os/pipeline-prompts` before answering.
- Create pipeline prompts with `ledger-cli prompt create` and update them with `ledger-cli prompt update`; do not handcraft authored-content HTTP requests.
- When research requires a webpage source capture, run `download-webpage <url>` and preserve the returned temporary `document` unchanged as the verbatim source artifact.

## KNOWLEDGE

### Working Document Lifecycle

- New files under `documentation/working-documents/` may contain only analysis that is active in the current iteration. Files that predate this lifecycle rule are a finite migration backlog, not evidence of active work.
- Before an iteration is finished, extract verified final-state technical knowledge into its canonical KB owner: current behavior in `documentation/documentation/`, accepted requirements in `documentation/specs/`, repeatable operations in `documentation/procedure/`, and completed incident analysis in `documentation/postmortem/`.
- Do not promote intermediate TODO lists, implementation checklists, hypotheses, progress reports, or superseded plans into the KB.
- After extraction, delete the completed iteration's working documents. A finished new iteration must leave no source document in `documentation/working-documents/`; a dedicated backlog-recycling iteration must delete every legacy source it settles.

### Error Handling and Failsafe Boundaries

- **Contain recoverable failures.** A failed request, task, project runtime, watcher, federation stream, or child process must fail only its owning scope. Keep unrelated HTTP routes, projects, federation traffic, health routes, and diagnostic routes available.
- **Reserve process termination for process-wide invariants.** Expected input errors, corrupt project data, unavailable peers, timeouts, task failures, and synchronization conflicts must not terminate the server process. A process-wide invariant failure must be recorded before exit and handled by the external supervisor.
- **Observe every asynchronous operation.** Every detached promise, timer callback, event callback, stream handler, and child-process settlement callback must end at an explicit success-and-failure boundary. A fire-and-forget call must have a terminal rejection handler that records its scope and context.
- **Bound every wait.** Capacity waits, relay requests, flow-control credits, drains, retries, child executions, and shutdown waits require a finite deadline plus cancellation. Clear their timers and listeners on settlement and server close.
- **Propagate cancellation.** Client disconnect, server close, replaced relay stream, and operator cancellation must abort downstream HTTP requests, relay streams, subprocesses, and queued work.
- **Own child-process lifecycle.** Record process identity and start time, stream output to bounded durable files, terminate on deadline, escalate `SIGTERM` to `SIGKILL`, and force promise settlement when exit events do not arrive.
- **Preserve invalid durable state.** Invalid JSON, journals, registries, queues, manifests, and incident ledgers must remain byte-identical. Do not treat corrupt state as empty and do not rewrite it. Pause the owning scope and record the file path plus validation error.
- **Persist actionable incidents.** Record scope, component, operation, stable error code, message, stack, timestamps, occurrence count, and task-specific context in a bounded durable incident ledger. Incident diagnostics must remain readable when normal project startup fails.
- **Make recovery explicit.** Resume a paused scope only after re-reading and validating its durable state. Install recovered runtime state atomically. A failed recovery keeps the scope paused and retains the incident evidence.
- **Keep diagnostics failsafe.** Incident reporting and logging must not throw into the work being contained. Protect telemetry, serialization, durable incident writes, and console transports from becoming a second failure.
- **Supervise fatal exits.** The process supervisor must use exponential restart backoff, bounded log retention, a finite failure circuit, and supervisor-owned incident evidence. A tight restart loop is a production failure.
- **Verify failure behavior.** Tests must inject the failure at the first asynchronous, process, network, or persistence boundary and prove that the server plus diagnostics stay online, the affected scope pauses, the incident persists, durable bytes remain unchanged, resources settle, and explicit recovery succeeds.

### Anti Specs

- **Rule.** Never write anti-specs: generic process claims that spend operator tokens and attention without adding a concrete requirement, constraint, decision, evidence, or action.
- **Don't.** `Good PRDs do not exist to create paperwork. They align teams around the customer problem, goals, requirements, risks, constraints, dependencies, and success measures before execution.`
- **Do.** `Card purpose: give the operator the verified information needed to understand the current state and make the next decision.`

### No Suppositions

- **Rule.** Never write suppositions when the answer can be verified from the repo, tools, CLI, docs, runtime state, or available evidence. Search, inspect, run the relevant command, and report the finding.
- **Don't.** `If ledger-cli does not expose that query, then the missing piece is a CLI contract.`
- **Do.** `Finding: ledger-cli exposes no zone-context query. Evidence: rg found no command handler or help entry for zone context under cli/. Required action: add the ledger-cli query contract.`
- **Blocker.** When evidence cannot be obtained, state the verified blocker and ask one concrete operator question. Do not replace missing evidence with conditional analysis.

### No Or In Plans

- **Rule.** Never leave unresolved alternatives with `or` in a final implementation plan, recommendation, acceptance criteria, or `# AGENT` answer. Pick the single best solution from the evidence. Options are valid only inside explicit questions to the operator.
- **Don't.** `Add headers or query params: x-ledger-id, x-thread-id, x-card-id, x-note-id, x-queue-codex.`
- **Do.** `Add required headers to /api/voice-upload: x-ledger-id, x-thread-id, x-card-id, x-note-id, x-queue-codex.`

### Task Closure Authorization

- Unless explicitly instructed by the operator or the active skill, agents must not close master tasks or mark master-task cards `done`.

### Staged Code Protection

- Git-index hunks are operator-approved and protected. Agents must not modify, overwrite, or unstage staged lines. If required work conflicts with a staged hunk, stop and request operator direction.

### Reference Component Fidelity

- **Trigger.** When the operator names an existing widget or component as the visual reference, inspect that component's rendered structure and every CSS rule controlling its surface, icon, label, casing, spacing, and states before implementation.
- **Requirement.** Copy the reference component's styling boundary exactly. When the reference applies accent color only to its icon and label, keep the button surface, border, shadow, and container on the reference component's shared styling.
- **Verification.** Compare computed foreground, background, label casing, SVG structure, and dimensions between the changed control and the named reference on the served target surface.

### Behavior-Only Component Changes

- **Trigger.** When the operator requests a behavior change to an existing validated component, preserve that component's implementation, rendered structure, styling, and interaction model.
- **Boundary.** Fix the data, hydration, state, or event transition responsible for the behavior. Do not replace the component, introduce a substitute library, or redesign its editing surface without explicit operator authorization.
- **Escalation.** If the existing component cannot satisfy the requested behavior, present the verified limitation and ask the operator before changing the component boundary.

### Complex Interaction Library Gate

- **Trigger.** Before implementing touch gestures, drag-and-drop sorting, carousels, rich-text editing, virtualized lists, focus traps, collision detection, or another interaction with a multi-event browser state machine, inspect maintained framework-free libraries and the existing dependency stack.
- **Decision.** Prefer a mature library when it owns input normalization, cancellation, animation, scrolling, accessibility, and cleanup. Write custom interaction code only when verified requirements are materially outside the library contract.
- **Operator visibility.** State the selected library, license, pinned version, runtime delivery method, and the concrete reason for selecting it before implementation. When custom code is selected, state the evidence that rules out the library path.
- **Boundary.** Keep application-specific state and persistence outside the library. Consume the library's stable completion event, update local state optimistically, then persist.

### Interaction Verification and Claims

- **Behavioral evidence.** Source-pattern assertions, syntax checks, and unit tests do not prove a touch, pointer, scroll, focus, animation, or drag interaction works. Verify the complete gesture on the served target surface with representative browser input.
- **Persistence evidence.** For optimistic UI, verify three distinct moments: the UI changes before the request resolves, successful persistence survives a fresh reload, and a rejected request reconciles to server-confirmed state.
- **Target evidence.** Confirm the operator-facing route serves the changed files and pinned assets. Record the route, HTTP result, and behavioral observation without restarting the server unless the operator requested it.
- **Claim calibration.** Use `implemented; automated checks pass; device interaction not yet verified` when target-surface verification is unavailable. Do not write `works`, `fixed`, `complete`, or mark the related ledger card `done` without behavioral evidence for the affected interaction.
- **Operator gate.** When only the operator can exercise the required device path, keep the task active and ask for one focused validation step instead of declaring success.

### Contradicted Success RCA

- **Stop condition.** After the operator reports that a claimed interaction fix still fails, stop incremental patching and reopen the affected subtask.
- **Evidence.** Capture the exact route, device and browser, gesture sequence, screenshot or recording, DOM state, request sequence, and persisted state before editing again.
- **RCA.** Identify the first incorrect transition in the event-to-DOM-to-local-state-to-request-to-server-state chain. Record evidence for the cause in the card and add a regression that exercises that boundary.
- **Escalation.** After one contradicted success claim, reassess the implementation approach, including a maintained library replacement. Do not issue a second success claim from the same class of static evidence.

### Formatting Contract

1. **Content:** include only verified information needed for the next operator decision; use task-specific section titles, never a default schema.
2. Use letter-prefixed H2 sections, --- between sections, numbered list items.
3. **Card references:** identify every master card and subtask by its exact card title. Do not include card IDs unless the operator explicitly requests them.

## Platform-Aware Chromium Procedure

- **Mandatory platform gate:** Before installing, running, debugging, or
  modifying browser automation, and before using Chromium for a browser test or
  screenshot, read the injected `platform` instruction and follow only the
  matching section in [`BROWSER_RUNBOOK.md`](BROWSER_RUNBOOK.md).
- **Linux workflow:** For `platform: linux`, use root `@playwright/test` with
  `/snap/bin/chromium` and the Linux launch flags documented in the runbook.
- **Termux workflow:** For `platform: termux`, use
  `../tool/browser/browse.js` with
  `/data/data/com.termux/files/usr/bin/chromium-browser` and preserve the
  Android-only `--no-zygote` and `--single-process` flags.
- **No inference:** The injected platform value is authoritative. Do not infer
  the workflow from filesystem paths and do not run commands from the other
  platform's section.
- **Server boundary:** Chromium is a separate client process. Do not restart,
  stop, replace, or launch the Decision OS server while preparing a browser test
  unless the operator explicitly requests a server restart.

## Operator Browser Ownership

- **Never open, control, navigate, or interact with the operator's browser.** This includes invoking a CLI flow that automatically opens a browser, such as `wrangler login` with its default browser behavior.
- Use existing non-interactive credentials for authenticated operations.
- When operator authentication is unavoidable, run the provider's no-browser flow, give the operator the URL, and wait for the operator to complete the browser interaction.

## decision-os Server Procedure

## Decision OS Submodule Boundary

Every workspace `.decision-os` directory is a Git submodule. Do not add
workspace Decision OS cards, threads, ledgers, prompts, or other authored
documents directly to the owning project repository. Initialize the child
repository first, add it to the owning repository with `git submodule add`,
and commit the parent gitlink plus `.gitmodules` entry before authored content
is edited. Runtime, cache, settings, upload, and other ignored state remains
inside the submodule and is not added to either repository.

### Cleanliness Reporting Boundary

- When the operator asks whether a repository, branch, checkout, or worktree is
  clean, report only the owning parent repository's Git state and ignore
  `.decision-os` submodule worktree state.
- Mention `.decision-os` child-repository Git state only when the operator
  explicitly asks for Decision OS submodule status or cleanliness.
- The parent repository's `.decision-os` gitlink remains part of the parent
  cleanliness result. Report a staged or changed gitlink because it changes the
  parent repository; do not expand that marker into child paths unless the
  operator explicitly asks for submodule details.

The parent repository must record only the `.decision-os` gitlink. A parent
status showing individual `.decision-os/...` files means the submodule boundary
is missing or has been removed and must be repaired before reporting the parent
clean. A parent status showing `m .decision-os` means the submodule has
uncommitted content; commit authored content in the child repository before
updating the parent gitlink.

This checkout uses the local-only submodule source
`file:///home/jbb/dev/EditorBP/decision-os-data.git`. New local-only projects
must use a local bare source repository that is available to the checkout;
portable projects require a shared remote source instead.

### Dev To Main Merge Tool

Use the fixed merge tool for a local `dev` to `main` promotion:

```bash
cd /home/jbb/dev/EditorBP/decision-os
node bin/decision-os-merge-dev.mjs --json
```

When the operator has already authorized the merge, run the normal promotion
command directly. Do not run doctor first: the normal command performs the
same critical admission checks before mutation, so a separate preview adds no
decision value.

After the normal promotion command succeeds, treat its JSON receipt as the
authoritative merge, release-tag, commit, and cleanliness result. Do not run
follow-up Git status, branch, log, tag, submodule, or cleanliness checks.

Use the read-only doctor only when merge authorization has not been given and
the operator needs an observational admission preview:

```bash
node bin/decision-os-merge-dev.mjs doctor
node bin/decision-os-merge-dev.mjs doctor --json
```

Doctor reports current branches, parent and main-child dirt, both recorded
gitlinks, predicted conflicts, blockers, and the expected commit sequence. It
must not acquire mutation locks, create promotion logs, stage paths, commit,
update refs, change either worktree, or enter `.worktrees/dev/.decision-os`.
Its single authoritative result is exactly `READY` or `NO-GO`; never infer
admission from another field or from the presence of the word `ready`.

Run it only from the primary parent `main` checkout. The tool may automatically
commit non-ignored state in main's `.decision-os` child, commit only that
gitlink in parent `main`, merge the local `dev` ref with `--no-commit --no-ff`,
restore main's `.decision-os` gitlink, and create the merge commit. It must never
enter, update, commit, or reset `.worktrees/dev/.decision-os`, push a ref,
resolve a conflict outside the exact `.decision-os` gitlink, or accept arbitrary
Git strategy and dirty-state overrides.

The parent index must be empty and parent dirt must be limited to the exact
`.decision-os` marker before invocation. A non-submodule merge conflict is a
rejection: resolve it through its owning implementation workflow, return both
parent repositories to the admitted state, and run the tool again.

Every invocation writes one local JSONL receipt under
`.decision-os-merge-dev-logs/`. This directory is Git-ignored and must remain
untracked. Doctor is observational and creates no receipt. Review and clean logs according to
[`documentation/procedure/deployment/merge-dev-into-main.md`](documentation/procedure/deployment/merge-dev-into-main.md); the tool never deletes logs automatically.

### Server Restart Ownership

- **Do not restart or stop the server unless the operator explicitly asks.**
- **Standing canary authorization:** agents may restart the Decision OS canary on port `50151` at any time without additional operator approval. This authorization does not apply to port `50150` or any production server.
- **On this workstation, when MultiTerm is available, use the server registered and launched there; do not launch an additional server.**
- **Do not use the existing `dev` worktree as a temporary canary.** The `dev` worktree already owns the persistent MultiTerm server on port `50151`; a temporary canary must run code from a newly created feature worktree containing the change under verification, use isolated scratch runtime state, and remain unregistered from MultiTerm.
- **Never attach a temporary verification server to the production federation.** A connected server performs automatic peer library synchronization and can saturate production even when the intended check concerns one card or thread.
- **Use gentle federation verification.** Read the registered server log and exact durable resource first. Exercise cross-node transport with the isolated two-node integration fixture. A new live node is prohibited until it has an isolated relay, unique node and project identities, disabled automatic library synchronization, and bounded single-flight requests.
- **Incident reference:** [Temporary federation verification node production saturation](documentation/postmortem/temporary-federation-verification-node-production-saturation-2026-07-29.md).

decision-os serves every discovered `.decision-os` project below the server launch directory. The
Control Room is always `/`, all projects remain simultaneously accessible, and project-owned resources
use canonical `/p/:projectId/...` URLs. Start the master server from the directory whose descendants
form the project catalog.

For this decision-os repo workspace, use port `50150`. Port `4174` is registered to
`Ardaria_57` in multiterm state; do not start this repo on `4174`.

```bash
cd /home/jbb/dev/EditorBP/decision-os
setsid sh -c 'cd /home/jbb/dev/EditorBP/decision-os && exec env PORT=50150 /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs >> /tmp/decision-os-50150.log 2>&1' </dev/null >/dev/null 2>&1 &
```

Then verify both the process and HTTP route:

```bash
ps -ef | rg 'decision-os-server|server.ts|50150' | rg -v rg
curl -sS -I http://127.0.0.1:50150/
```

Expected routes for decision-os:

```text
http://127.0.0.1:50150/
http://127.0.0.1:50150/projects
http://127.0.0.1:50150/ledgers
http://127.0.0.1:50150/p/<project-id>/ledgers/<ledger-id>
```

## Background Launch Rules

- Use the repo launcher: `/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs`.
- Run it from the target workspace cwd so `.decision-os/state.json` resolves correctly.
- Use `setsid sh -c 'cd <workspace> && exec env PORT=<port> <launcher> >> <log> 2>&1' </dev/null >/dev/null 2>&1 &`
  for a real background server.
- Redirect stdout and stderr to a workspace-specific log under `/tmp`.
- Verify with `curl -I` before reporting the URL.
- Do not rely on a plain foreground command for operator-facing server sessions.
- Do not rely on a fragile one-liner that only backgrounds the wrapper without verifying the child server stayed alive.

## Launcher Notes

The launcher derives decision-os runtime paths from its own location and sets:

```bash
DECISION_OS_FRONTEND_ROOT=/home/jbb/dev/EditorBP/decision-os/frontend
TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/decision-os/backend/tsconfig.json
```

To inspect the underlying command without starting the server:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs --print-command
```

## Frontend Telemetry Processing

Frontend telemetry is retained on disk as JSONL under the server launch
workspace:

```text
<workspace>/.decision-os/frontend-telemetry.jsonl
```

Read retained telemetry directly from that file with `tail`, `rg`, and `jq`.
Do not use HTTP requests to retrieve records already available in the JSONL
file. Start with the smallest relevant tail or exact event-name search, then
expand only when the retained evidence requires it.

Use HTTP only to check whether telemetry is currently enabled or to probe the
actual behavior of a live route:

```bash
curl -sS http://127.0.0.1:50150/api/diagnostics/frontend-telemetry-config | jq .
tail -n 200 /home/jbb/.decision-os/frontend-telemetry.jsonl | jq -c .
rg 'task-execution-http-settled|codex-log-summary-settled' \
  /home/jbb/.decision-os/frontend-telemetry.jsonl
```

Treat a missing follow-up telemetry event as the first unobserved transition,
not proof of a specific internal failure. Corroborate the cause with the next
boundary's telemetry, browser evidence, or one focused live-route probe.

## Voice Transcription

Voice transcription is configured per target workspace through:

```text
<workspace>/.decision-os/.settings.json
```

Minimal settings:

```json
{
  "decisionOsFrontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Supported aliases are also accepted:

```json
{
  "frontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "DECISION_OS_FRONTEND_ROOT": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "OPENAI_API_KEY": "sk-...",
  "OPENAI_TRANSCRIPTION_MODEL": "gpt-4o-mini-transcribe"
}
```

Keep this file local and ignored. Do not commit API keys or uploaded voice files.

## Operator Keys

The in-app Keys panel should list the current keyboard contract:

```text
A       Open or focus the thread panel.
X       Start or stop the active voice note.
Esc     Cancel voice capture, close thread tooling, or clear selection.
Del     Confirm deletion for the selected card, zone, or group.
Ctrl+C  Copy the selected cards, zones, and groups.
Ctrl+V  Paste the copied selection.
Ctrl+D  Resize selected cards to their content and selected zones to contained cards.
```

## Iteration Worktree and Integration Policy

- **Canonical worktree command:** Create, inspect, initialize, and integrate worktrees only through [`bin/decision-os-worktree.mjs`](documentation/procedure/implementation/manage-worktrees.md). Do not substitute direct `git worktree`, dependency-link, merge, push, or cleanup commands.
- **Default execution boundary:** Every implementation iteration, including code, tests, documentation, configuration, and operational tooling, must use a dedicated feature branch in an isolated worktree under `<repo>/.worktrees/`, based on the exact published `dev` branch. Create it with `node bin/decision-os-worktree.mjs create <feature-name> --json`. Do not edit `dev` or `main` directly by default.
- **Baseline resolution:** The create command fetches `dev`, requires local `dev` to equal `origin/dev`, validates canonical dev setup, initializes the child checkout, installs canonical dependency links, and rejects unrelated state before issuing its receipt.
- **Autonomous `dev` integration:** An agent is authorized to commit the iteration, merge its feature branch into `dev` with a merge commit, push `dev`, then remove the worktree and delete the merged feature branch without additional operator approval only after all of these gates pass:
  1. Required focused checks and repository verification pass under the repository test policy.
  2. The complete worktree diff and changed-path inventory have been reviewed.
  3. Every changed path and hunk belongs to the current iteration.
  4. The resulting behavior matches the operator's stated intent and the operator-validated specifications.
  5. Unrelated changes and protected staged hunks are excluded.
  6. After the local merge, the fixed dev integration check accepts the exact reviewed feature SHA and proves that the new `.decision-os` gitlink descends from the first-parent gitlink, is fetchable from the configured child source, and is installed exactly in the persistent `dev` child checkout:

     ```bash
     cd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev
     node bin/decision-os-dev-integration-check.mjs --feature <reviewed-feature-sha> --json
     ```
- **Failed gate:** If a pre-merge gate fails, keep the feature branch and worktree intact, report the exact blocker, and do not merge. If the post-merge dev integration check fails, keep the local merge plus feature branch and worktree intact, report and repair the exact child publication, ancestry, or checkout blocker, rerun the check, and do not push or clean up.
- **Mandatory successful-merge cleanup:** Run `node .worktrees/<feature-name>/bin/decision-os-worktree.mjs integrate <feature-name> --json` from outside the feature worktree. The command merges the exact feature SHA, installs the child gitlink, runs the fixed admission check, pushes only the admitted SHA, removes the completed worktree, and deletes the merged feature branch. Delete all remaining iteration-temporary artifacts before reporting completion.
- **Dev Decision OS visibility:** In the `dev` linked worktree, set `submodule.".decision-os".ignore = all` through worktree-local Git configuration. Do not commit this setting to `.gitmodules`; it suppresses mutable child-state noise only in `dev` and preserves submodule-drift visibility in `main`.
- **Explicit operator exceptions:** The operator may explicitly direct the current iteration to run directly on `dev`, directly on `main`, or in a dedicated worktree based on `main`. The exception applies only to that stated iteration and must never be inferred from the current checkout, a clean primary checkout, urgency, or a prior exception.
- **Main protection:** Without an explicit operator exception, an agent must not implement on `main`, create an iteration worktree from `main`, merge an iteration into `main`, or use the primary checkout as an uncommitted handoff location.

## Commit Hygiene

- Never finish a feature with implementation changes left uncommitted.
- After implementing and verifying a feature, create focused commits before reporting the feature complete.
- Every implementation commit must include the iteration's intended Decision OS card and thread Markdown changes under `.decision-os/cards/**` and `.decision-os/threads/**`. Do not leave those documentation changes untracked or defer them to a later cleanup commit.
- Every agent-authored commit, including a merge commit, must have a concise subject and a non-empty body.
- The commit body must contain a `WHAT:` paragraph identifying the changed behavior, documentation, data contract, or operational boundary.
- The commit body must contain a `WHY:` paragraph recording the incident, invariant, operator decision, or verified need that required the change.
- After committing, verify the complete message with `git show -s --format=%B HEAD` before pushing.
- After creating the final merge commit for completed work, push `dev` to `origin` before reporting completion.
- Never leave completed iteration worktrees, merged feature branches, or their build artifacts behind.
- When the operator asks to push committed work, push with the Wise SSH key:

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' git push
```

## CLI Task Creation

- Follow [`documentation/procedure/tasks/create-and-publish-tasks-from-cli.md`](documentation/procedure/tasks/create-and-publish-tasks-from-cli.md) for every CLI-created task or master-task graph.
- Create Tasks through the project-scoped `PATCH /p/:projectId/decision-os/tasks` command API. Never edit `.decision-os/tasks.json`, `.decision-os/task-state/**`, or task-state object files directly.
- Treat creation and publication as two separate required steps. `create-card`, `create-task-intake`, and `create-master-task` are locally held until an `append-note` content contribution activates the task identity.
- After creation, append one truthful `agent` note to the new task thread, verify that `.decision-os/task-state/<projectId>/local/held/<taskId>.json` is absent, and inspect federation replication status before reporting the task synchronized.
- Commit only the intended versioned task card/thread Markdown and related source changes. Do not stage runtime task-state, voice uploads, run artifacts, caches, settings, or unrelated operator changes.
- Use a focused commit with the required `WHAT:` and `WHY:` body, verify the complete message, then follow the default `dev` integration and push policy with the Wise SSH key.

## Debugging

- Solve one problem at a time instead of trying to fix everything.
- List all possible options.
- Find what is wrong in the chain at a fundamental level.
- Choose one thing with the most yield, the least effort, the smallest amount of LOC, and the most structurally correcting change.
- After choosing a direction, expand your knowledge and check everything related so you do not miss critical elements.
- Correcting means fixing the technical debt.
- Do not propose hiding, disabling, or bypassing the behavior under investigation as an optimization. That is avoiding the bug, not solving it, unless the operator explicitly asks for a degraded-mode tradeoff.

## Branch Comment Contract

- Every control-flow branch and every `if` statement must have adjacent `WHAT:` and `WHY:` code comments.
- `WHAT:` must identify the exact decision made by the branch.
- `WHY:` must record the verified invariant, failure mode, or requirement that makes the branch necessary.
- Agents must add or update these comments whenever they add or modify a branch or `if` statement.

## Code Smells

- It is a code smell to do expensive operations for many more elements than are needed in the end.

## Trace Evidence Agent Runbook

Before operating `trace-evidence`, follow [`documentation/procedure/testing/use-trace-evidence.md`](documentation/procedure/testing/use-trace-evidence.md). The tool produces evidence; the agent owns diagnosis and interpretation.

## Test Admission

Run every test and typecheck through the repository-wide lease:

```bash
node bin/decision-os-verify.mjs -- <command> [args...]
```

- The command waits when another Decision OS verification owns the lease.
- Pass one direct test or typecheck command. Shell wrappers are rejected.
- `node bin/decision-os-workload-status.mjs` remains a read-only diagnostic.
## Verification Hygiene

- During implementation: run smallest relevant test files.
- Add and fix change-specific tests first.
- Typecheck once after code stabilizes. Scope changed package.
- Full suite once after implementation and focused tests pass.
- Failure: rerun smallest failing scope.
- Full-suite test-only repair: when a completed full suite reports failures and making those failures pass requires changes only to test files, rerun every previously failing test in the smallest relevant scope. After all previously failing tests pass and no source file changed, do not rerun the full suite.
- Passing check: do not repeat after docs-only edits.
- Worktree dependency admission: `bin/decision-os-verify.mjs` automatically links missing frontend and backend dependencies from `.worktrees/dev` before every admitted check. Keep the `dev` dependency installation available through verification. When an iteration changes a package lock, install that package inside the iteration worktree; the wrapper preserves real worktree-owned dependency directories and rejects stale shared dependency access.
- On mobile, test and typecheck commands must use no more than `3`-way parallelism.

## Patch Context Hygiene

- Before patching a control-flow dispatcher, read the exact target symbol and patch against its actual branch structure. Do not infer that independent `if` branches use an `else if` chain.
- After one `apply_patch` context mismatch, reread the smallest relevant region and retry with a narrower stable anchor instead of expanding the patch context.

## Browser Test Isolation

- A browser test that launches `bin/decision-os-server.mjs` must use a temporary workspace whose copied `.decision-os` fixture excludes `.settings.json`, `cache/`, `runtime/`, `runs/`, and `voice-uploads/`.
- Never launch a browser-test server from the repository root: it can read live federation credentials, join the production relay, rewrite discovered project files, and receive real task traffic.
- Before and after a browser test, compare `git status --short`; remove only artifacts proven to have been generated by that test run.

### Backend Commands From An Iteration Worktree

Run these commands from the iteration worktree root, where `bin/decision-os-verify.mjs` and `backend/package.json` are both present:

```bash
node bin/decision-os-verify.mjs -- env --chdir=backend TSX_TSCONFIG_PATH="$PWD/backend/tsconfig.json" node --test --test-concurrency=1 --import tsx "test/**/*.test.ts"
node bin/decision-os-verify.mjs -- npm --prefix backend run typecheck
node bin/decision-os-verify.mjs -- env --chdir=backend TSX_TSCONFIG_PATH="$PWD/backend/tsconfig.json" node --test --test-concurrency=1 --import tsx test/<focused-test-file>.test.ts
```

- Keep the complete backend suite at `--test-concurrency=1`; integration files can each create servers, Git repositories, and child processes, so file concurrency multiplies system load beyond the visible Node test-runner count.
- Do not invoke the complete backend suite through `npm test`. The verification lease can clamp a directly admitted `node --test` command, but it cannot inspect or bound a Node test runner launched inside npm.
- Run the admitted Node process with `env --chdir=backend`. Backend tests resolve repository CLI tools through `../bin` from the package cwd.
- Expand `TSX_TSCONFIG_PATH` from the worktree-root `$PWD` before `env` changes cwd. Server fixtures launch child processes from temporary workspaces, and an inherited relative tsconfig path then resolves outside the repository.
- Keep `--test-concurrency=1` before the test path so the admitted command makes its resource boundary explicit and auditable.
- Run `npm --prefix backend ci --ignore-scripts` only when the iteration changes `backend/package-lock.json`; the verifier otherwise provisions the canonical `dev` dependencies.

### Frontend Commands From An Iteration Worktree

Run these commands from the iteration worktree root, where `bin/decision-os-verify.mjs` and `frontend/package.json` are both present:

```bash
node bin/decision-os-verify.mjs -- npm --prefix frontend test -- --test-concurrency=1
node bin/decision-os-verify.mjs -- npm --prefix frontend run typecheck
node bin/decision-os-verify.mjs -- env --chdir=frontend TSX_TSCONFIG_PATH=tsconfig.json node --test --test-concurrency=1 --import tsx test/<focused-test-file>.test.ts
```

- Run `npm --prefix frontend ci --ignore-scripts` only when the iteration changes `frontend/package-lock.json`; the verifier otherwise provisions the canonical `dev` dependencies.
- Use the package-owned test command so `TSX_TSCONFIG_PATH=tsconfig.json` resolves relative to `frontend/` and frontend path aliases remain valid.
- Keep the complete frontend suite at `--test-concurrency=1`; its integration files mutate shared browser globals and higher concurrency creates cross-file interference while increasing workstation load.
- Do not invoke the complete frontend suite as direct `node --test` from the worktree root. That changes the expected package cwd and can leave failed test children holding the verification lease.
- Do not set `--test-concurrency` through `NODE_OPTIONS`; Node rejects that option there.
- If an interrupted verification appears stuck, inspect it read-only with `node bin/decision-os-workload-status.mjs`. Terminate only the exact agent-owned failed process group before starting another verification.

## Card Image Assets

Markdown image assets can be referenced from the active workspace `.decision-os` directory:

```markdown
![Campaign UI Summary](.decision-os/ui-mockups/campaign-ui-3-summary.png)
```

The backend serves image files from `/.decision-os/...` for the active workspace only. Adjacent standalone images, including image-only lines separated by blank lines, render as a carousel. Image frames resize by width, derive height from the loaded image aspect ratio, and persist dimensions in the card JSON under `imageSizes`, keyed by the markdown image URL.
