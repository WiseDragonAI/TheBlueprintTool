## A. The Problem

1. **Epoch 4 identifies each Codex run by `executionId`, but the log panel still requests a session.**
2. The server selects the latest execution from that session.
3. The frontend then uses JSONL line numbers to separate the session into executions.
4. Epoch 4 stopped returning those line boundaries, so the frontend rejects every event and displays `Waiting for Codex output`.
5. Restoring line numbers would keep the frontend coupled to backend files. The correct fix is to make log reads execution-specific.

---

## B. The Two Requests

1. When the Codex panel opens, the frontend requests the complete lightweight hierarchy for the task:

```text
GET /p/:projectId/api/tasks/:taskId/execution-state
```

2. The response contains:
   1. every session for the task;
   2. every execution in each session;
   3. lifecycle phase, timestamps, model, effort, executor, and error;
   4. every active execution ID;
   5. the default execution ID.
3. When an execution is selected, the frontend requests that exact execution:

```text
GET /p/:projectId/api/task-executions/:executionId
```

4. The backend parses the correct JSONL segment and returns one complete structured presentation snapshot.
5. The frontend displays that snapshot directly. It does not receive file paths and line numbers.

---

## C. Todo Lists

1. **Todo lists are not removed.**
2. The current backend already recognizes native `todo_list` events and preserves their ordered `{text, completed}` items.
3. The new response keeps them as a dedicated event:

```json
{
  "id": "todo:current",
  "kind": "todo_list",
  "status": "in_progress",
  "items": [
    { "text": "Inspect the execution state", "completed": true },
    { "text": "Fix the log projection", "completed": false }
  ]
}
```

4. The change removes only the current encoding trick where those items are stored as JSON inside a generic `output` string.
5. **The frontend must render the latest todo snapshot as an overlay on the Codex Log.**
6. The overlay stays visible while log messages scroll underneath it.
7. A newer todo snapshot replaces the previous overlay state.
8. Completed and pending markers remain visible.
9. When the selected execution has no todo event, the overlay is absent.
10. Changing the selected execution immediately replaces the overlay with that execution's todo state.

---

## D. What Is Removed

1. **Raw tool-result bodies:** command stdout, stderr, aggregated output, and duplicated fenced result text.
2. **Backend file details:** JSONL paths, stderr paths, `line`, `sourceLine`, `startLine`, `turnStartLine`, and `endLine`.
3. **Session-latest guessing:** selecting an execution no longer means asking for its session and hoping the server selects the intended execution.
4. **Frontend JSONL segmentation:** the browser no longer decides which file lines belong to an execution.
5. **Incremental transport machinery:** `since`, cursors, pagination, event merging, and `ETag` state.

---

## E. What Remains

1. Agent messages.
2. Execution comments.
3. Thinking messages.
4. **Todo lists and their overlay.**
5. Tool name and command.
6. Tool running, completed, and failed state.
7. Tool exit code.
8. File-change path and action summaries.
9. Warnings, errors, and transport diagnostics.
10. Execution lifecycle, timing, model, effort, executor, and aggregate counts.
11. Complete session and execution history for the task.

---

## F. Epoch 4 Migration

1. **No durable-state migration is required.**
2. Epoch 4 execution entities already contain `taskId`, `sessionId`, and `executionId`.
3. The server derives the task hierarchy from the existing execution repository.
4. No replicated session entity is added.
5. No task-summary file is added.
6. Log presentation events are not added to the CRDT.
7. Historical JSONL files and artifact objects remain unchanged.

---

## G. Implementation and Deployment

1. **Backend stage:**
   1. add the task-summary endpoint;
   2. add the exact-execution endpoint;
   3. add the lightweight presentation builder;
   4. preserve typed todo items;
   5. keep the old session route temporarily;
   6. test exact execution selection and absence of raw tool results;
   7. deploy and restart the registered backend after operator authorization.
2. **Epoch 4 production gate:**
   1. complete Mobile migration;
   2. deploy the relay Epoch 4 namespace;
   3. verify convergence;
   4. verify both executor nodes expose the new endpoints.
3. **Frontend stage:**
   1. load the task summary;
   2. load the selected execution;
   3. replace the selected snapshot atomically;
   4. render the latest todo list as the Codex Log overlay;
   5. remove line filtering and raw tool-result disclosure;
   6. verify the reported Rudy task on the served route.
4. The frontend stage is deployed only after every executor backend supports the new routes.
