# Epoch-3 Workstation and Phone Production Cutover Postmortem

## A. Incident Summary

1. **Incident window:** The production cutover ran from `2026-07-21T19:25Z` through `2026-07-21T21:51Z` on the workstation, with the phone migration and startup coordinated independently in Termux.
2. **Objective:** Convert each node's local task ledgers and file-backed card, thread, voice, image, and managed-asset content offline into task-state epoch `3`, then let relay anti-entropy join the independent results automatically after startup.
3. **Observed failures:** The workstation initially migrated only two of seven registered local projects, entered a restart crash loop on `task_current_entity_too_large`, later crashed on `unsupported_task_current_state_format` while opening the complete catalog, and briefly launched two cold-start processes for the same port.
4. **Operator impact:** The Control Room was unavailable during the crash loops. When the repository-root server did start, `admin`, `Ardaria`, `rudy`, `MOH`, and the workstation copy of `lys` were absent because the server owned the wrong catalog boundary.
5. **Final state:** The production server runs from `/home/jbb` on `http://127.0.0.1:50150/`; nine local and federated projects are visible; the workstation and phone are connected; all nine observed project roots match the relay; local journals, runtime dirty entries, and pending delivery IDs are empty.

---

## B. Intended Technical Architecture

1. **Offline conversion:** `decision-os-migrate-node.mjs` reads one node's local registry, task ledgers, sidecars, legacy task-state shards, and content files. It writes epoch-3 structural entities, immutable content objects, format markers, migration reports, and rollback backups without contacting the relay.
2. **Independent node identity:** Workstation mutations use `workstation`; phone mutations use `phone`. Independent causal dots preserve node-only values and retain concurrent differences as explicit candidates.
3. **Structural lane:** Cards, lifecycle data, annotations, relationships, thread references, thread-note metadata, and content heads live in bounded epoch-3 entities under `.decision-os/task-state/<projectId>/current/`.
4. **Content lane:** Card Markdown, thread Markdown, voice, images, and managed assets are addressed by SHA-256 under `.decision-os/task-state/<projectId>/objects/`. Only resource heads replicate eagerly.
5. **Relay synchronization:** Each node advertises project roots and `256`-bucket summaries. Mismatched buckets exchange bounded entity frames until local and relay roots are equal.
6. **Write admission:** A federated writer remains blocked until its local root exactly equals the relay root for the project.
7. **Lazy content:** Opening a remote card or thread prioritizes the exact advertised key and hash. The requester retrieves the immutable object through the owning node without transferring the complete content inventory.
8. **Canonical details:** Current architecture is documented in [Epoch-3 task state and federation](../documentation/architecture/epoch-3-task-state-and-federation.md). The repeatable cutover and recovery procedure is [Epoch-3 node cutover](../procedure/deployment/epoch-3-node-cutover.md).

---

## C. Impact and Data Safety

1. **Availability:** Port `50150` did not bind while journal recovery repeatedly threw `task_current_entity_too_large`. A later catalog request terminated the server on a legacy federated cache marker.
2. **Data durability:** The failing mutation remained in a short-lived journal. It was not deleted, edited, or bypassed. The corrected store replayed it successfully and drained the journal only after materialization.
3. **Migration safety:** Every project conversion created a complete external `.decision-os` rollback copy before replacing its active task-state root.
4. **Conflict preservation:** The converged `decision-os` projection retained `36` explicit conflicts. No repair selected a winner for concurrent values.
5. **Secrets:** Investigation checked only whether configuration keys existed. Credential values, `ADMIN_SECRET`, API keys, and node credentials were not copied into logs or KB documents.

---

## D. Timeline

1. **`2026-07-21T19:25Z` — incomplete workstation migration:** The node migration launched with `/home/jbb/dev/EditorBP/decision-os` as `--catalog-root`. That registry contained only `decision-os` and `Search`, so both reached epoch `3` while five projects in the authoritative `/home/jbb/.decision-os/projects.json` registry remained epoch `2`.
2. **Phone cutover — independently completed:** Termux migrated the phone catalog, verified its reports and backups, and started the phone node. Phone federation diagnostics reported `configured: true`, `connected: true`, `nodeId: phone`, and the workstation peer online.
3. **`2026-07-21T21:25:07Z` — durable mutation triggers the crash:** A held mutation for the `New task intake` card wrote a `229,536`-byte journal with `1,479` causal-context entries. Entity construction copied that complete context into each changed register and exceeded the `64 KiB` entity ceiling.
4. **Restart loop:** Every restart called `recoverJournals()`, replayed the retained mutation, reached the same oversized entity assertion, and exited before binding port `50150`.
5. **`2026-07-21T21:40Z` — code repair:** Commit `8a7aa935` changed mutation and register context construction to retain only causal entries relevant to the changed field. The exact production journal replayed successfully on a copied state root.
6. **`2026-07-21T21:42:11Z` — repository-root server recovered:** The corrected process drained the retained journal and returned `HTTP 200`. Catalog inspection then proved that it still hosted only `decision-os` and `Search` locally.
7. **`2026-07-21T21:45:16Z` through `2026-07-21T21:46:05Z` — missing workstation projects migrated:** `admin`, `Ardaria`, `rudy`, `MOH`, and `lys` were converted separately, each with an external rollback directory and migration report.
8. **`2026-07-21T21:47Z` — production catalog root corrected:** The obsolete repository-root MultiTerm registration was replaced with a `/home/jbb` registration using the repository launcher and port `50150`.
9. **Cold-start duplicate:** A monitor observed the new registration before its initial launcher persisted `pgid` and started a second process. The untracked duplicate was terminated; the registered process remained.
10. **Catalog request crash:** The full catalog created remote-only task stores from `/home/jbb/.decision-os/cache/federation-task-state`. Five cache roots still contained legacy `{ "version": 2 }` format markers, so strict epoch-3 validation threw `unsupported_task_current_state_format`.
11. **Cache recovery:** The complete legacy cache was moved to `/home/jbb/.decision-os/task-state-rollback/federation-task-state-v2-cache-2026-07-21T21-48-30Z`. No project state was deleted. The next server start created epoch-3 remote caches and refilled them from relay state.
12. **`2026-07-21T21:49Z` — convergence:** Federation diagnostics reported nine converged relay roots, no missing buckets, no runtime dirty entities, no pending delivery IDs, and zero project journals.
13. **Lazy-content proof:** The first workstation read of phone-owned card `card-dac0b1e3-af9f-4447-a8b9-f941bb7df7ef` returned `HTTP 202` with content state `missing`. The scheduler requested only hash `3fd2b60577dba123ad5fc226250c712088c4b16f078a50efe52420dc2b79f900`; the next read returned `HTTP 200` with content state `available` and the exact card body.
14. **Repository integration:** The sparse-context repair was applied to the phone-updated `origin/main` in an isolated worktree and pushed as `01a41df5` without overwriting the workstation's unrelated Decision OS data changes.

---

## E. Failure One — Configuration Was Assessed from the Wrong Sources

1. **Failed claim:** Early planning said Cloudflare credential environment variables and workstation federation settings were absent.
2. **Contradicting evidence:** `ADMIN_SECRET` existed in the repository `.env`. `/home/jbb/.decision-os/.settings.json` contained `federationRelayUrl`, `federationId`, `federationNodeId: workstation`, and a non-empty `federationNodeCredential`.
3. **Cause:** The assessment inspected a launcher-adjacent settings file instead of first resolving the actual catalog root and settings source used by the production process.
4. **Consequence:** The plan proposed credential remediation and possible relay redeployment that were not required.
5. **Correction:** Configuration checks now distinguish relay administration credentials in the repository `.env` from node federation credentials in the active catalog root's `.decision-os/.settings.json`.
6. **Prevention rule:** Report configuration absence only after resolving the running process `cwd`, launcher environment, catalog root, and effective settings file. Presence checks must redact values.

---

## F. Failure Two — Repository Root Was Mistaken for Catalog Root

1. **Failed invariant:** A node-level migration and production server must use the directory whose `.decision-os/projects.json` enumerates every project owned by that node.
2. **Incorrect transition:** The workstation migration and initial server registration used `/home/jbb/dev/EditorBP/decision-os`.
3. **Evidence:** The repository-root catalog exposed two local projects. `/home/jbb/.decision-os/projects.json` exposed seven: `admin`, `rudy`, `decision-os`, `Search`, `MOH`, `Ardaria`, and `lys`.
4. **Impact:** Five projects remained epoch `2`, and the initial recovered server could not report them as local projects.
5. **Correction:** The five missing projects were migrated offline. MultiTerm now launches the repository binary with `cwd` `/home/jbb`.
6. **Detection gap:** The migration gate verified every project in the selected registry but did not prove that the selected registry was the authoritative production registry.
7. **Prevention rule:** Before migration, compare the intended project inventory with the names and paths in `<catalog-root>/.decision-os/projects.json`. Do not infer the catalog root from the code repository location.

---

## G. Failure Three — Project-Wide Causal Context Was Copied into Field Registers

1. **Failed invariant:** A normal mutation must be proportional to the fields it changes, and every serialized structural entity must remain below `taskCurrentEntityByteLimit`.
2. **First incorrect transition:** `createTaskCurrentStateStore().mutate()` set `batch.context` to the complete project clock. `registerEntity()` then copied that context into every changed field register.
3. **Amplifier:** Epoch-3 migration created distinct causal replica IDs for many recovered entities. The `decision-os` project clock therefore contained `1,479` entries even though the failing mutation changed only three logical values.
4. **Failure mechanism:** The journal write succeeded because journals admit mutation batches. Replay called `finalizeTaskCurrentEntity()`, whose encoded-size assertion rejected the constructed entity with `task_current_entity_too_large`.
5. **Restart mechanism:** `recoverJournals()` runs during store construction. Because the journal correctly remained durable after the failed materialization, every restart reproduced the same stack before server listen.
6. **Repair:** `mutationContext()` now joins only clocks for changed entity paths. `registerContext()` intersects the current field clock with the mutation's observed context, then adds the new mutation dot.
7. **Why the repair is causal:** A field register needs the causal history observed for that field. Unrelated entity and unrelated field clocks do not contribute to dominance for the changed register.
8. **Regression:** The new unit fixture builds an `800`-entity migration-sized clock above `64 KiB`, proves a new unrelated mutation has an empty context, proves its entity remains bounded, writes a retained journal with the old global context, and proves restart replay sparsifies and drains it.
9. **Production replay evidence:** The copied production state retained `4,463` entities, drained the single journal, recovered `New task intake`, and kept root `c14813294536516de17a417e09d1e614464df8bb5250ee2664b7fc677985f76c` until publication activation.

---

## H. Failure Four — Mixed Epoch Catalogs Were Not Resumable through the Node Migrator

1. **Observed state:** Two workstation projects were already epoch `3`; five authoritative home-catalog projects were epoch `2`.
2. **Current node-migrator behavior:** `migrateNodeTaskCurrentState()` sorts every registered project and calls `migrateTaskCurrentState()` for each. The project migration throws `task_current_state_already_migrated` when `stateSchema` is already `3`.
3. **Consequence:** Re-running the node migrator against `/home/jbb` would migrate earlier sorted legacy projects, then abort at the first already-migrated project. It cannot currently resume a partially migrated catalog atomically.
4. **Recovery used:** With the server stopped, the five remaining projects were migrated independently through the project migration CLI. Each project generated its own report and external backup.
5. **Open corrective action:** Make node migration preflight the complete catalog before writes, classify every project by format, accept verified epoch-3 projects as retained results, and produce one complete node report for mixed-state recovery.
6. **Prevention rule:** Do not start a node-wide migration until the selected catalog and every project format have been inventoried. A mixed epoch catalog requires the documented recovery path.

---

## I. Failure Five — Strict Runtime Admission Rejected Legacy Derived Caches

1. **Failed invariant:** The strict epoch-3 runtime must never load an incompatible task-state format.
2. **Correct strict behavior:** `validateFormat()` rejected legacy cache markers. The assertion prevented version-2 state from joining epoch-3 roots.
3. **Operational gap:** `/home/jbb/.decision-os/cache/federation-task-state/task-state/*/format.json` was derived remote-replica cache, but the offline migration did not archive it. The catalog route instantiated those stores only when remote projects were enumerated.
4. **Observed markers:** Five cache roots for `decision-os`, `Search`, `lys`, `home`, and `pink` contained `{ "version": 2, ... }`.
5. **Impact:** `/` could return `HTTP 200`, then `/decision-os/projects` could terminate the server while constructing remote stores.
6. **Recovery:** The entire `68 KiB` derived cache was moved intact to the rollback area. The strict runtime created new epoch-3 stores and anti-entropy refilled them.
7. **Open corrective action:** Add an offline cutover step that archives incompatible derived federation caches before startup. Runtime project state remains fail-closed.
8. **Prevention rule:** Verification must request `/decision-os/projects`, not only `/`, because remote-store construction is catalog-demanded.

---

## J. Failure Six — MultiTerm Registration Raced Its Monitor

1. **Observed behavior:** Registering the new `/home/jbb` process launched one process under the user service and another under the existing MultiTerm monitor.
2. **First incorrect transition:** `register()` persisted an enabled entry before `launch()` added its `pgid`. During that interval, `monitor()` saw a free port and no live registered `pgid`, then launched the same command.
3. **Impact:** Two CPU-intensive cold starts loaded the same seven-project catalog. One later emitted `EADDRINUSE` after the other bound `50150`.
4. **Recovery:** The exact untracked process group was terminated. The registered process group remained under MultiTerm ownership.
5. **Procedure correction:** Create a new registration with `--no-launch --no-auto-restart`, then use `toggle` to enable and launch it under the registry lock.
6. **Open corrective action:** Persist launch ownership atomically inside `register()` so the external monitor cannot observe an enabled entry without a live `pgid`.

---

## K. Federation and Content Verification

1. **Connection:** `/api/settings/federation` reported `configured: true`, `connected: true`, `phase: connected`, `nodeId: workstation`, an empty `lastError`, and phone online.
2. **Catalog:** `/decision-os/projects` returned nine visible projects: `admin`, `Ardaria`, `rudy`, `decision-os`, `Search`, `MOH`, `lys`, `home`, and `pink`.
3. **State convergence:** `/api/federation/replication-status` returned nine relay convergence rows with `converged: true` and no missing buckets.
4. **Durability:** Every reported project had `journalCount: 0`; `runtimeDirty` and `pendingDeliveryIds` were empty.
5. **Conflict behavior:** `decision-os` reported `36` explicit conflicts. Other observed projects reported zero.
6. **Phone-to-workstation lazy content:** The demanded phone-owned card transitioned from `HTTP 202` and `content.status: missing` to `HTTP 200` and `content.status: available` after one exact-hash fetch.
7. **Workstation-to-phone proof still required at incident close:** The phone must request workstation-owned admin card `card-0a00aacb-0a06-4d89-982f-8a0a4c84e8c7` and verify SHA-256 `44602e60b38c98570248fb85561417a32a405e345a7a36eed473bb680c662638`.
8. **Rollback retention:** Workstation project backups, original node backup, phone backup, migration reports, and the archived legacy federation cache remain retained.

---

## L. Verification Evidence and Limitations

1. **Focused regression:** `task-current-state-store.test.ts` passed `13/13` after adding sparse causal-context and retained-journal coverage.
2. **Related suites:** Store, join, migration, and federation replicator tests passed `35/35`.
3. **Typecheck:** Backend TypeScript checking passed with `--noEmit`.
4. **Exact replay:** A temporary copy of the production task-state root recovered the retained card and drained the journal without altering the held publication root.
5. **Full backend suite:** The run reported `303/304`. `read-card-skill-run-controller.test.ts` failed only in the concurrent full-run environment and passed `7/7` when executed directly with the worktree `TSX_TSCONFIG_PATH`.
6. **Claim boundary:** The focused and isolated evidence proves the repaired task-state path. It does not classify the concurrent full-suite runner failure as fixed.
7. **Runtime evidence:** The final registered process remained alive, returned `HTTP 200`, exposed the complete catalog, connected to the phone, and reported complete relay convergence after restart.

---

## M. Detection Gaps

1. **Credential-source gap:** Planning did not resolve the effective settings and environment sources before declaring credentials absent.
2. **Catalog-completeness gap:** Migration success was accepted without comparing the selected registry to the intended production project inventory.
3. **Entity-size gap:** Tests bounded entity values but did not exercise a small mutation after a migration-sized project clock.
4. **Restart-replay gap:** A retained old-shape mutation journal was not part of restart testing.
5. **Remote-cache gap:** Startup verification checked `/` before a route that materializes remote-only stores.
6. **Process-ownership gap:** Registration verification counted the listener but did not initially count cold-start process groups before port bind.
7. **Bidirectional content gap:** Phone-to-workstation lazy retrieval was proven; the reverse direction remained operator-device evidence.
8. **Commit-traceability gap:** Incident commits had useful subjects but generally lacked a body recording the exact `WHAT` and `WHY`, forcing reconstruction from diffs, logs, and conversation history.

---

## N. Corrective Actions

1. **Complete — sparse mutation context:** `01a41df5` is on `origin/main` and prevents unrelated project clocks from inflating changed registers.
2. **Complete — production catalog ownership:** MultiTerm owns one `/home/jbb` registration on `50150` with automatic restart enabled.
3. **Complete — remaining local migrations:** All seven workstation projects validate `decision-os-task-state/3`, schema `3`, and baseline epoch `3`.
4. **Complete — local content integrity:** Every workstation-owned resource head resolves to an immutable local object.
5. **Complete — derived-cache recovery:** The legacy federation cache is archived and active remote caches use epoch `3` markers.
6. **Complete — commit policy:** `AGENTS.md` and the headless Codex `developer_instructions` require a concise subject and commit body containing `WHAT:` and `WHY:`.
7. **Open — resumable node migration:** Make mixed epoch catalogs preflight-safe and resumable with one node report.
8. **Open — derived-cache cutover automation:** Archive incompatible federation caches during the explicit offline migration procedure.
9. **Open — atomic MultiTerm registration:** Eliminate the enabled-without-`pgid` observation window.
10. **Open — full-suite runner reliability:** Determine why one Codex controller test fails only during the concurrent full backend run.
11. **Open — reverse lazy-content evidence:** Capture the phone reading the named workstation-owned card with the expected hash.

---

## O. Durable Decisions

1. **Migration remains offline:** Neither node requires the other node or the relay to convert local task state.
2. **Synchronization remains automatic:** Once strict epoch-3 nodes start, relay anti-entropy owns state joining and root repair.
3. **The relay is not migration storage:** It joins structural entities and routes exact content requests; it does not replace node-local source files or rollback backups.
4. **Strict format admission remains:** Incompatible project state is rejected. Derived caches are archived and rebuilt instead of weakening the runtime validator.
5. **Journals remain replayable:** A crash after journal durability must recover the mutation through corrected code. Operators do not delete a journal to make startup pass.
6. **Causal context remains lane-specific:** A changed register carries only causal history relevant to that register plus the new dot.
7. **The catalog root is operational state:** Launcher location selects code; process `cwd` selects the production catalog.
8. **Commit history carries decisions:** Every agent-authored commit records both the changed boundary and the reason through `WHAT:` and `WHY:` body paragraphs.

---

## P. Evidence Index

1. **Architecture and migration:** [node-local Epoch-3 migration plan](../working-documents/NODE_LOCAL_EPOCH3_MIGRATION_PLAN.md), [task current-state Epoch-3 cutover](../procedure/deployment/TASK_STATE_V2_MIGRATION_RUNBOOK.md), and [task replication recovery goal](../working-documents/TASK_REPLICATION_RECOVERY_GOAL_2026-07-21.md).
2. **Store implementation:** `backend/src/business/task-state/helper/task-current-state-store.ts`, `shared/task-current-state-core/entity.ts`.
3. **Store regression:** `backend/test/unit/task-state/task-current-state-store.test.ts`.
4. **Migration implementation:** `backend/src/business/task-state/controller/migrate-node-task-current-state.ts`, `backend/src/business/task-state/helper/task-current-state-migration.ts`.
5. **Federation:** `backend/src/business/federation/helper/federation-task-state-replicator.ts`, `backend/src/business/server/helper/create-http-server.ts`.
6. **Runtime diagnostics:** `/api/settings/federation`, `/decision-os/projects`, `/api/federation/replication-status`.
7. **Migration reports:** Each project-local `.decision-os/task-state/<projectId>/migration-report.json`.
8. **Server logs:** `/home/jbb/.local/state/multiwezterm/process-logs/decision-os-50150.log` and `/home/jbb/.local/state/multiwezterm/process-logs/jbb-50150.log`.
9. **Repair commits:** `8a7aa935`, merge `9b0b8d25`, and canonical remote-main commit `01a41df5`.
