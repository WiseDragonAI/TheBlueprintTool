# Full Production Rollback

## A. Canonical Boundary

1. Rollback is release-tag-owned and moves production forward through a corrective `main` commit and a new annotated release tag.
2. Do not prepare a detached production release worktree, switch a `current` release pointer, reset published `main`, or run the server through `~/.decision-os-production/releases/`.
3. The production workstation runs from the canonical primary `main` checkout through its registered MultiTerm process.
4. A rollback is complete only when parent and child Git authority, Cloudflare relay, canonical application source, supervisor, durable incidents, federation, and post-restart health agree.

---

## B. Read-Only Admission

1. Record the rejected release tag, target predecessor tag, current `main`, `origin/main`, both tag objects and peeled commits, current `.decision-os` gitlink, child refs, and submodule sources.
2. Record all parent and child staged, unstaged, untracked, ignored runtime, active Git operation, branch, and worktree state before mutation.
3. Record Cloudflare deployment and version IDs, traffic percentages, tags, messages, live relay health, application health, MultiTerm registration, process source path, active incidents, pause registries, and replication status.
4. Preserve every post-target commit and dirty byte through its owning repository before corrective edits.
5. Stop when the exact target tag, matching child gitlink, preserved work, and relay predecessor cannot be resolved.

---

## C. Create The Corrective Release

1. Keep `main` forward-moving. Restore the target tag's intended application and relay source through reviewed corrective changes on current `main`.
2. Preserve deployment tooling and documentation that remain valid after rollback.
3. Verify the resulting runtime behavior and complete changed-path inventory.
4. Commit the correction with `WHAT:` and `WHY:`, update the matching `.decision-os` child gitlink through its own commit when required, and push `main` without force.
5. Create and publish the next annotated `rel-X.Y.Z` plus `devrel-X.Y.Z` boundary through the fixed merge/release workflow. The prior tag remains immutable.
6. A literal published-ref rewind requires separate explicit operator authorization and complete preservation evidence; it is not the normal rollback method.

---

## D. Align The Relay Before Application Restart

1. From canonical primary `main`, deploy the corrective release tag:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-deploy-relay.mjs rel-X.Y.Z --json
   ```

2. Require the command to record the active predecessor, activate exactly one tagged Worker version at 100 percent, and verify production health.
3. Require production Worker identity, namespace, protocol, schema, baseline epoch, and the corrective tag's resolved compatibility fingerprint.
4. Do not restart the production application while Cloudflare serves the rejected release line.

---

## E. Activate Canonical Application Source

1. Confirm MultiTerm registration uses `/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs` and the production catalog root.
2. Require explicit production restart authorization.
3. Restart only the registered process on port `50150`; do not launch a parallel server.
4. Verify the live process resolves source from `/home/jbb/dev/EditorBP/decision-os`, `/` returns HTTP `200`, and `/api/health` remains available.
5. Confirm the phone's node-owned release and supervisor separately before changing it.

---

## F. Recover Durable Runtime State

1. Git and relay restoration do not erase active pause state in the runtime incident ledger.
2. Read `/api/diagnostics/incidents` after code and relay alignment.
3. Resume each affected scope only after re-reading and validating its durable state through `POST /api/diagnostics/runtime/resume`.
4. Preserve resolved incident history. Do not delete or replace the incident ledger to clear presentation.
5. Restart the registered workstation process a second time after recovery and require zero unintended rehydrated pauses.

---

## G. Final Proof

1. Report rejected, target, and corrective release tags plus their resolved commits.
2. Report parent `main`, `origin/main`, child gitlink, child source ref, preserved post-target work, and the corrective commits.
3. Report Cloudflare deployment ID, Worker version ID, traffic percentage, release tag, compatibility fingerprint, environment, namespace, protocol, schema, and baseline epoch.
4. Report the canonical MultiTerm command, live process source path, application health, and every recovered scope.
5. Require no new rollback incidents, zero unintended pauses after the second restart, connected federation, and available projects.
6. Require real two-node convergence when the rollback affects synchronization behavior. An offline phone cannot close that proof.
7. Do not report rollback complete while any Git, relay, application, supervisor, incident, federation, project, or convergence authority disagrees.
