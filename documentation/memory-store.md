# Decision OS Memory Service

## A. Ownership and connection

1. **Runtime:** The shared lesson database is Cloudflare D1 database `decision-os-memories`, exposed only through the authenticated `decision-os-memory-service` Worker.
2. **Client:** Use `tool/memory/memory.mjs`. Do not query D1 directly from Decision OS tasks or skills.
3. **Connection:** Set `DECISION_OS_MEMORY_URL` and `DECISION_OS_MEMORY_TOKEN`. The shared local fallback is the ignored `$HOME/.decision-os/.settings.json` with `memoryServiceUrl` and `memoryServiceToken`; a server-root settings file can override it.
4. **Secret boundary:** Keep the bearer token out of Git, cards, thread replies, logs, and command output.

---

## B. Record contract

1. **Fields:** Every record contains `title`, `body`, `tag`, `subtag`, `project_id`, `type`, `source`, `created_at`, and `updated_at`.
2. **Identity:** Writes upsert on `title + tag + subtag + project_id + type`.
3. **Projects:** Use the canonical ID from `.decision-os/project.json`; use `global` only for lessons that apply to every project.
4. **Types:** Use lowercase slugs. Current types are `code` and `copywriting`; use `game-dev` when game-development lessons are introduced.
5. **Reads:** A project-filtered read includes that project plus `global` records. `list` and `search` return the newest `10` rows unless `--limit` is supplied; the service caps reads at `100`.

---

## C. Usage

1. **Search before adding:**

```sh
node tool/memory/memory.mjs search --root "$DECISION_OS_MASTER_ROOT" --project "$DECISION_OS_PROJECT_ID" --type code --query hydration --limit 10
```

2. **Add or update one record:**

```sh
node tool/memory/memory.mjs add --root "$DECISION_OS_MASTER_ROOT" --project "$DECISION_OS_PROJECT_ID" --type code --title "Stable title" --body "Reusable rule and concise evidence." --tag engineering --subtag rule --source "commit abc; run xyz"
```

3. **List the latest records:**

```sh
node tool/memory/memory.mjs list --root "$DECISION_OS_MASTER_ROOT" --project "$DECISION_OS_PROJECT_ID" --type copywriting --limit 10
```

4. **One-time SQLite migration:**

```sh
node tool/memory/memory.mjs migrate --root "$DECISION_OS_MASTER_ROOT" --source "$HOME/.decision-os/memories.sqlite3" --project "$DECISION_OS_PROJECT_ID" --type code
```

---

## D. Cloudflare operations

1. **Service source:** `memory-service/` contains the Worker, D1 schema, tests, and pinned Wrangler version.
2. **Schema:** Apply `memory-service/schema.sql` to D1 before the first deployment.
3. **Authentication:** Store the shared bearer value as Worker secret `MEMORY_API_TOKEN`.
4. **Verification:** Require authenticated `/health` success, matching source and destination row counts after migration, and representative filtered reads for every active type.
