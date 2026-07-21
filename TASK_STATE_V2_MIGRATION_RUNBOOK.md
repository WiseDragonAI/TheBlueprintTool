# Task Current-State Epoch 3 Recovery Runbook

## A. Release gate

1. Deploy one reviewed Decision OS commit to every writable node.
2. Record that commit and the registered federation node inventory.
3. Commit each project’s tracked `.decision-os` sidecars before quiescence. Do not stage over an existing index.
4. Keep every server stopped until all migrated project roots and the epoch-3 relay deployment pass validation.

```bash
export DECISION_OS_REPO=/absolute/path/to/decision-os
export CATALOG_ROOT=/absolute/catalog/root
export MASTER_DOS="$CATALOG_ROOT/.decision-os"
export CUTOVER_ID="$(date -u +%Y-%m-%dT%H-%M-%S.%3NZ)"
export CUTOVER_RECORD="$MASTER_DOS/migrations/task-current-state-epoch3-$CUTOVER_ID"
mkdir -p "$CUTOVER_RECORD"
git -C "$DECISION_OS_REPO" rev-parse HEAD > "$CUTOVER_RECORD/decision-os-commit.txt"
jq -er '.federationNodeId' "$MASTER_DOS/.settings.json" > "$CUTOVER_RECORD/federation-node-id.txt"
cp "$MASTER_DOS/projects.json" "$CUTOVER_RECORD/projects.json"
```

---

## B. Cluster quiescence

1. Disable automatic restart for each registered Linux server process.
2. Stop the exact Decision OS process on each node.
3. Verify the configured port is closed.
4. Confirm every node passed this gate before collecting state.

```bash
/home/jbb/dev/multiterm/bin/multiwezterm-process disable \
  --cwd "$CATALOG_ROOT" \
  --port 50150
ps -ef | rg 'decision-os-server|server\.ts' | rg -v rg || true
if ss -ltn 2>/dev/null | rg -q ':50150[[:space:]]'; then
  echo 'BLOCKED: Decision OS still listens on port 50150' >&2
  exit 1
fi
```

---

## C. Authoritative project inventory

1. Use the persisted registry; do not recursively discover projects.
2. Resolve every registered project and verify `.decision-os/project.json` carries the registered identity.
3. Record the tasks ledger and active v2 state root for each project.

```bash
jq -e '.version == 2 and (.projects | type == "object")' "$MASTER_DOS/projects.json"
jq -r '.projects | to_entries[] | [.key, .value.relativePath, .value.name] | @tsv' \
  "$MASTER_DOS/projects.json" | sort > "$CUTOVER_RECORD/project-inventory.tsv"
```

---

## D. Durable sidecar checkpoint

1. Run this gate in every project repository.
2. Stop when the Git index already contains operator-approved staged work.
3. Commit the task ledger, card Markdown, thread Markdown, project metadata, and managed assets.
4. Record the resulting commit in `ledger-checkpoints.tsv`.

```bash
git -C "$PROJECT_ROOT" diff --cached --quiet || {
  echo 'BLOCKED: project index already contains staged changes' >&2
  exit 1
}
git -C "$PROJECT_ROOT" add -A -- \
  .decision-os \
  ':(exclude).decision-os/.settings.json' \
  ':(exclude).decision-os/cache/**' \
  ':(exclude).decision-os/migrations/**' \
  ':(exclude).decision-os/runtime/**' \
  ':(exclude).decision-os/task-state/**' \
  ':(exclude).decision-os/voice-uploads/**'
if ! git -C "$PROJECT_ROOT" diff --cached --quiet; then
  git -C "$PROJECT_ROOT" commit -m 'Checkpoint Decision OS before epoch 3 migration'
fi
printf '%s\t%s\t%s\n' "$PROJECT_ID" "$PROJECT_ROOT" "$(git -C "$PROJECT_ROOT" rev-parse HEAD)" \
  >> "$CUTOVER_RECORD/ledger-checkpoints.tsv"
```

---

## E. Collect every writable v2 state set

1. Copy each node’s complete `<project>/.decision-os/task-state/<project-id>` directory to coordinator storage without modifying it.
2. Record the source node, project, source path, source format marker hash, and tree hash.
3. Include nodes that were offline when the failure was discovered.
4. Do not use the relay cache as the sole migration source.

```bash
export SOURCE_SET="$CUTOVER_RECORD/source-state/$PROJECT_ID"
mkdir -p "$SOURCE_SET"
cp -a "$REMOTE_ACTIVE_STATE" "$SOURCE_SET/$FEDERATION_NODE_ID"
sha256sum "$SOURCE_SET/$FEDERATION_NODE_ID/format.json" \
  > "$SOURCE_SET/$FEDERATION_NODE_ID-format.sha256"
find "$SOURCE_SET/$FEDERATION_NODE_ID" -type f -print0 | sort -z | xargs -0 sha256sum \
  > "$SOURCE_SET/$FEDERATION_NODE_ID-tree.sha256"
```

---

## F. Offline migration

1. Supply every collected v2 state root for the project with a repeated `--source-state-root` argument.
2. The migration joins current v2 registers, hydrates sidecar-backed notes, validates relationships, assigns lifecycle metadata and positions, removes generated body state, captures immutable objects, writes `migration-report.json`, then writes `format.json` last.
3. Preflight failure writes nothing. Failure after backup leaves no epoch-3 marker, so runtime admission remains closed.
4. Keep the returned rollback snapshot until production proof completes.

```bash
source_args=()
while IFS= read -r source_root; do
  source_args+=(--source-state-root "$source_root")
done < <(find "$SOURCE_SET" -mindepth 1 -maxdepth 1 -type d | sort)

cd "$DECISION_OS_REPO/backend"
./node_modules/.bin/tsx src/cli/migrate-task-current-state.ts \
  --decision-os-root "$PROJECT_DOS" \
  --project-id "$PROJECT_ID" \
  --tasks-ledger "$PROJECT_DOS/tasks.json" \
  "${source_args[@]}" \
  | tee "$CUTOVER_RECORD/migration-$PROJECT_ID.json"
```

---

## G. Per-project validation

1. Require epoch `3`, protocol `decision-os-task-state/3`, baseline epoch `3`, and a 64-character baseline root.
2. Review the complete source-value audit, body rewrite report, relationship repair report, semantic inventory, and canonical projection checksum.
3. Confirm every collected source root exists below the returned backup.
4. Compare `baselineRoot` across every node receiving the same migrated project state.

```bash
result="$CUTOVER_RECORD/migration-$PROJECT_ID.json"
format="$(jq -r '.root' "$result")/format.json"
report="$(jq -r '.report' "$result")"
jq -e '
  .stateProtocol == "decision-os-task-state/3" and
  .stateSchema == 3 and
  .baselineEpoch == 3 and
  (.baselineRoot | length == 64)
' "$format"
jq -e '
  .version == 1 and
  (.canonicalProjectionChecksum | length == 64) and
  (.semanticInventory.cards >= 0) and
  (.semanticInventory.relationships >= 0) and
  (.semanticInventory.resourceHeads >= 0)
' "$report"
```

---

## H. Relay deployment

1. Deploy the exact recorded Decision OS commit after every project validates.
2. Epoch-3 relay state uses the `state:v3:` Durable Object key namespace; v2 keys are not read.
3. Verify the health response before starting any node.

```bash
test "$(git -C "$DECISION_OS_REPO" rev-parse HEAD)" = "$(cat "$CUTOVER_RECORD/decision-os-commit.txt")"
cd "$DECISION_OS_REPO/federation-relay"
npm run deploy | tee "$CUTOVER_RECORD/relay-deploy.txt"
curl -fsS "$RELAY_URL/health" | tee "$CUTOVER_RECORD/relay-health.json" | jq -e '
  .ok == true and
  .stateProtocol == "decision-os-task-state/3" and
  .stateSchema == 3 and
  .baselineEpoch == 3
'
```

---

## I. Bootstrap and write gate

1. Start one authoritative host per project first.
2. Require exact relay-root convergence for every hosted project.
3. Start remaining hosts, then the phone, then a blank remote-only node.
4. Keep writers disabled until every node reports the exact project root and the blank node reconstructs the same canonical projection.
5. Verify that connecting transfers zero body objects and opening one remote card fetches only its demanded current hash.

---

## J. Rollback

1. Stop every epoch-3 writer.
2. Restore the project’s complete `.decision-os` snapshot from the migration result’s `backup/decision-os` directory.
3. Restore the recorded pre-cutover repository commit.
4. Redeploy the pre-cutover relay commit.
5. Do not merge v2 writes produced after rollback with epoch-3 state.

---

## K. Retention gate

1. Retain source-state collections, migration backups, reports, deployment output, and checkpoint commits until workstation, phone, and blank-node production proof passes.
2. Remove rollback data only through a separately reviewed retention operation.
