# Task Procedures

## A. Purpose

1. Task procedures define safe command-line workflows for epoch-4 task-state mutations and versioned task content.
2. Structural task state is owned by the scoped Decision OS command API and federation.
3. Git owns the intentionally versioned card/thread Markdown and source changes; it does not replace task-state federation.

---

## B. Runbooks

1. [Create and publish tasks from the CLI](./create-and-publish-tasks-from-cli.md)
2. [Restore an accidentally tombstoned Epoch-4 note](./restore-accidentally-tombstoned-note.md)

---

## C. Safety Boundary

1. Never edit `.decision-os/tasks.json`, `.decision-os/task-state/**`, immutable task objects, or causal entity shards directly.
2. Never use `git add .` for a task operation.
3. Preserve staged and unrelated operator changes.
