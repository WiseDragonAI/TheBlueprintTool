## A. Repository Intent

1. **The task summary provides the synchronized task, session, and execution hierarchy.**
2. **Selecting one execution loads one complete operator-facing presentation snapshot.**
3. **Raw tool results remain backend artifacts.**

---

## B. Current Payload Defect

1. **The detailed response returns raw tool results in `output`.**
2. **The normalizer duplicates the same result inside the tool event `text`.**
3. **The frontend renders that result inside the tool disclosure.**
4. **The reported execution response measured approximately `4.1 MB`.**
5. **Tool `output` contributed approximately `1.79 MB`.**
6. **Tool event `text` contributed approximately `1.87 MB`.**
7. **A complete snapshot retaining commands, statuses, messages, and diagnostics measured approximately `185 KB` after removing tool-result bodies.**

---

## C. Correct Execution Presentation Contract

1. **Return one complete snapshot for the selected execution.**
2. **Do not use pagination.**
3. **Do not use a continuation cursor.**
4. **Coalesce tool lifecycle records by `itemId` on the backend.**
5. **Return tool identity, title, command, status, exit code, severity, and timing metadata.**
6. **Do not return tool stdout, tool stderr, aggregated output, and Markdown containing those results.**
7. **Return agent messages, thinking messages, todo-list items, run-status messages, warnings, errors, and transport diagnostics.**
8. **Return aggregate counts calculated by the backend.**
9. **Return a presentation fingerprint for HTTP cache validation.**

---

## D. Example Packet

1. **Response body:**

```json
{
  "executionId": "execution-4",
  "phase": "running",
  "presentationRevision": "sha256-of-compact-presentation",
  "counts": {
    "tools": 38,
    "messages": 4,
    "warnings": 0,
    "errors": 0
  },
  "entries": [
    {
      "id": "tool:tool-1",
      "kind": "tool_call",
      "title": "Search files",
      "command": "rg TODO frontend backend",
      "status": "completed",
      "exitCode": "0",
      "severity": "info"
    },
    {
      "id": "message:answer-1",
      "kind": "agent_message",
      "title": "Codex message",
      "body": "The relevant implementation is in the task-state projector.",
      "status": "completed",
      "severity": "info"
    }
  ]
}
```

---

## E. Backend Integration

1. **Resolve the exact execution from Epoch 4 state.**
2. **Parse its JSONL and diagnostic artifacts.**
3. **Map raw records into a dedicated public presentation type.**
4. **Coalesce repeated tool start, update, and completion records.**
5. **Drop raw tool-result fields before serialization.**
6. **Calculate counts from the complete parsed execution.**
7. **Hash the compact presentation and emit that value as the response `ETag`.**
8. **Return `304 Not Modified` when the frontend sends the same `ETag`.**
9. **Use the same packet builder for local, federated-live, and terminal content-addressed reads.**

---

## F. Frontend Integration

1. **Fetch the task execution-state summary.**
2. **Fetch the complete presentation snapshot for the selected execution.**
3. **Replace the selected execution presentation atomically.**
4. **Render tool metadata without a raw-result disclosure body.**
5. **Render message, thinking, todo, warning, error, and transport bodies.**
6. **Use `If-None-Match` during active execution polling.**
7. **Stop polling after a terminal phase.**

---

## G. Verification

1. **The response contains no tool `output`, stdout, stderr, and aggregated-result body.**
2. **Tool commands, statuses, exit codes, and counts remain visible.**
3. **Agent messages and diagnostics remain visible.**
4. **Repeated tool lifecycle records produce one presentation entry.**
5. **The complete reported execution response remains below the agreed payload ceiling.**
6. **An unchanged active execution returns `304`.**
7. **A changed active execution returns the complete updated snapshot.**
8. **Local, remote-live, and terminal reads return the same public shape.**

---

## H. Operator Decision Summary

1. **Use a complete lightweight execution presentation snapshot.**
2. **Remove the cursor design.**
3. **Keep raw tool results exclusively in backend artifacts.**
4. **Use HTTP cache validation instead of pagination.**
