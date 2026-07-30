---
name: implementation-commit
description: Commit the complete implementation iteration represented by supplied Decision OS card IDs and their linked task-list, task-grouping, and implementation-orchestrator cards. Use when Codex must reconstruct the full plan and completed worker scope, map it to repository diffs, then create one or more scoped commits in single repositories, monorepositories, and nested Git repositories while preserving unrelated changes, respecting repository branching conventions, and avoiding test or build reruns.
---

# Implementation Commit

## Core Workflow

1. Read the full supplied Decision OS cards before inspecting repository changes. Do not use Decision OS threads and run summaries as scope sources.
2. Traverse inbound Decision OS relationships recursively from every supplied card to each linked `implementation-orchestrator` result.
3. From each orchestrator result, follow the inbound `implementation-orchestrator` relationship to its `task-dependency` grouping card, then follow the inbound `task-dependency` relationship to its `task-list` card.
4. Read the full resolved cards, including `Task Inventory`, `Independent Task Groups`, `Worker Results`, and `Implementation Batch Handoff`.
5. Treat the linked plan and completed worker results as the authoritative iteration scope. Include every completed task and changed file; exclude blocked, incomplete, unrelated, and untraceable work.
6. Stop when a supplied card does not resolve unambiguously to the iteration's `implementation-orchestrator`, `task-dependency`, and `task-list` cards. Report the exact missing relationship.
7. Inspect `git status --short`, staged diffs, unstaged diffs, and untracked files in each affected Git repository only after reconstructing the iteration scope.
8. Map every in-scope task and worker-reported file to explicit changed files and hunks.
9. Analyze repository conventions before committing: branch naming, protected branch expectations, default branch names, current branch state, and recent commit patterns. Do not assume `main` or `master` is the correct target branch.
10. Stop before committing when branch ownership is unclear; report the ambiguity and ask for the target branch.
11. Leave unrelated, ambiguous, and incomplete changes unchanged.

## Commit Rules

1. Use `PKG` for package, dependency, plugin, lockfile, and package-manager changes; `FT` for features; `FIX` for defects; `DOC` for documentation-only changes.
2. Include every related `.decision-os` card markdown change that documents the in-scope implementation. Classify it as `DOC` and place it in a `DOC` commit, never in a `PKG`, `FT`, or `FIX` commit.
3. Keep `PKG`, `FT`, `FIX`, and `DOC` in separate commits; use hunk staging when one file contains multiple classes.
4. Commit `PKG` first, then `FT`, then `FIX`, then `DOC`.
5. Commit nested repository changes before parent repository gitlink changes.
6. Write subjects as `<PREFIX> - <imperative summary>`, with one space, one hyphen (`-`), and one space between prefix and summary.
7. Example subjects: `FT - add card-scoped commit grouping`; `FIX - preserve unrelated staged changes`; `PKG - add repository discovery dependency`; `DOC - record commit skill contract`.

## Safety And Completion

1. Stage explicit paths and hunks; avoid `git add .` and `git add -A` in dirty workspaces.
2. Preserve unrelated staged, unstaged, and untracked work. Do not run `git reset`, `git commit --amend`, `git rebase`, `git push`, and force-update commands.
3. Review every staged diff before committing. Do not launch test suites, rerun builds, or run broad validation commands; this skill's scope is committing.
4. Let configured commit hooks run normally. Do not bypass hooks with `--no-verify`; if a hook blocks the commit, report its output and stop.
5. Create the required commit set only when its combined staged content covers the entire completed iteration and plan reconstructed from the linked cards.
6. Verify each commit with `git show --stat --oneline HEAD` and `git status --short`.
7. Final responses must list repositories, commit hashes, subjects, commit hook results, blocked in-scope work, and remaining unrelated changes.
