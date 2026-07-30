---
name: gpudebug
description: Mandatory GPU-first instability debugging procedure for physics scenarios (especially scenario 8). Trigger when the user says "gpudebug". Enforces end-to-end diagnosis, shader-only repro tests with real profiled data, paper-purity alignment, and iterative reruns until fixed or decomposed further.
---

# GPUDebug

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

Use this skill when the user says `gpudebug`.

## Mandatory Procedure (No Shortcuts)

1. Run the simulation, preferably scenario 8.
2. Collect profiling from authoritative GPU/live-debug artifacts.
3. Analyze and localize the first instability.
4. Correlate the first instability to the exact runtime code path.
5. If source is unclear or not decomposed enough, decompose and add shader unit tests using real data captured from step 2 to reproduce the bug. CPU mirror tests are forbidden for this step.
6. Rerun scenario 8 (short brick wall) with the new code structure and confirm the exact failing code path.
7. Analyze that code path against the AVBD paper for that specific step and conclude whether impurity exists.
8. Align implementation to paper purity and update shader unit tests accordingly.
   - Every code change must be explicitly derived from the paper (equation, algorithm step, or unambiguous text).
   - If the paper does not specify how to implement a step, do not change runtime behavior for that step.
   - Record exact paper references used for each change in the investigation report.
9. Rerun scenario 8 and conclude fixed or not fixed behavior from profiling evidence.
10. If fixed: commit and report to operator. If not fixed: reassess decomposition (decompose further and/or add more GPU shader unit tests), then repeat from the relevant step.

## First-Failure Gates (Mandatory)

Before any implementation edit, all of the following must be present in the report:
- `first_bad_frame`
- `first_bad_substep_or_tick` (if available)
- `first_bad_body_id` (from all dynamic bodies, not tracked-body default)
- `first_bad_authoritative_signals` (specific `events/*.txt` fields)
- `first_bad_runtime_path` (file/function names)

Scope lock while diagnosing:
- If first bad frame is `N`, analysis must stay in `{N-1, N, N+1}` until the failing code path is proven.
- Do not spend effort on later collapse frames before first-failure path closure.

Escalation rule:
- If first-failure attribution is impossible with existing telemetry, request/perform diagnostic-only probe plumbing first, then re-run and return to the same `N` window.
- Diagnostic plumbing must not modify solver/collision runtime behavior.

## Hard Rules

- Do not use non-authoritative signals as final evidence.
- Do not stop at partial diagnosis.
- Do not use CPU mirror tests for reproducing this class of issue.
- Use explicit CLI overrides during runs where required so tuner precedence does not invalidate results.
- Keep a running investigation report with commands, artifacts, hypotheses, and evidence updates.
- Non-paper-derived implementation changes are strictly forbidden.
- Do not label a fix as paper-aligned without explicit paper citation.
- If no paper-derived solution exists for the localized failing step, stop implementation and report the gap instead of applying heuristics.
- Do not implement broad pipeline changes before first-failure gates are satisfied.
