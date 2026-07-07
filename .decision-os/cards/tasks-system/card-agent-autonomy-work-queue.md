## Summary

decision-os needs to separate conversation threads from autonomous work execution.

Threads are the right place for operator notes and agent replies. They are not the right place to own scheduling, leases, long-running progress, blocking state, approval gates, dependency order, or multi-agent coordination.

The better model is:

1. **Threads:** conversation history.
2. **Tasks:** durable units of work created from operator intent.
3. **Runs:** execution attempts on those tasks.

This gives the operator a multi-thread decision process without forcing every agent to infer state from the latest note in every thread.

---

## Current Constraint

The current system can already find unanswered threads and append agent answers:

- `ledger-cli unanswered` scans thread notes where operator notes appear after the last agent answer.
- `ledger-cli answer` appends a single agent reply.
- Card processing status currently infers work from thread note ownership.

That is useful, but it overloads threads as:

- a queue
- a lock
- a status model
- a transcript
- a progress log
- a recovery surface

Those are different responsibilities and they should not live in one structure.

---

## Recommended Direction

Add a workspace-local work queue:

```text
.decision-os/
  agent-runs/
    tasks.json
    runs/
      run-<timestamp>-<id>.json
    logs/
      run-<timestamp>-<id>.md
```

The operator can still write naturally in card, zone, group, or canvas threads. A task extractor turns eligible operator notes into tasks. Agents work from the task queue, not from raw unanswered-thread scans.

---

## Task Shape

```json
{
  "id": "task-20260706-001",
  "createdAt": "2026-07-06T00:00:00.000Z",
  "updatedAt": "2026-07-06T00:00:00.000Z",
  "status": "ready",
  "priority": 50,
  "source": {
    "ledgerFile": ".decision-os/next-features.json",
    "threadId": "thread-card-...",
    "noteId": "note-operator-...",
    "targetKind": "card",
    "targetId": "card-..."
  },
  "title": "Short work title",
  "request": "Operator-authored request or extracted summary.",
  "scope": {
    "workspaceRoot": "/path/to/workspace",
    "allowedPaths": [],
    "ledgerFiles": [".decision-os/next-features.json"]
  },
  "dependencies": [],
  "approval": {
    "required": false,
    "reason": ""
  },
  "lease": null,
  "lastRunId": null
}
```

Task statuses:

- `triage`: captured but not yet ready.
- `ready`: available to claim.
- `leased`: claimed with a lease expiry.
- `running`: actively executing.
- `waiting-operator`: paused on an explicit decision request.
- `blocked`: cannot proceed without external state or missing information.
- `verifying`: implementation is done and checks are running.
- `done`: completed and reported.
- `cancelled`: intentionally stopped.

---

## Run Shape

```json
{
  "id": "run-20260706-001",
  "taskId": "task-20260706-001",
  "agentId": "codex-<host>-<pid>",
  "startedAt": "2026-07-06T00:00:00.000Z",
  "updatedAt": "2026-07-06T00:00:00.000Z",
  "status": "running",
  "leaseExpiresAt": "2026-07-06T00:20:00.000Z",
  "phase": "implementation",
  "progress": [
    {
      "at": "2026-07-06T00:00:00.000Z",
      "kind": "observation",
      "message": "Located relevant files and tests."
    }
  ],
  "outputs": {
    "changedFiles": [],
    "tests": []
  }
}
```

Run statuses:

- `running`
- `renewed`
- `waiting-operator`
- `failed`
- `completed`
- `abandoned`

---

## Scheduling Rules

1. A worker claims one task by atomically setting `status=leased`, `lease.agentId`, and `lease.expiresAt`.
2. A task with an expired lease returns to `ready` unless the active run is waiting for the operator.
3. Agents renew leases while doing long work.
4. An agent may process multiple tasks only when they are independent and in the same workspace.
5. Dependencies are task ids. A task is runnable only when all dependencies are `done`.
6. Destructive actions, pushes, broad refactors, and ambiguous scope changes require an approval gate unless the operator already authorized them.

---

## Operator Interaction

When an operator note implies work, decision-os creates or updates a linked task and can add a small marker to the thread:

```markdown
# SYSTEM
<!-- decision-os:task {"id":"task-20260706-001","status":"ready"} -->
Task queued for autonomous work.
```

When an agent needs a decision, it writes both:

- `task.status = waiting-operator`
- a normal `# AGENT` note in the source thread with the exact question

When work completes, it writes:

- `task.status = done`
- run evidence with changed files and checks
- a concise `# AGENT` answer in the source thread

This keeps threads readable while making execution state inspectable.

---

## CLI Surface

Start with CLI commands before deeper UI integration:

```bash
ledger-cli tasks list --root /path/to/workspace
ledger-cli tasks extract --ledger .decision-os/next-features.json
ledger-cli tasks claim --root /path/to/workspace --agent-id codex-a --json
ledger-cli tasks renew --task-id task-... --run-id run-...
ledger-cli tasks progress --task-id task-... --run-id run-... --message "..."
ledger-cli tasks wait-operator --task-id task-... --message-file question.md
ledger-cli tasks complete --task-id task-... --run-id run-... --summary-file summary.md
ledger-cli tasks release --task-id task-...
```

First useful implementation:

1. `tasks extract`
2. `tasks list`
3. `tasks claim`
4. `tasks complete`

This replaces manual unanswered-thread polling with a durable queue while keeping the old command available.

---

## UI Surface

Short term:

- Card badge uses linked task status before falling back to note-role inference.
- Thread panel shows linked task id and status near the target title.
- A workspace-level Agent Work drawer lists ready, running, blocked, and waiting tasks.

Medium term:

- Canvas zones can group task batches.
- Operators can approve, cancel, reprioritize, or split tasks.
- Long-running runs stream progress into the drawer without adding noisy notes to the thread.

---

## Autonomy Contract

An autonomous agent loop should:

1. Load workspace instructions and task queue.
2. Claim the highest-priority runnable task.
3. Read the source thread, target card or zone, linked ledgers, and relevant files.
4. Write a run checkpoint before editing.
5. Implement the smallest structurally correct change.
6. Verify with targeted tests or explicit manual checks.
7. Renew the lease as needed.
8. Ask the operator only when the task is ambiguous, high-risk, or externally blocked.
9. Complete the task with evidence and answer the source thread.
10. Claim the next runnable task if budget remains.

This increases autonomy without removing operator control.

---

## Failure Recovery

- Expired leases are visible and reclaimable.
- Runs are not deleted by default.
- A resumed agent reads the latest run log before continuing.
- A failed run records the blocking condition and suggested next action.
- If a task fails repeatedly, it moves to `blocked` instead of looping.

---

## Implementation Phases

### Phase 1: Queue Core

- Add task/run types to `ledger-cli`.
- Add helpers to read/write `.decision-os/agent-runs/tasks.json`.
- Add `tasks extract`, `tasks list`, `tasks claim`, and `tasks complete`.
- Keep extraction conservative: one ready task per unanswered thread.
- Add unit tests for status transitions and lease expiry.

### Phase 2: Status Integration

- Update card work status resolution to check linked tasks.
- Add a backend route to expose task summary with the active ledger payload.
- Show task status in card chrome and thread header.
- Preserve current note-role fallback for old workspaces.

### Phase 3: Operator Control

- Add a workspace Agent Work drawer.
- Add approve, cancel, reprioritize, and release actions.
- Add `waiting-operator` rendering with direct thread focus.

### Phase 4: Long-Run Execution

- Add a runner command that loops over `claim -> work -> complete`.
- Add lease renewal and progress append commands.
- Add stale run recovery.
- Add per-task autonomy budgets and approval policies.

---

## First Cut

Build Phase 1 first and do not modify the frontend yet.

The highest-yield change is a durable queue that can be driven by CLI and inspected in git. Once the queue proves useful, the frontend should render it. Starting with UI would preserve the core flaw: visible threads would still be carrying execution state they cannot safely own.
