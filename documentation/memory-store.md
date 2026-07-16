# Decision OS Memory Store

The Decision OS repository owns the catalog-wide database at `<decision-os-repository>/.decision-os/memories.sqlite3` and the CLI at `tool/memory/memory.mjs`. The database is tracked through Git LFS. Codex's internal `~/.codex/memories_1.sqlite` is not part of this contract.

`--root` accepts the Decision OS repository or its catalog parent. When the catalog parent contains a `decision-os` repository, the CLI resolves the database inside that repository so existing `--root "$HOME"` callers remain compatible.

Each memory contains `title`, `body`, `tag`, `subtag`, `project_id`, `type`, `source`, `created_at`, and `updated_at`. The upsert identity is `title + tag + subtag + project_id + type`. Use the canonical project ID from `.decision-os/project.json`; use `global` for a lesson shared by every project. Use lowercase type slugs such as `code` and `copywriting`.

```sh
node tool/memory/memory.mjs add --root "$HOME" --project ZGVjaXNpb24tb3M --type code --title "Stable title" --body "Reusable lesson" --tag engineering --subtag rule --source "commit abc"
node tool/memory/memory.mjs list --root "$HOME" --project ZGVjaXNpb24tb3M --type code
node tool/memory/memory.mjs search --root "$HOME" --project ZGVjaXNpb24tb3M --query hydration --limit 5
node tool/memory/memory.mjs migrate --root "$HOME" --source "$HOME/.codex/memories.sqlite3" --project ZGVjaXNpb24tb3M --type code
```

`list` and `search` return the newest `10` matching rows by default. Pass `--limit <positive-integer>` to request a different bound; filtering is applied before the limit.

After migration, require `quickCheck: "ok"`, matching source and migrated row counts, and a successful filtered read before deleting the legacy database and home-level CLI. Commit database updates through Git LFS only after closing the writer or producing an atomic SQLite snapshot; never commit `-wal` or `-shm` sidecars.
