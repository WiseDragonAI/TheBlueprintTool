# Task Current-State v2 Cluster Migration Runbook

This runbook performs the one-time offline cutover of every Decision OS node from snapshot/event task storage to causal current-state v2 storage. Run it once for the complete federation. Keep every Decision OS server stopped from the quiescence gate until its local offline validation passes.

## A. Cutover invariants

1. **One storage engine after cutover:** every active project store has `format.json` with `version: 2`. Runtime startup never migrates an existing store.
2. **Registry is authoritative:** migrate every available project in the node's `<catalog-root>/.decision-os/projects.json`, including registered paths that resolve through symlinks.
3. **Ledger checkpoint precedes storage migration:** commit each project's durable `.decision-os` ledger and managed content before running the migration CLI.
4. **All nodes are quiescent together:** no old node may publish task frames after the first node starts v2.
5. **Relay state is rebuilt from v2 owners:** move node-local federation caches into rollback storage. The owners repopulate the relay with causal current state after restart.
6. **Rollback copies remain intact:** retain every `task-state-rollback` directory until cluster acceptance is recorded.
7. **Version vocabulary:** task entities and task-state payloads use `stateVersion: 2`. The federation transport envelope and content manifest remain protocol `version: 1`; those values do not identify legacy task storage.

---

## B. Required release and cutover record

1. Update the Decision OS repository on every node before stopping the cluster:

```bash
export DECISION_OS_REPO=/absolute/path/to/decision-os
git -C "$DECISION_OS_REPO" fetch origin main
git -C "$DECISION_OS_REPO" merge --ff-only origin/main
git -C "$DECISION_OS_REPO" merge-base --is-ancestor 316b9df9 HEAD
```

2. The final command must exit `0`. Commit `316b9df9` introduces the v2 current-state store, explicit offline migration, state-lane replication, and on-demand content lane.
3. On each node, set the catalog root, server port, and durable cutover identifier:

```bash
export CATALOG_ROOT=/absolute/catalog/root
export SERVER_PORT=50150
export MASTER_DOS="$CATALOG_ROOT/.decision-os"
export CUTOVER_ID="$(date -u +%Y-%m-%dT%H-%M-%S.%3NZ)"
export CUTOVER_RECORD="$MASTER_DOS/migrations/task-current-state-v2-$CUTOVER_ID"
mkdir -p "$CUTOVER_RECORD"
git -C "$DECISION_OS_REPO" rev-parse HEAD > "$CUTOVER_RECORD/decision-os-commit.txt"
jq -er '.federationNodeId' "$MASTER_DOS/.settings.json" \
  > "$CUTOVER_RECORD/federation-node-id.txt"
cp "$MASTER_DOS/projects.json" "$CUTOVER_RECORD/projects.json"
```

4. Before cluster quiescence, the coordinator captures the complete known federation node inventory from its running server:

```bash
curl -fsS "http://127.0.0.1:$SERVER_PORT/decision-os/projects" \
  | jq -r '.projects[].replicas[].nodeId' \
  | sort -u \
  | tee "$CUTOVER_RECORD/cluster-node-ids.txt"
test -s "$CUTOVER_RECORD/cluster-node-ids.txt"
```

5. Do not write credentials, `.settings.json`, environment dumps, or voice content into the cutover record.

---

## C. Cluster quiescence gate

1. Disable automatic restart before stopping a Linux node registered in MultiTerm:

```bash
/home/jbb/dev/multiterm/bin/multiwezterm-process disable \
  --cwd "$CATALOG_ROOT" \
  --port "$SERVER_PORT"
```

2. On a Termux node, identify the server whose process working directory is the catalog root, then stop that exact process:

```bash
for pid in $(pgrep -f 'decision-os-server\.mjs|decision-os/backend/src/server\.ts'); do
  if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$(realpath "$CATALOG_ROOT")" ]; then
    kill "$pid"
  fi
done
```

3. Verify the server is gone and the port is closed:

```bash
ps -ef | rg 'decision-os-server|server\.ts' | rg -v rg || true
if ss -ltn 2>/dev/null | rg -q ":$SERVER_PORT[[:space:]]"; then
  echo "BLOCKED: Decision OS still listens on $SERVER_PORT" >&2
  exit 1
fi
```

4. The cluster coordinator must receive this successful gate from every node before any project migration begins.

---

## D. Relay release gate

1. Perform this section once from the cluster coordinator after every node passes Section C.
2. Collect each node's `decision-os-commit.txt` under the coordinator's `node-commits/<federation-node-id>.txt` directory and prove the complete cluster uses one exact commit:

```bash
find "$CUTOVER_RECORD/node-commits" -type f -name '*.txt' -printf '%f\n' \
  | sed 's/\.txt$//' \
  | sort > "$CUTOVER_RECORD/collected-node-ids.txt"
cmp "$CUTOVER_RECORD/cluster-node-ids.txt" "$CUTOVER_RECORD/collected-node-ids.txt"
test "$(find "$CUTOVER_RECORD/node-commits" -type f -name '*.txt' -exec cat {} + | sort -u | wc -l)" -eq 1
cluster_commit="$(find "$CUTOVER_RECORD/node-commits" -type f -name '*.txt' -exec cat {} + | sort -u)"
test "$cluster_commit" = "$(cat "$CUTOVER_RECORD/decision-os-commit.txt")"
```

3. Deploy the relay from that exact Decision OS commit:

```bash
cd "$DECISION_OS_REPO/federation-relay"
npm run deploy | tee "$CUTOVER_RECORD/relay-deploy.txt"
```

4. Verify the deployed relay health endpoint:

```bash
export RELAY_URL=https://your-deployed-relay.example
curl -fsS "$RELAY_URL/health" | tee "$CUTOVER_RECORD/relay-health.json" | \
  jq -e '.ok == true and .service == "decision-os-federation-relay" and .protocolVersion == 1'
```

5. Record the coordinator's Decision OS commit beside the deployment output:

```bash
git -C "$DECISION_OS_REPO" rev-parse HEAD > "$CUTOVER_RECORD/relay-source-commit.txt"
cmp "$CUTOVER_RECORD/decision-os-commit.txt" "$CUTOVER_RECORD/relay-source-commit.txt"
```

6. Do not migrate or restart a node when the cluster commit gate, deployment, health check, or commit comparison fails.

---

## E. Authoritative project inventory

1. Read projects from the persisted registry. Do not use a recursive directory scan as the migration inventory:

```bash
jq -e '.version == 2 and (.projects | type == "object")' "$MASTER_DOS/projects.json"
jq -r '.projects | to_entries[] | [.key, .value.relativePath, .value.name] | @tsv' \
  "$MASTER_DOS/projects.json" | sort | tee "$CUTOVER_RECORD/project-inventory.tsv"
```

2. Resolve every registered path and confirm its durable identity:

```bash
while IFS=$'\t' read -r project_id relative_path project_name; do
  project_root="$(realpath "$CATALOG_ROOT/$relative_path")"
  decision_os_root="$project_root/.decision-os"
  test -d "$decision_os_root"
  test "$(jq -r '.id' "$decision_os_root/project.json")" = "$project_id"
  printf '%s\t%s\t%s\t%s\n' "$project_id" "$relative_path" "$project_name" "$project_root"
done < "$CUTOVER_RECORD/project-inventory.tsv" | tee "$CUTOVER_RECORD/resolved-projects.tsv"
```

3. A missing directory, missing `project.json`, or identity mismatch blocks the node migration.

---

## F. Durable ledger checkpoints

1. Run this section in each resolved project repository before migrating its store.
2. Refuse to mix the checkpoint with previously staged work:

```bash
export PROJECT_ID=registered-project-id
export PROJECT_ROOT=/absolute/resolved/project/root
git -C "$PROJECT_ROOT" diff --cached --quiet || {
  echo "BLOCKED: project index already contains staged changes" >&2
  exit 1
}
```

3. Stage the complete durable Decision OS document set while excluding local settings and derived runtime state:

```bash
cd "$PROJECT_ROOT"
git add -A -- \
  .decision-os \
  ':(exclude).decision-os/.settings.json' \
  ':(exclude).decision-os/cache/**' \
  ':(exclude).decision-os/codex-process-queue.json' \
  ':(exclude).decision-os/memories.sqlite3' \
  ':(exclude).decision-os/migrations/**' \
  ':(exclude).decision-os/runs/**' \
  ':(exclude).decision-os/runtime/**' \
  ':(exclude).decision-os/task-state/**' \
  ':(exclude).decision-os/task-state-rollback/**' \
  ':(exclude).decision-os/voice-uploads/**'
git diff --cached --name-status
```

4. The staged set must include `project.json`, `state.json`, `tasks.json`, every linked ledger JSON file, card Markdown, thread Markdown, and managed card/thread image assets.
5. Commit the reviewed staged set when it contains changes. A clean staged set uses the existing `HEAD` as its checkpoint:

```bash
if ! git diff --cached --quiet; then
  git commit -m 'Commit Decision OS ledger before state migration'
fi
git rev-parse HEAD
```

6. Append the project identity and checkpoint commit to the node record:

```bash
printf '%s\t%s\t%s\n' "$PROJECT_ID" "$PROJECT_ROOT" "$(git rev-parse HEAD)" \
  >> "$CUTOVER_RECORD/ledger-checkpoints.tsv"
```

7. A project without a Git repository blocks migration until its durable ledger has a committed repository checkpoint.

---

## G. Source-state preflight

1. Set the project values from `resolved-projects.tsv`:

```bash
export PROJECT_ID=registered-project-id
export PROJECT_ROOT=/absolute/resolved/project/root
export PROJECT_DOS="$PROJECT_ROOT/.decision-os"
export TASKS_LEDGER="$PROJECT_DOS/tasks.json"
export ACTIVE_STATE="$PROJECT_DOS/task-state/$PROJECT_ID"
```

2. A project with neither `tasks.json` nor an active task-state directory contains no task data. Record it as `fresh-empty`; runtime will create an empty v2 store on first startup:

```bash
if [ ! -e "$TASKS_LEDGER" ] && [ ! -d "$ACTIVE_STATE" ]; then
  printf '%s\tfresh-empty\n' "$PROJECT_ID" >> "$CUTOVER_RECORD/project-results.tsv"
fi
```

3. An active task-state directory without `tasks.json` is a blocker.
4. When a legacy `projection.json` exists, prove that its ledger equals the committed `tasks.json`, belongs to the registered project, and has no unresolved conflicts:

```bash
if [ -f "$ACTIVE_STATE/projection.json" ]; then
  test "$(jq -r '.projectId' "$ACTIVE_STATE/projection.json")" = "$PROJECT_ID"
  test "$(jq '.conflicts | length' "$ACTIVE_STATE/projection.json")" -eq 0
  tasks_hash="$(jq -S -c '.' "$TASKS_LEDGER" | sha256sum | cut -d' ' -f1)"
  projection_hash="$(jq -S -c '.ledger' "$ACTIVE_STATE/projection.json" | sha256sum | cut -d' ' -f1)"
  test "$tasks_hash" = "$projection_hash"
fi
```

5. A hash mismatch or unresolved conflict blocks migration. Repair and commit the canonical ledger before continuing.

---

## H. Per-project offline migration

1. Skip only projects recorded as `fresh-empty`.
2. A verified `format.json` with version `2` means this project already completed the one-time migration. Validate it with Section J and do not run the CLI again.
3. Run the explicit migration for every remaining project:

```bash
cd "$DECISION_OS_REPO/backend"
./node_modules/.bin/tsx src/cli/migrate-task-current-state.ts \
  --decision-os-root "$PROJECT_DOS" \
  --project-id "$PROJECT_ID" \
  --tasks-ledger "$TASKS_LEDGER" \
  | tee "$CUTOVER_RECORD/migration-$PROJECT_ID.json"
```

4. Require a successful result containing the rollback directory and baseline root:

```bash
jq -e --arg id "$PROJECT_ID" \
  '.ok == true and (.backup | length > 0) and (.root | length > 0) and (.baselineRoot | length == 64)' \
  "$CUTOVER_RECORD/migration-$PROJECT_ID.json"
```

5. Move obsolete aliases from this project's active `task-state` directory into recoverable rollback storage:

```bash
while IFS= read -r -d '' alias_root; do
  alias_name="$(basename "$alias_root")"
  if [ "$alias_name" != "$PROJECT_ID" ]; then
    mv "$alias_root" "$PROJECT_DOS/task-state-rollback/legacy-$alias_name-$CUTOVER_ID"
  fi
done < <(find "$PROJECT_DOS/task-state" -mindepth 1 -maxdepth 1 -type d -print0)
```

6. Complete Sections G, H, and J for every registered populated project before touching the node's federation cache.

---

## I. Node-local federation cache cutover

1. Federation caches are derived replicas. Move all former cache families into one recoverable node backup:

```bash
export FEDERATION_ROLLBACK="$MASTER_DOS/task-state-rollback/master-federation-$CUTOVER_ID"
mkdir -p "$FEDERATION_ROLLBACK"

if [ -d "$MASTER_DOS/cache/federation-task-state" ]; then
  mv "$MASTER_DOS/cache/federation-task-state" \
    "$FEDERATION_ROLLBACK/federation-task-state-before-v2"
fi
if [ -f "$MASTER_DOS/cache/federation-task-replicas-v1.json" ]; then
  mv "$MASTER_DOS/cache/federation-task-replicas-v1.json" \
    "$FEDERATION_ROLLBACK/federation-task-replicas-v1.json"
fi
if [ -d "$MASTER_DOS/cache/federation-content-v1" ]; then
  mv "$MASTER_DOS/cache/federation-content-v1" \
    "$FEDERATION_ROLLBACK/federation-content-v1"
fi
```

2. Verify no active legacy task/content replica artifacts remain:

```bash
test ! -e "$MASTER_DOS/cache/federation-task-state"
test ! -e "$MASTER_DOS/cache/federation-task-replicas-v1.json"
test ! -e "$MASTER_DOS/cache/federation-content-v1"
```

3. The next server start creates `cache/federation-task-state` in v2 format and uses `cache/federation-content-current` for demanded content objects.

---

## J. Offline acceptance for every migrated project

1. Load the actual v2 store and compare its computed root with the committed baseline before any runtime writes occur:

```bash
cd "$DECISION_OS_REPO/backend"
DECISION_OS_ROOT="$PROJECT_DOS" PROJECT_ID="$PROJECT_ID" \
./node_modules/.bin/tsx -e '
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTaskCurrentStateStore } from "./src/business/task-state/helper/task-current-state-store.ts";
const decisionOsRoot = process.env.DECISION_OS_ROOT;
const projectId = process.env.PROJECT_ID;
if (!decisionOsRoot || !projectId) throw new Error("missing_validation_environment");
const store = createTaskCurrentStateStore({ decisionOsRoot, projectId });
const format = JSON.parse(readFileSync(resolve(decisionOsRoot, "task-state", projectId, "format.json"), "utf8"));
const projection = store.projection();
const result = {
  projectId,
  version: format.version,
  formatProjectMatches: format.projectId === projectId,
  rootMatches: format.baselineRoot === store.rootHash(),
  root: store.rootHash(),
  conflicts: projection.conflicts.length,
  entities: store.diagnostics().entityCount,
  journals: store.diagnostics().journalCount,
};
console.log(JSON.stringify(result));
if (result.version !== 2 || !result.formatProjectMatches || !result.rootMatches || result.conflicts !== 0 || result.journals !== 0) process.exit(1);
' | tee "$CUTOVER_RECORD/validation-$PROJECT_ID.json"
```

2. Prove the active project store contains no event, snapshot, projection, pending-peer, or JSONL artifact:

```bash
legacy_artifacts="$(find "$PROJECT_DOS/task-state/$PROJECT_ID" \
  \( -type d \( -name events -o -name snapshots \) \
  -o -type f \( -name projection.json -o -name pending-peers.json -o -name '*.jsonl' \) \) \
  -print)"
test -z "$legacy_artifacts"
```

3. Confirm the only active store directory is the registered project identity:

```bash
test "$(find "$PROJECT_DOS/task-state" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)" = "$PROJECT_ID"
```

4. Do not restart the node until every populated project has a successful `validation-<project-id>.json` record.

---

## K. Staged cluster restart

1. Sort the recorded federation identities lexically and restart one node at a time in that order:

```bash
cat "$CUTOVER_RECORD/federation-node-id.txt"
```

2. After each start, run Section L steps 1 and 2 on that node. Start the next node only after those local checks pass.
3. Restart a Linux MultiTerm registration:

```bash
/home/jbb/dev/multiterm/bin/multiwezterm-process restart \
  --cwd "$CATALOG_ROOT" \
  --port "$SERVER_PORT"
```

4. Start a Termux home catalog server:

```bash
setsid sh -c 'cd "$1" && exec env PORT="$2" DECISION_OS_FRONTEND_ROOT="$3/frontend" "$3/bin/decision-os-server.mjs" >> "$4" 2>&1' \
  sh "$CATALOG_ROOT" "$SERVER_PORT" "$DECISION_OS_REPO" "/tmp/decision-os-v2-$SERVER_PORT.log" \
  </dev/null >/dev/null 2>&1 &
```

5. Verify the process and HTTP surface:

```bash
ps -ef | rg 'decision-os-server|server\.ts' | rg -v rg
curl -fsS -I "http://127.0.0.1:$SERVER_PORT/"
curl -fsS "http://127.0.0.1:$SERVER_PORT/decision-os/projects" \
  | jq -e '.projects | type == "array"'
```

---

## L. Online state and content acceptance

1. Poll replication diagnostics for up to 30 seconds while the relay acknowledges initial state:

```bash
export BASE_URL="http://127.0.0.1:$SERVER_PORT"
for attempt in $(seq 1 30); do
  curl -fsS "$BASE_URL/api/federation/replication-status" \
    > "$CUTOVER_RECORD/replication-status.json"
  if jq -e '
    (.stateLane.runtimeRetryProjects | length) == 0 and
    ([.stateLane.projects[] | select(
      .projectionVersion != 2 or .conflictCount != 0 or .journalCount != 0
    )] | length) == 0
  ' "$CUTOVER_RECORD/replication-status.json" >/dev/null; then
    break
  fi
  sleep 1
done
```

2. Require v2 projections, no conflicts, no pending journals, and no runtime retry backlog:

```bash
jq -e '
  (.stateLane.runtimeRetryProjects | length) == 0 and
  ([.stateLane.projects[] | select(
    .projectionVersion != 2 or .conflictCount != 0 or .journalCount != 0
  )] | length) == 0
' "$CUTOVER_RECORD/replication-status.json"
```

3. After every owner node is online, run this complete section on every node and require at least one settled convergence entry:

```bash
jq -e '
  (.stateLane.convergence | length) > 0 and
  ([.stateLane.convergence[] | select(
    .converged != true or (.missingBuckets | length) != 0
  )] | length) == 0
' "$CUTOVER_RECORD/replication-status.json"
```

4. Verify on-demand document transfer from a node that does not own the selected project. Use the remote owner and project identity returned by `/decision-os/projects`:

```bash
export REMOTE_OWNER=remote-node-id
export REMOTE_PROJECT=remote-project-id

for attempt in $(seq 1 30); do
  navigation_status="$(curl -sS -o "$CUTOVER_RECORD/remote-navigation.json" -w '%{http_code}' \
    -H "x-decision-os-replica-node: $REMOTE_OWNER" \
    "$BASE_URL/p/$REMOTE_PROJECT/api/ledgers/tasks/navigation")"
  [ "$navigation_status" = 200 ] && break
  sleep 1
done
test "$navigation_status" = 200
navigation="$(cat "$CUTOVER_RECORD/remote-navigation.json")"
card_id="$(printf '%s' "$navigation" | jq -r '.cards[0].id')"
test -n "$card_id"
test "$card_id" != null

for attempt in $(seq 1 30); do
  status="$(curl -sS -o "$CUTOVER_RECORD/remote-card.json" -w '%{http_code}' \
    -H "x-decision-os-replica-node: $REMOTE_OWNER" \
    "$BASE_URL/p/$REMOTE_PROJECT/api/ledgers/tasks/cards/$card_id")"
  [ "$status" = 200 ] && break
  sleep 1
done
test "$status" = 200
```

5. Confirm the demanded content queue drains without error:

```bash
curl -fsS "$BASE_URL/api/federation/replication-status" \
  | tee "$CUTOVER_RECORD/replication-status-after-content.json" \
  | jq -e '
      .contentLane.queueDepth == 0 and
      ([.contentLane.resources[] | select(.error != "")] | length) == 0
    '
```

6. Record node acceptance only after all commands in this section pass:

```bash
printf '%s\t%s\taccepted\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "$SERVER_PORT" \
  > "$CUTOVER_RECORD/node-accepted.tsv"
```

---

## M. Rollback boundary and procedure

1. **Safe rollback boundary:** rollback is lossless only before the restarted v2 node accepts a local mutation or merges a remote v2 entity.
2. If offline validation fails before restart, leave the server stopped, move the failed v2 directory aside, and restore the exact project backup reported by `migration-<project-id>.json`:

```bash
failed_root="$PROJECT_DOS/task-state/$PROJECT_ID"
backup_root="$(jq -r '.backup' "$CUTOVER_RECORD/migration-$PROJECT_ID.json")"
mv "$failed_root" "$PROJECT_DOS/task-state-rollback/failed-v2-$PROJECT_ID-$CUTOVER_ID"
mv "$backup_root" "$failed_root"
```

3. Restore the project repository to its recorded ledger checkpoint before running the former server release.
4. If failure occurs after v2 writes or merges, stop the complete cluster. Restoring the former store discards every v2 change made after the baseline. Preserve the failed v2 directories and obtain an explicit operator decision before performing that rollback.
5. Keep the relay and project rollback directories after acceptance. Remove them only through a separately reviewed cleanup operation.

---

## N. Cluster completion record

1. The cutover is complete when every registered project has an offline validation record, every node has `node-accepted.tsv`, all convergence entries are settled, and one remote task document has transferred on demand.
2. Collect these non-secret records from every node:

```text
decision-os-commit.txt
federation-node-id.txt
projects.json
project-inventory.tsv
resolved-projects.tsv
ledger-checkpoints.tsv
migration-<project-id>.json
validation-<project-id>.json
replication-status.json
replication-status-after-content.json
node-accepted.tsv
```

3. The coordinator also retains `cluster-node-ids.txt`, `collected-node-ids.txt`, `node-commits/`, `relay-deploy.txt`, `relay-health.json`, and `relay-source-commit.txt`.
4. Record the completion timestamp and retain the rollback paths with the release record.
