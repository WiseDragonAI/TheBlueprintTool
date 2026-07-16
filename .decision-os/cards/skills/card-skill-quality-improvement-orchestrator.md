---
name: code-quality-improver
description: Analyze and directly correct code quality issues in files modified during an implementation. Use when Codex must improve clean architecture, clean code, file separation, comments, and factorization while preserving intended behavior.
---

# Code Quality Improver

## A. Analyze And Fix

1. **Iteration scope** means align only the files changed in this implementation iteration and keep corrections inside that iteration scope.
2. **Execution boundary** means do not run tests, do not create commits, and do not perform verification work outside file modification. This skill's job is only to modify files.

---

## B. What Is Clean Architecture?

1. **File separation** means each file type has a role when that role belongs in the architecture. A `controller` owns behavior and branching, a `helper` is a small `sync` or `async` function that returns implementation work results such as parsing, validation, data loading, `IO`, formatting, normalization, calculation, and derivation, an `effect` is a final output call, a `component` renders UI, a `test` proves behavior, a `fixture` provides test setup/data, and `state` holds runtime values. Do not retrofit every codebase into all these file types; for example, `component` has no place in a backend.
2. **Directory separation** means files are correctly placed in subdirectories that group common functionality together. As the codebase and features expand, it is natural to create more subdirectories and more levels of subdirectories so ownership stays readable.
3. **Goal-oriented controllers** own one operation lifecycle. A `controller` keeps the behavior decisions and branching, calls `helper` functions for implementation work, and calls `effect` functions for final output.
4. **Behavior preservation** keeps working code working while improving ownership. A quality refactor changes structure, names, imports, comments, and tests only where there is evidence that the current shape hurts clarity, safety, speed, or maintenance.

---

## C. What Is Clean Code?

1. **One function per file** is the default.
2. **Small readable units** keep a `controller` at a maximum of approximately `300` LOC and keep each `helper` focused on one derivation, validation, parser, loader, formatter, or calculation. Split when a file starts owning several jobs.
3. **Mandatory comments** means every file needs a `WHAT`/`WHY` header and every branch needs a `WHAT`/`WHY` comment.

---

## D. Factorization

1. **Smallest useful correction** fixes the nearest real ownership problem. Prefer a targeted `controller` split, `helper` extraction, comment repair, import correction, and focused test update over broad rewrites, unrelated renames, new frameworks, and speculative cleanup.
2. **Clean ownership** means each file has one clear responsibility, visible from its `path`, `name`, imports, and tests. Use the repo's own vocabulary first; do not force external architecture terms into a codebase that already has coherent names. The ownership of `data` and modifications must not be split across parallel sibling `controllers`.
3. **Controller nesting** should be avoided; ideally, `controllers` stay parallel. When parallel `controllers` make ownership unclear for `state`, `data`, and modifications, use a `waterfall` `caller` to `callee` structure so ownership is readable from the `stack trace`.
