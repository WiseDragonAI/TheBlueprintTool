# Full Production Rollback

## A. Purpose And Completion Boundary

1. Use this procedure when the operator requests restoration to an earlier Decision OS production release, including an explicit rewind of published Git refs and Decision OS authored state.
2. A rollback is complete only when all of these authorities agree:
   1. Parent `main` and `origin/main` identify the requested parent release commit.
   2. The primary `.decision-os` child `main` and its configured source identify the child commit recorded by that parent release.
   3. Parent `dev` and `origin/dev` identify the operator-selected development baseline.
   4. Every post-target commit, dirty worktree byte, staged byte, untracked file, conflicted index, nested child state, and divergent ref is reachable from the preservation worktree.
   5. Only the operator-requested persistent branches and worktrees remain.
   6. The production release worktree and `current` pointer identify the target parent commit.
   7. MultiTerm supervises the target launcher and no superseded process survives or can respawn.
   8. Cloudflare serves the verified relay version belonging to the target release boundary.
   9. Durable runtime pause state has been explicitly recovered after code and relay alignment.
   10. A second restart rehydrates zero unintended pauses and live application plus relay health agree.
3. Do not report completion from a clean merge, tag, branch pointer, HTTP `200`, process existence, and repository status alone.

---

## B. Resolve The Exact Target Before Mutation

1. Resolve annotated tags to commits and record both tag objects and peeled commits:

   ```bash
   git rev-parse <parent-release-tag>^{}
   git rev-parse <dev-release-tag>^{}
   git show -s --format='%H%n%P%n%B' <parent-release-tag>^{}
   git show <parent-release-tag>^{}:.decision-os
   ```

2. Resolve the child commit from the parent release gitlink. Do not select a child commit from the current child branch, a similarly named child tag, and a timestamp.
3. Resolve the requested `dev` baseline independently. Parent `rel-X.Y.Z` and `devrel-X.Y.Z` may identify different parent commits by design.
4. Verify the release tag attached exactly to the target commit with `git describe --exact-match <sha>`. `git tag --contains <sha>` also lists later descendant releases and is not tag ownership evidence.
5. Record the current parent and child local refs, remote refs, tags, submodule sources, production pointer, supervisor registration, process tree, relay deployment, relay versions, health response, and durable pause registries before mutation.
6. Stop when the requested parent, child, dev, and relay identities cannot be resolved from authoritative evidence.

---

## C. Inventory And Preserve Every Worktree First

1. Inventory every registered parent worktree before removing any worktree:

   ```bash
   git worktree list --porcelain
   ```

2. For every listed worktree, record its absolute path, HEAD, branch or detached state, parent index, tracked dirt, untracked files, ignored runtime boundary, nested `.decision-os` gitlink, and nested child Git state.
3. Inventory production release worktrees outside the repository `.worktrees/` directory. The active release checkout below `~/.decision-os-production/releases/` is a registered detached worktree.
4. Preserve clean commits by reachability. Preserve dirty and untracked bytes with named stash commits or an equivalent immutable snapshot.
5. A worktree with unmerged index entries cannot be represented by a normal stash. Preserve its index patch, working-tree patch, unmerged-path inventory, and complete affected-file archive with recorded SHA-256 checksums.
6. Preserve nested `.decision-os` child dirt in the child repository before changing the parent gitlink.
7. Create one preservation branch and worktree from the requested development baseline. Anchor every inventoried parent ref, detached HEAD, stash commit, conflict archive, child preservation commit, and inventory document in commits reachable from that branch.
8. Verify every preservation candidate is an ancestor of the final preservation commit. Push the preservation parent branch and publish its child preservation ref before deleting sources.
9. Do not treat stash reflogs, `/tmp`, unpushed refs, and a synthetic commit without verified parents as the only copy of post-target work.

---

## D. Stop At The Supervisor Boundary

1. Inspect the registered production process before stopping it:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process list
   ```

2. Disable the registered production process before terminating its process group:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process disable --cwd /home/jbb --port 50150
   ```

3. Verify the launcher, server child, TypeScript loader, and build-service descendants have exited.
4. Killing only the visible process group is insufficient. The MultiTerm monitor will immediately respawn the old `current` command and can rewrite durable state while restoration is underway.
5. Do not start the production node until the production release pointer and Cloudflare relay both identify the target boundary.

---

## E. Restore Parent, Child, Dev, And Remote Authority

1. Move local parent `main` to the peeled parent release commit and local parent `dev` to the peeled development release commit.
2. Restore the primary child checkout to the exact gitlink recorded by the target parent commit. Update the child `main` ref and its configured source when the operator requested child-main rewind.
3. Update `origin/main` and `origin/dev` only after preservation is published and the operator explicitly authorized published-ref rewind. Use `--force-with-lease` against the inventoried remote SHA, never an unguarded force push.
4. Retain only the branch names authorized by the operator. Delete other local and remote feature refs only after reachability from the published preservation branch is proven.
5. Remove only inventoried inactive worktrees. Retain the preservation worktree and the primary checkout.
6. Remove the superseded production detached worktree only after its process is stopped and the replacement release checkout is ready.
7. Re-run exact ref and worktree inventories. Branch count, worktree count, and remote heads are separate assertions.

---

## F. Restore The Production Release Checkout

1. Prepare an immutable detached production worktree at `<deliveryReleaseRoot>/releases/<target-parent-sha>`.
2. Provision the release dependencies required by its pinned launcher and relay tooling. A release pointer to a checkout without backend, frontend, and federation-relay dependencies is not startable rollback evidence.
3. Atomically replace `<deliveryReleaseRoot>/current` with the target release directory.
4. Verify the symlink target, detached worktree HEAD, release marker, launcher path, and registered MultiTerm command before enabling the process.
5. Do not infer the active code from the symlink alone. After start, inspect the resolved loader and `backend/src/server.ts` paths in the live process tree.

---

## G. Align The Cloudflare Relay Before Node Start

1. A production application rollback does not roll back Cloudflare. Git ref changes, child restoration, release-pointer changes, and workstation restart leave the Worker deployment untouched.
2. Before starting the node, verify without printing values that the repository `.env` is Git-ignored, mode `0600`, and contains non-empty `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`.
3. Prefer the journaled production rollback command when its delivery run exists:

   ```bash
   cd <catalog-root>
   node <target-release>/bin/decision-os-delivery.mjs rollback --delivery-id <delivery-id> --json
   ```

4. The command's `rolled-back-runtime` status is expected compensation evidence, not a successful forward delivery.
5. When no valid journal records the target predecessor, stop normal rollback. Inventory Cloudflare deployment and version authority read-only, then select the exact pre-rejected-line version from its immutable Worker version ID, tag, message, creation time, release SHA, and Git ancestry.
6. A parent release merge may not have uploaded a relay version. In that case the correct relay is the final deployed Worker version before the rejected release line, and its release SHA must be an ancestor of the target parent release.
7. Execute an explicitly authorized emergency activation through the pinned delivery relay boundary. Do not use an unpinned global Wrangler, interactive login, and an inferred previous version.
8. Verify Cloudflare sends `100%` of traffic to the selected Worker version. Query live `/health` and require `status: ready`, the selected `releaseSha`, `environment: production`, Worker identity, Durable Object namespace, and compatible `decision-os-task-state/4` protocol.
9. Do not start the rolled-back production node while the relay still identifies a post-target release.

---

## H. Restore Durable Runtime State Explicitly

1. Repository and release restoration do not reset `<catalog-root>/.decision-os/runtime-incidents.json`. The file contains both occurrence history and enforced active pause state.
2. On startup, active incidents rehydrate `pausedTaskProjects`, `pausedFederatedTaskProjects`, `pausedProjectWatchers`, `pausedProjectRuntimes`, and `pausedBackgroundComponents`.
3. A project displayed as `PAUSED` is not historical decoration. Normal context admission and execution for that scope remain blocked until explicit recovery succeeds.
4. After application and relay alignment, start the registered server, read `/api/diagnostics/incidents`, and recover each active scope through:

   ```text
   POST /api/diagnostics/runtime/resume
   {"scope":"<exact-scope>","resolution":"<verified operator recovery reason>"}
   ```

5. Recover project watcher, project runtime, task-state, federated task-state, and background scopes individually. Do not stop after project rows clear when a System interruption remains.
6. `background:federated-library-sync` is an enforced System interruption. Restore it after relay alignment and verify synchronization succeeds.
7. Preserve resolved occurrence history. Do not delete or replace the incident ledger merely to make the UI green.
8. The System row is conditional incident presentation. It disappears when no active or in-window unowned incident remains; overall health is then represented by the `Ready` header.

---

## I. Start, Restart, And Prove Rehydration

1. Restart through the registered supervisor, not an additional manual launcher:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process restart --cwd /home/jbb --port 50150
   ```

2. Verify all of these after the first start:
   1. One registered process group owns port `50150`.
   2. The resolved live source path is the target release worktree.
   3. `/` returns HTTP `200`.
   4. `/api/health` identifies the target release and reports ready.
   5. `/api/diagnostics/incidents` contains no unintended paused project, task, federation, runtime, and background scope.
   6. Cloudflare `/health` still identifies the aligned relay and Epoch 4.
   7. Federation reconnects without generating new target-line incompatibility incidents.
3. After explicit runtime recovery, restart through MultiTerm a second time.
4. Re-read diagnostics after the second restart. Zero in-memory pauses before restart do not prove durable resolution; zero rehydrated pauses after restart does.
5. Verify the primary parent and child Git states after runtime startup. A running server can update authored incident-review Markdown; separate intended runtime writes from an incorrect release checkout before resetting any file.

---

## J. Required Final Report

1. Report the exact parent main SHA and release tag.
2. Report the exact child gitlink and child ref.
3. Report the exact dev SHA and development tag.
4. Report the preservation branch, preservation commit, child preservation commit, published refs, and preserved exceptional archives.
5. Report remaining local branches, remote heads, registered worktrees, and why each surviving detached production worktree exists.
6. Report the production `current` target, supervisor registration, process source path, and HTTP result.
7. Report the Cloudflare deployment ID, Worker version ID, traffic percentage, live relay release SHA, environment, namespace, and state protocol.
8. Report every resumed scope and the post-second-restart pause registries.
9. State separately whether the application is ready, relay is ready, federation is connected, projects are available, and historical incidents remain visible.
10. Do not say `rollback complete` while any requested ref, child state, preserved work, relay identity, runtime pause, supervisor, restart, and verification boundary remains unresolved.
