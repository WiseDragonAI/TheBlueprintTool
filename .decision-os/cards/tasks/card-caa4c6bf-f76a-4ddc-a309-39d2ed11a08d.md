## A. Implemented Execution Contract

1. **Universal CLI:** initial, continued, replacement, and pipeline children retain the server-owned `ledger-cli` shim and project environment.
2. **Catalog root:** children now receive `DECISION_OS_MASTER_ROOT` for catalog-scoped run queries.
3. **Fresh worktree:** `execution-profile` returns deterministic `npm ci --ignore-scripts --prefix <package>` commands for missing package-local dependencies.
4. **Tests and typechecks:** after bootstrap, the profile returns exact worktree-local TSX and TypeScript commands behind the repository verification lease.
5. **Reason:** Node ESM resolves bare dependencies from the importing worktree source, so primary-checkout loader paths alone cannot replace package-local installation.

---

## B. Verification

1. **Probe:** a real isolated-worktree profile identified only the missing frontend bootstrap and returned valid backend and CLI commands.
2. **Execution:** those local commands passed both typechecks, focused backend tests, and the full `53/53` CLI suite.
3. **Merge:** implementation is included in `5adc394` and its discoverability correction in `cb4d323`.

---

## C. Remaining Gate

1. **Production evidence:** keep this card `todo` until new card and pipeline sessions use the merged runtime and profile without CLI discovery, dependency discovery, or symlink creation.
