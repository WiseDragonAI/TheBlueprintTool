## A. Scope

1. Inventory and replace direct task-aggregate writes in server mutation routes, CLI operations, Codex launch and completion, pipeline execution, project sync, transcription metadata, and background cleanup.
2. Submit atomic field changes to the local issuer and return success only after durable acceptance.
3. Route Control Room, canvas, navigation, card metadata, task lifecycle, Codex, pipeline, and diagnostic reads through the worker-owned projection API.
4. Prevent writers from replacing a stale aggregate and prevent readers from parsing `.decision-os/tasks.json` as reconstruction authority.
5. Keep content writes outside the event API and join content availability from the independent replica cache only at read presentation.

---

## B. Acceptance

1. Static enforcement finds no task-state writer that bypasses event authority and no task reader that bypasses the projection API.
2. Deleting `.decision-os/tasks.json` while the server is stopped reconstructs the compatibility export from snapshot plus event tail at startup.
3. Parallel callers preserve non-conflicting changes and expose incompatible same-date writes as conflicts.
4. Task metadata reads succeed while content state is `missing` or `synchronizing`.
5. Existing task workflows retain observable behavior after routing changes.
