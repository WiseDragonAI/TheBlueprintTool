# Report Codex Pipeline Cost and Active Execution Time

## A. Purpose

1. `bin/decision-os-pipeline-cost.mjs` reports each selected pipeline step, each Codex run, and one deduplicated summary.
2. Active execution time is the union of run intervals. Idle calendar gaps are excluded, and overlapping runs are counted once in aggregate durations.
3. Cost is reported only when the run contains a terminal `turn.completed` usage receipt and the model has registered pricing.

---

## B. Commands

1. Report every durable run in the current workspace:

   ```bash
   node bin/decision-os-pipeline-cost.mjs
   ```

2. Report every pipeline run sourced from one card:

   ```bash
   node bin/decision-os-pipeline-cost.mjs --card-id <card-id>
   ```

3. Report one pipeline manifest:

   ```bash
   node bin/decision-os-pipeline-cost.mjs --pipeline-run-id <pipeline-run-id>
   ```

4. Report one Codex run using its run ID or execution ID:

   ```bash
   node bin/decision-os-pipeline-cost.mjs --codex-run-id <run-id>
   ```

5. Read a different workspace and emit machine-readable JSON:

   ```bash
   node bin/decision-os-pipeline-cost.mjs \
     --workspace /path/to/workspace \
     --card-id <card-id> \
     --json
   ```

---

## C. Cost Contract

1. Rates are expressed in USD per million tokens:

   | Model | Non-cached input | Cached input | Cache write | Output |
   | --- | ---: | ---: | ---: | ---: |
   | `gpt-5.6-luna` | 0.20 | 0.02 | 0.25 | 1.20 |
   | `gpt-5.6-sol` | 5.00 | 0.50 | 6.25 | 30.00 |
   | `gpt-5.6-terra` | 2.00 | 0.20 | 2.50 | 12.00 |

2. Non-cached input is `input_tokens - cached_input_tokens`.
3. Reasoning tokens are already contained in billed output usage and are not added a second time.
4. `recorded_cost` is a verified subtotal. `cost_complete=false` means at least one selected run lacks a usage receipt or registered pricing.
5. A missing usage receipt remains `unavailable`; the CLI never converts it to zero cost.

---

## D. Timing Contract

1. A valid manifest `startedAt` and `finishedAt` pair owns timing when available.
2. Historical manifests without lifecycle timestamps use run-file creation through final-write time.
3. A missing or copied artifact with invalid filesystem chronology reports unavailable timing.
4. Step and summary time merge overlapping intervals before summing them.

---

## E. Failure Handling

1. Invalid `codex-pipelines.json` is reported as an error and remains byte-identical.
2. Stale absolute log paths are not followed into another workspace. The CLI first resolves the workspace-owned run-log location.
3. Unknown command options fail instead of silently widening the report scope.
