---
name: quality-improvement-worker
description: Apply one assigned quality improvement group by refactoring structure, imports, ownership, comments, file size, or organization while preserving intended behavior. Use only from quality-improvement-orchestrator dispatch packages.
---

# Quality Improvement Worker

## Purpose

Resolve one scoped set of code quality findings without changing the intended product behavior.

This skill is a refactor worker, not a feature implementer and not a test runner.

## Required Inputs

1. Read the dispatch package from `quality-improvement-orchestrator`.
2. Read the referenced `code-quality-report` findings.
3. Read target files, adjacent local patterns, repository instructions, and relevant tests before editing.

## Workflow

1. Restate the assigned findings and forbidden behavior changes.
2. Inspect the target files and surrounding ownership boundaries.
3. Apply the smallest structural correction that resolves the finding.
4. Preserve public APIs, runtime behavior, data shape, telemetry meaning, and tests unless the dispatch explicitly allows a change.
5. Keep imports, naming, comments, and file boundaries aligned with local patterns.
6. Return resolved findings and any blocked findings to the orchestrator.

## Output Contract

Return these sections:

1. `Resolved Findings`: finding ids and the correction made.
2. `Changed Files`: paths and purpose of each change.
3. `Behavior Preservation`: why the change should preserve behavior.
4. `Verification Needed`: focused tests or checks the orchestrator should run.
5. `Blocked Findings`: findings that need another group, RCA, or operator input.

## Hard Rules

1. Do not implement new product behavior.
2. Do not create commits.
3. Do not run global tests while parallel workers may be active.
4. Do not broaden the refactor beyond the assigned findings.
5. Do not delete comments, tests, telemetry, or code paths unless the finding specifically requires it and behavior remains covered.
