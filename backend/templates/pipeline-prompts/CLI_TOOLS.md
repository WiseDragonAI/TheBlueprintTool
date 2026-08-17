# Decision OS CLI tools

`ledger-cli` is available on `PATH`. Use the execution environment; do not locate the CLI and do not edit ledger JSON directly.

## Continue dynamically

In case you are instructed to continue the execution after yours

```sh
ledger-cli queue-skill --skill <skill-name> --model <model> --effort <effort>
```

The command uses `DECISION_OS_SERVER_URL`, `DECISION_OS_PROJECT_ID`, and `DECISION_OS_EXECUTION_ID` from the running execution. Treat a successful response as the end of the current gate turn.

## Queue a saved pipeline from a thread

```sh
ledger-cli queue-pipeline --pipeline <pipeline-id>
```

The command uses `DECISION_OS_SERVER_URL`, `DECISION_OS_PROJECT_ID`, and `DECISION_OS_EXECUTION_ID` from the running execution. A running thread, continuation, or terminal pipeline execution can call it. A successful response links the saved pipeline as the same-task successor, gives a pipeline caller's output card to the new pipeline, and starts it after the caller settles.

## Inspect task state

```sh
ledger-cli card-read --card-id <card-id> [--card-id <card-id>]...
ledger-cli session-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id <master-task-id> --json
ledger-cli card-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> --json
ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <master-task-id> --json
```

`card-read` accepts one to 30 repeated `--card-id` flags, discovers their local projects and ledgers with one catalog scan, and returns each selected card body plus its full thread as Markdown in argument order.

## Inspect prompts

```sh
ledger-cli prompt query --name <prompt-name> [--name <prompt-name>]...
ledger-cli prompt create --name <prompt-name> --description <text> --markdown-file <file>
ledger-cli prompt update --name <prompt-name>
```

`prompt query` reads named server-owned pipeline prompts and prints each prompt verbatim in argument order. `prompt create` commits a new complete Markdown document. To update a prompt, edit `$HOME/.decision-os/pipeline-prompts/<prompt-name>.md` directly, then run `prompt update` to validate and commit that registered working copy. Never use a temporary replacement file for an update.

## Capture a webpage source

```sh
download-webpage <url>
```

`download-webpage` accepts one HTTP or HTTPS URL, writes the complete HTML response body to an isolated temporary `document`, and returns its source metadata as JSON. Preserve the returned document unchanged as verbatim research evidence.

## Inspect repository maps

```sh
tools/map.mjs
tools/map.mjs c [base-directory] [depth]
tools/map.mjs t [base-directory] [depth]
tools/map.mjs d [base-directory] [depth]
```

No argument prints the compact code map. A base directory is an optional repository-relative directory, including nested directories. Depth is an optional non-negative integer that limits expanded directory levels below the map root.

## Answer the operator

```sh
ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id <thread-id> --message-stdin
```

## Record task progress

```sh
ledger-cli master-task-progress --ledger "$DECISION_OS_LEDGER_FILE" --plan-stdin --json
ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> <card-options>
ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> --append <fact> [--append <fact>]...
ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> --replace <fact> [--replace <fact>]...
ledger-cli todo --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id>
ledger-cli done --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id>
```

`--append` adds repeated fact strings to the current card facts. `--replace` sets the complete facts array from its repeated fact strings. Each flag requires one non-empty fact; do not combine the two modes.

## Complete the master task

```sh
ledger-cli master-task-complete --card-id <master-task-id> --ledger "$DECISION_OS_LEDGER_FILE"
```

Use master-task completion only when the operator or the active gate instructions authorize closure.

## Produce the direct handoff

Write the current gate or skill result to the output Markdown path provided by the execution context. That file is the direct input to the next queued skill or returning gate.
