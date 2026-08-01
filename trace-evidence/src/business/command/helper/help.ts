/**
 * WHAT: Defines the agent-facing trace-evidence command contract.
 * WHY: Background job, batch scope, and evidence filters must be discoverable from the executable.
 */
export function help(): string {
  return `trace-evidence — Produce complete test and task execution evidence.

Usage: trace-evidence <command> [options]

Background jobs:
  start-tests [options] -- <test-command> [args...]
      Run selected tests under one repository verification lease.
  start-tasks --project <id> [--card-id <id>]... [options]
      Collect existing evidence for selected cards and executions.
  status --job <id> [--json]
      Show phase, scope progress, process state, counts, and failures.
  wait --job <id> [--until evidence|complete] [--timeout <duration>] [--json]
      Wait for raw evidence or the complete derived report.
  cancel --job <id>
      Cancel collection and preserve evidence already captured.
  report --job <id> [--format markdown|json]

Discovery and events:
  cards --project <id> [--card-id <id>]... [--json]
  sessions --project <id> [--card-id <id>]... [--json]
  events --job <id> [--event-name <name>]... [--limit <n>] [--json]

Common options:
  --repo-root <path> --runtime-root <path> --telemetry-root <path>
  --output <path> --cwd <path> --timeout <duration>
      --cwd is the sole child working directory; do not combine it with env --chdir or -C.

Test selection:
  --test-file <path>                 Repeatable.
  --test-name <pattern>              Repeatable.
  --env <name=value>                 Repeatable.

Task selection:
  --card-id <id>                     Repeatable.
  --execution-id <id>                Repeatable.
  --session-id <id>                  Repeatable.
  --provider-session-id <id>         Repeatable.
  --execution <default|latest|active>
  --replica <id>
  --include-subtasks

Event view:
  --event-type <type> --item-type <type> --event-name <name>
  --status <status> --source <source> --since <ISO-8601> --until <ISO-8601>
  --limit <n>                        Limits displayed records only.

Trace contents:
  --stacks <raw|mapped|both> --source-map <path> --arguments <none|safe|all>
  --logs <stdout|stderr|both> --include-presentation --include-raw-codex
  --include-file-details --redaction <profile> --graphify <off|touched|all>
  --graphify-timeout <duration> --max-artifact-bytes <bytes>

Output:
  --format <markdown|json> --json --quiet
`;
}
