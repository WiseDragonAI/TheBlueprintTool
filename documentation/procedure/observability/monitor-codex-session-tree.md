# Monitor Codex Session-Tree Consumption

## A. Start one project-owned monitor

Run the project wrapper from the root Codex session:

```bash
moh-decision codex-tree-monitor
aura-decision codex-tree-monitor
```

`CODEX_SESSION_ID` supplies the root identity. The wrapper supplies the project ledger, so samples append every 60 seconds to:

```text
<project>/.decision-os/metrics/codex-tree/<root-session-id>.jsonl
```

Use `--session-id <id>` when the command is started outside the owning session. Use `--once` for one capture or `--samples <n>` for a finite monitor. `SIGINT` and `SIGTERM` finish the current bounded operation, remove the ownership lock, and stop the monitor. A second monitor for the same output is rejected.

---

## B. Snapshot contract

Every JSONL row contains:

1. root identity and capture timestamp;
2. every recursively linked subagent with parent, path, nickname, depth, model, and latest update;
3. latest request input, model context window, and used/left percentages;
4. cumulative and since-previous-sample model calls, input, cached input, uncached input, output, reasoning output, and total tokens;
5. tree-wide cumulative and delta totals;
6. newly observed Decision OS graph commands with agent, turn, call, operation, normalized graph step, timestamp, and bounded command text.

Recognized graph steps include Program initialization/context/amendment, Iteration start/finish, specialist `phase-start`, task-graph creation/update/commit/gate/completion, and work-package generation.

---

## C. Read compact history

```bash
jq -c '{capturedAt,agents:.aggregate.agents,delta:.aggregate.delta.totalTokens,contexts:[.agents[]|{path,left:.context.leftPercent,input:.context.inputTokens}]}' \
  .decision-os/metrics/codex-tree/<root-session-id>.jsonl
```

```bash
jq -c '.stepEvents[]' \
  .decision-os/metrics/codex-tree/<root-session-id>.jsonl
```

The monitor reads only appended rollout bytes after its first capture. Restart recovery reads the last durable sample so token deltas continue from the preceding capture.
