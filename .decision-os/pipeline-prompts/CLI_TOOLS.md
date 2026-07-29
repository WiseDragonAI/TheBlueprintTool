# Decision OS CLI tools

`ledger-cli` is available on `PATH`. Use the execution environment; do not locate the CLI and do not edit ledger JSON directly.

## Continue dynamically

Queue exactly one skill after the current gate execution. Decision OS runs the selected skill, then runs this gate again in a fresh context with the selected skill result available as the previous result.

```sh
ledger-cli queue-skill --skill <skill-name> --model <model> --effort <effort>
```

The command uses `DECISION_OS_SERVER_URL`, `DECISION_OS_PROJECT_ID`, and `DECISION_OS_EXECUTION_ID` from the running execution. Treat a successful response as the end of the current gate turn.

## Inspect task state

```sh
ledger-cli session-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id <master-task-id> --json
ledger-cli card-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> --json
ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <master-task-id> --json
```

## Answer the operator

```sh
ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id <thread-id> --message-stdin
```

## Record task progress

```sh
ledger-cli master-task-progress --ledger "$DECISION_OS_LEDGER_FILE" --plan-stdin --json
ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> <card-options>
ledger-cli todo --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id>
ledger-cli done --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id>
```

## Complete the master task

```sh
ledger-cli master-task-complete --card-id <master-task-id> --ledger "$DECISION_OS_LEDGER_FILE"
```

Use master-task completion only when the operator or the active gate instructions authorize closure.

## Produce the direct handoff

Write the current gate or skill result to the output Markdown path provided by the execution context. That file is the direct input to the next queued skill or returning gate.
