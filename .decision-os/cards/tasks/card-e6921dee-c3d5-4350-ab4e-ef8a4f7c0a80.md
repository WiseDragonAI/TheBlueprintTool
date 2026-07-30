## A. Correction

1. **This is over-engineered if it adds a delivery registry, release manifest, deployment run table, copied node inventory, relay deployment object, arbitrary-file API, persisted editor document, capability-token store, or revision index.** The simpler anchors are `origin/main`, the admitted `dev` commit, `/api/federation/nodes`, each node's Git `HEAD`, the existing MultiTerm registration, Wrangler deployment history, the project catalog, task-card `contentFile`, the task mutation receipt, CodeMirror state, and Git history.
2. **Required user-visible behavior:** an operator completes authoring on the isolated `dev` canary, invokes one CLI that publishes the admitted commit, deploys the production relay, updates and restarts every admitted node, then opens a directly linked task-card Markdown file in the reusable `80vw` by `95vh` CodeMirror editor instead of receiving the JSON fallback.
3. **Current delivery state is not admissible.** The `dev` worktree is at `34c7e4ae`, `origin/dev` is at `ee7f5cd7`, `main` and `origin/main` are at `f74f7645`, and the authoring implementation remains uncommitted across backend, frontend, tests, shared schemas, and documentation. A delivery preflight must reject this state.
4. **Current canary ownership is already sufficient.** MultiTerm owns production `50150`, canary `50151`, and the local development relay `50152`; the canary runbook records the `dev` worktree, Wrangler environment, health checks, convergence checks, rollback, and cleanup in `documentation/procedure/deployment/canary-skill-authoring-dev-environment.md`.
5. **Selected architecture:** finish the existing identity-scoped authoring implementation, add one derived direct-card redirect plus a task-card adapter for the existing CodeMirror surface, and add one stateless delivery coordinator that derives every phase from Git, Wrangler, federation, health, and MultiTerm.

---

## B. Existing Durable Anchors

1. **Code admission already belongs to Git.** The reviewed `dev` commit identifies the implementation; `origin/main` identifies the published production revision; each node's `HEAD`, branch, worktree status, index, operation state, and reflog identify installation and rollback. A release row would mirror Git.
2. **Node inventory already exists.** `GET /api/federation/nodes` returns the local node plus every relay-observed peer with `nodeId`, label, online state, locality, and projects in `backend/src/business/server/helper/create-http-server.ts:2399-2423`. A nodes manifest would drift from relay presence.
3. **Authenticated node transport already exists.** The federation connector authenticates internal requests through the peer node identity; the existing node-message boundary rejects a requester that is not an online peer at `create-http-server.ts:2425-2433`. Delivery needs a fixed command contract on this transport, not a second transport and not Codex-generated shell instructions.
4. **Process identity and restart already exist.** `multiwezterm-process list` owns `cwd`, command, port, URL, log, process group, enabled state, running state, and restart policy. `multiwezterm-process restart --cwd <cwd> --port <port>` is the exact local supervisor action. A process registry inside Decision OS would duplicate MultiTerm.
5. **Server restart already exists.** `POST /api/server/restart` settles its response and then exits through the configured restart boundary at `create-http-server.ts:3575-3583`. The delivery worker can reuse the same supervisor-owned lifecycle after installing the admitted Git commit.
6. **Relay deployment identity already exists.** `federation-relay/wrangler.toml`, Cloudflare's immutable deployment versions, `wrangler deployments list`, `wrangler rollback`, and relay `/health` own source, version, rollback, protocol, schema, and baseline epoch. A relay-deploy record would mirror Cloudflare.
7. **Project identity already exists.** `DecisionOsProject` owns stable `id`, `root`, `decisionOsRoot`, and ledger definitions; discovery excludes `.worktrees` in `backend/src/business/server/helper/project-catalog.ts:13-35` and `:190-208`. A direct-file project map is unnecessary.
8. **Task-card document identity already exists.** A task card's `comment.contentFile` resolves below the project's `.decision-os` root through `resolveCardContentFile()`; card reads hydrate those bytes and `patch-card` writes the same document atomically through the existing task-state transaction.
9. **Task-card publication already exists.** `commitActiveLedgerMutation()` sends the declared `patch-card` command, checks its exact mutation receipt and task clock, then reloads the authoritative projection in `frontend/src/runtime/ledger/effect/commit-active-ledger-mutation.ts:80-120`. A raw file save would bypass this causal authority.
10. **The reusable editor already exists in the current `dev` implementation.** `mountCodeMirrorFileEditor()` owns text, Markdown mode, line wrapping, history, undo, redo, search, dirty state, focus, and `EditorView.destroy()` in `frontend/src/runtime/codex/component/codemirror-file-editor.ts`. A second editor state object is unnecessary.
11. **Skill revision history already derives from Git.** `readSkillGitHistory()` uses `git log --follow`, and `readSkillGitRevision()` validates the selected commit against that file history before reading content and its adjacent patch in `backend/src/business/codex/helper/skill-git-revisions.ts:189-225`. A revision table and background index add no correctness.
12. **Pipeline-prompt ownership already uses the pipeline store.** The current `pipeline-prompt-library.ts` admits only prompt files referenced by `.decision-os/codex-pipelines.json`. A second prompt registry would duplicate the stable prompt identity and content reference.
13. **The direct-link defect is the final routing fallback.** An unmatched absolute Markdown path is neither an app route nor a static module route, so `create-http-server.ts:4447-4505` returns `{"ok":true,"method":"GET","url":"..."}`. The correction belongs before that fallback.

---

## C. Remove

1. **Remove a delivery registry.** It answers which nodes should receive a release; `/api/federation/nodes` already answers that question at admission time and includes offline peers that must block the operation.
2. **Remove a release manifest.** It answers which commit, relay version, and nodes belong to a release; the CLI input commit, `origin/main`, Wrangler deployment version, and node `HEAD` values already answer those questions.
3. **Remove a persisted delivery status store.** It answers which phase completed; the coordinator can re-read `origin/main`, relay health, Cloudflare deployment history, node `HEAD`, MultiTerm state, node health, and federation convergence after interruption.
4. **Remove a deployment run object.** It adds restart recovery only by duplicating external state and creates a synchronization invariant between the object and Git, Cloudflare, MultiTerm, plus every node.
5. **Remove a copied node configuration list.** All-node delivery means every node returned by the existing federation inventory. An offline node blocks preflight; the tool does not silently omit it.
6. **Remove arbitrary remote command execution.** The node delivery endpoint accepts an exact full commit and expected current commit. It accepts no shell, repository path, branch, process command, port, relay URL, and environment mutation.
7. **Remove a second deployment transport.** The existing authenticated federation request path carries fixed preflight and install requests to remote nodes.
8. **Remove a generic arbitrary-file read and write API.** The concrete direct link supplied by the operator resolves to `.decision-os/cards/tasks/<cardId>.md`, whose owner is a task card. Saving through a raw filesystem route would skip task-state entities, content heads, mutation receipts, and federation publication.
9. **Remove a file capability registry.** The project catalog plus the task projection can prove that one requested path equals one live card's declared `contentFile`. No token needs persistence.
10. **Remove a persisted editor document model.** The card projection owns loaded Markdown, CodeMirror owns the current draft, and the server response owns reconciliation.
11. **Remove a second revision subsystem for task cards.** Skill saves use scoped Git revisions. Task-card body saves use task-state content heads and causal receipts. Combining those authorities would introduce a false cross-system transaction.
12. **Remove a Git history index.** File history, neighboring commits, content, and patches remain cheaply derivable from the repository for the bounded authoring surface.

---

## D. Direct Markdown URL

1. **Use one derived redirect.** Before the JSON fallback, decode the GET pathname, compare its canonical file identity against live card `contentFile` values from the discovered project catalog, and require exactly one matching project, ledger, and card.
2. **Redirect to the existing canonical card route.** The supplied path maps to `/p/:projectId/ledgers/:ledgerId/cards/:cardId?edit=markdown`. The redirect removes the absolute filesystem path from subsequent browser requests and preserves the existing project, ledger, card, navigation-history, and replica boundaries.
3. **Reject every unmatched path.** A `.md` suffix alone grants no read capability. Parent traversal, symlinks, missing files, non-card Markdown, ambiguous matches, unavailable projects, and stale content references do not open the editor.
4. **Reuse the existing card projection for reads.** The canonical card route already hydrates `comment.what` from the authorized `contentFile`; no new content-read endpoint is required.
5. **Add one thin task-card editor adapter.** It passes the card title, filename, current Markdown, read-only state, and callbacks to the existing CodeMirror modal boundary. It owns no filesystem path and no persisted draft.
6. **Save through declared task mutation.** The adapter submits `patch-card` with the card identity and edited description, requires the exact mutation receipt, reloads the scoped card projection, and calls `markSaved()` only after server-confirmed reconciliation.
7. **Preserve rejected drafts visibly.** Network failure, stale projection, unavailable content, and task mutation conflict keep the editor open, keep the draft dirty, expose the server error, and offer one explicit authoritative reload.
8. **Keep history owner-specific.** The skill adapter exposes Git history and Pierre diffs. The task-card adapter exposes the current causal document only; it does not claim that task content heads are Git revisions.
9. **Keep the future attachment boundary unchanged.** The existing CodeMirror adapter comment already states that a thread attachment may reuse the editor after backend authorization. This direct-card route does not add attachment persistence.

---

## E. Single Delivery CLI

1. **Add one operator command:** `node bin/decision-os-deliver.mjs promote --source dev --target main --server http://127.0.0.1:50150`. This invocation owns preflight, publication, relay deployment, node installation, restart, convergence verification, and the final machine-readable summary.
2. **Preflight the source once.** Require a clean `dev` worktree, no staged entries, no Git operation, exact equality between `dev` and `origin/dev`, the complete canary evidence, passing admitted verification evidence, a clean production checkout, and `main` equal to `origin/main`.
3. **Preflight the federation once.** Read `/api/federation/nodes`, require every listed node online, require each node's fixed delivery preflight to report the same repository origin, branch `main`, clean index and worktree, no Git operation, one matching enabled MultiTerm registration, ready health, zero active incidents, no paused scopes, no active task execution, and converged replication.
4. **Preflight the relay once.** Require `CLOUDFLARE_API_TOKEN` without printing it, run the pinned Wrangler dry-run from the admitted source tree, record the current production deployment version, and require the target relay health contract to remain compatible with the running nodes.
5. **Publish without mutating the served production checkout.** Create one temporary detached worktree below `.worktrees`, merge the admitted `origin/dev` commit into `origin/main` with the required `WHAT:` and `WHY:` merge message, push that exact detached `HEAD` to `refs/heads/main`, then remove the temporary worktree. Production continues serving unchanged bytes until node installation.
6. **Deploy the relay from the exact published tree.** Run pinned Wrangler from the temporary release tree, capture the returned Cloudflare version, require production `/health`, and roll back to the recorded prior Cloudflare version before any node installation when health fails.
7. **Use one fixed node-delivery contract.** `POST /api/federation/nodes/:nodeId/delivery` accepts `{action, targetCommit, expectedCommit}` with actions `preflight` and `install`. A remote request is forwarded to authenticated `/api/internal/delivery`; the local node executes the same controller directly.
8. **Use a detached node-local installer.** After returning an accepted receipt, it derives the repository and exact MultiTerm registration, disables that registration, fetches `origin`, verifies the requested full commit equals `origin/main`, requires a fast-forward from `expectedCommit`, installs the commit, re-enables the same registration, and writes bounded progress to the existing MultiTerm process log.
9. **Roll nodes sequentially.** Install remote nodes in stable `nodeId` order, wait for each node to reconnect and report ready health plus the exact target commit, then install the coordinator node last. This preserves the coordinator's federation transport until every remote node is admitted.
10. **Verify the release from live authorities.** Require all node `HEAD` values equal the published commit, all registered processes running, relay health admitted, every project converged, empty runtime-dirty entries, empty pending deliveries, zero paused scopes, zero active incidents, and the production authoring route served from the target commit.
11. **Return one bounded result.** Print prior and target Git commits, prior and deployed Cloudflare versions, each node's prior and final commit, restart observation, health result, and convergence result. Do not persist a parallel delivery object.

---

## F. Recovery and Audit

1. **Preflight failure changes nothing.** The CLI exits before pushing `main`, deploying the relay, stopping a process, changing a node checkout, and restarting a node.
2. **Git publication is independently recoverable.** The detached merge commit and `origin/main` are the audit authority. Re-running the CLI with the same admitted commit detects an already-published target.
3. **Relay failure is contained before node installation.** The CLI restores the recorded Cloudflare deployment version, verifies `/health`, and exits with every node still on its prior commit.
4. **Node installation failure restores availability first.** The detached installer retains the prior commit in memory and the Git reflog. A failed fetch or fast-forward leaves the checkout unchanged and re-enables the original registration. A failed target health check reinstalls the prior commit, restarts the registration once, and records both health results in the MultiTerm log.
5. **Coordinator interruption is resumable without stored phase state.** Re-running preflight derives completed publication from `origin/main`, completed relay deployment from Cloudflare plus `/health`, and completed node installation from each node's `HEAD` plus process health.
6. **Unexpected node loss remains explicit.** When a node does not reconnect, the coordinator stops before touching the next node, reports the exact node and last accepted step, preserves that node's Git locks, reflog, checkout bytes, MultiTerm registration, and log, and requires local recovery on that node.
7. **Audit uses existing evidence.** The merge commit body, remote Git ref, per-node reflog, Cloudflare deployment history, relay health response, MultiTerm logs, node health, and federation diagnostics reconstruct the release without a new database.
8. **Secrets remain outside results.** The CLI checks the Wise SSH key and `CLOUDFLARE_API_TOKEN` by presence, passes them only to their owning subprocess, and redacts environment values and request headers from output.

---

## G. Tradeoffs

1. **No delivery dashboard is added.** Operators inspect one CLI result and the existing Git, Cloudflare, MultiTerm, health, incident, and federation diagnostics.
2. **Delivery is rolling, not zero-downtime across one node.** One node restarts at a time; remaining nodes and the relay stay available.
3. **Every production node must use MultiTerm.** A node without one exact enabled registration fails admission. This is required for deterministic stop, restart, log, and restore ownership.
4. **Protocol compatibility is mandatory during the rolling window.** A relay change that cannot serve both the prior and target node commits is rejected by preflight and requires the existing offline cutover procedure instead of this CLI.
5. **The direct path opens only a live task-card Markdown owner.** Arbitrary repository documentation remains unavailable through the editor until a concrete persistence authority is specified.
6. **Task-card saves do not create automatic Git revisions.** They preserve task-state causal publication. Skill and pipeline-prompt saves retain their scoped Git revision contract.

---

## H. Smallest Next Implementation

1. **First:** finish, verify, commit, and push the current authoring implementation on `dev`; the current dirty worktree is a hard delivery blocker.
2. **Second:** add the derived direct-card redirect, canonical `?edit=markdown` activation, thin task-card CodeMirror adapter, task-mutation reconciliation, and focused route plus frontend regressions.
3. **Third:** add the stateless `decision-os-deliver.mjs` coordinator, fixed federation delivery route, authenticated internal route, detached MultiTerm installer, bounded logging, relay rollback, and failure-injection regressions.
4. **Fourth:** update the authoring architecture and canary runbook with the direct-card contract, exact delivery command, preflight gates, all-node sequence, audit sources, rollback, and local-recovery boundary.
5. **Fifth:** prove the complete served authoring interaction on `50151`, prove the direct task-card URL opens and saves through task state, exercise delivery in the isolated development topology, and retain production promotion as the explicit operator gate.
6. **Decision:** implement this architecture without new registries, manifests, status stores, deployment objects, arbitrary file APIs, editor document models, revision indexes, relay protocols, and Durable Object classes.

---

## Review Reconciliation — 2026-07-30

1. The implementation reused existing SKILL.md identity, source-root ownership, current federation packages, one CodeMirror adapter, focused Git commits, and isolated canary infrastructure.
2. The review found no need for a parallel editor, revision database, or second delivery control plane.
3. This over-engineering analysis artifact is complete.
