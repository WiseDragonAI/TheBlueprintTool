# Release-Tag Production Deployment

## A. Canonical Authority

1. The production release input is one published annotated parent tag named `rel-X.Y.Z`.
2. The primary checkout `/home/jbb/dev/EditorBP/decision-os` on branch `main` is the canonical workstation source. Relay and application deployment do not create detached release worktrees and do not use `~/.decision-os-production/releases/` or a `current` release pointer.
3. The 40-character commit resolved from the tag remains an internal compatibility fingerprint for existing relay and application health fields. Operators select and report the release tag.
4. Port `50151` and the dev relay on `50152` are development canaries. Their lightweight state does not admit a production relay release and does not prove production-state synchronization performance.

---

## B. Merge And Publish

1. From the canonical primary `main` checkout, execute the fixed merge tool after merge authorization:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-merge-dev.mjs <maj|min|fix> --json
   ```

2. Publish the exact merge receipt SHA, parent `rel-X.Y.Z` plus `devrel-X.Y.Z` tags, and matching child tags with the Wise SSH identity.
3. Treat the annotated parent `rel-X.Y.Z` tag as the production release identity. Do not replace it with a raw SHA in deployment commands and reports.
4. Deployment-tool and documentation commits may follow the release tag on `main`. Relay admission therefore compares the selected tag only with actual Worker build inputs.

---

## C. Deploy The Relay

1. Run the repository-owned tag command from canonical `main`:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os
   node bin/decision-os-deploy-relay.mjs rel-X.Y.Z --json
   ```

2. The command verifies canonical `main`, the annotated local and published tag, tag ancestry, published tool code, clean Worker build inputs, and exact tag equality for relay source, Wrangler and package manifests, TypeScript configuration, and shared schemas.
3. Before activation, it records the current Cloudflare deployment and Worker version. It uploads a Worker version tagged with the provided release tag, activates that version at 100 percent, and verifies production health.
4. A post-activation health failure restores the captured predecessor and verifies the predecessor compatibility fingerprint.
5. Direct Wrangler mutation is recovery-only. It is not a second routine deployment path.

---

## D. Production Application Boundary

1. Relay deployment does not deploy or restart the workstation application.
2. The production workstation application runs from the canonical primary `main` repository launcher:

   ```text
   /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs
   ```

3. MultiTerm owns the workstation process on port `50150`. Do not register a command through a release symlink and do not launch a second production server.
4. Restart the production workstation only after explicit restart authorization. Use the registered MultiTerm process and verify that its resolved command uses the canonical repository launcher.
5. The phone remains node-owned. Its exact update and restart commands must be observed from its registered supervisor before mutation.

---

## E. Production Proof

1. Record relay health immediately after activation: release tag, resolved compatibility fingerprint, Cloudflare deployment ID, Worker version ID, environment, namespace, protocol, schema, and baseline epoch.
2. Record the production application incident timestamp before activation and require no new post-deploy incidents.
3. Read the real production `/api/federation/replication-status`; record project count, entity count, state bytes, runtime-dirty count, pending deliveries, queued relay entities, active repairs, content queue, and conflicts.
4. Relay flood containment requires zero sustained queued relay entities, zero sustained active repairs, bounded incident growth, and stable application availability during the observation window.
5. Fast full-state synchronization requires two online production nodes, a recorded pre-sync root or inventory on each node, convergence after transfer, equal final roots, transferred bytes, elapsed time, throughput, and zero new incidents.
6. An offline second node proves neither convergence nor speed. Production-state inventory on one node proves the observation used real state, not that state transferred successfully.

---

## F. Current `rel-0.4.0` Evidence

1. `rel-0.4.0` resolves to compatibility fingerprint `312e1b461429792bc2b869ad2c364e73129686b5`.
2. Cloudflare Worker version `ad1cf3ca-76e7-4e5d-9ec8-e877098f69f0` became healthy on `2026-08-08T10:26:45.021Z` with production identity, `decision-os-task-state/4`, schema `4`, and baseline epoch `4`.
3. The following observation window reported zero active incidents, zero new incidents, zero runtime-dirty projects, zero pending deliveries, zero queued relay entities, zero active repairs, and zero content queue.
4. The real production inventory contained 10 projects, 10,253 entities, and 20,241,825 state bytes.
5. The phone was offline. Live two-node convergence and production transfer speed remain unproven.
6. The workstation application still reported an unbootstrapped release identity during that observation. Relay deployment did not activate new application code.
