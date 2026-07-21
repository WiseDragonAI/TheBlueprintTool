## A. Contradicted-success root cause

1. **The sorter was not the failure.** The served global endpoint `GET /api/codex/server-skills` returned zero favorites, while the project endpoint used by Process Card returned `implementation-orchestrator`, `retrospect-and-close-task`, and `task-dependency` as favorites.
2. The earlier persistence correction created a server metadata owner for Skills Library but left Process Card on project-owned metadata. Both writes could return `200`, yet the two views continued to hydrate different records.
3. The operator screenshots match the endpoint evidence: Process Card displayed favorite stars first, while Skills Library received no favorite values to sort.

---

## B. Unified metadata owner

1. Favorite and tag metadata now has one server-owned record consumed by both Skills Library and Process Card.
2. Server startup migrates the newest existing favorite and tag values from registered local project stores into that owner, preserving the operator's current selections.
3. Project-scoped and server-scoped skill catalogs overlay the same owner metadata. Metadata-only writes through either view update only that owner.
4. Project-specific default model and effort values remain project-scoped. Skill Markdown and reference behavior are unchanged.
5. Feature commit: `b4239c8e`. Merge commit: `e2ccb5b4`.

---

## C. Verification gate

1. Focused route regression passed `4/4`, including migration, identical project/server hydration, owner-only mutation, and reload.
2. Backend suite passed `198/198`; backend typecheck passed; favorite-first presentation coverage passed `3/3`.
3. The running operator server was not restarted. It still returns zero favorites from the old global endpoint and three from the project endpoint.
4. **State:** implemented; automated checks pass; target-surface hard-reload interaction not yet verified. The master task remains open.

---
