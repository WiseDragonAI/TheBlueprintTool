---
name: run-test-and-fix
description: Run the full test suite, fix failures through parallel subagents, never create commits, repeat until every test passes, and produce a final report with fixes, gaps, logic changes, and implementation lessons.
---

# Run Test And Fix

## A. Workflow

1. **Run all tests:** Execute the full `test suite` and capture `command`, `exit code`, `failing test names`, `stack traces`, `logs`, and `changed-file context`.
2. **Analyze failures:** Read every `failing test`, inspect related `code paths`, identify likely `root causes`, and group failures that share the same `cause`.
3. **Build repair groups:** Convert grouped `failures` into an `action list` with `repair groups` that can run in parallel without touching the same `files`, `symbols`, `scenarios`, `migrations`, `fixtures`, and `generated artifacts`.
4. **Dispatch subagents:** Launch one `subagent` per `repair group` with `failing tests`, `evidence`, `suspected cause`, `target files`, `constraints`, and `expected fix outcome`.
5. **Constrain subagents:** Tell each `subagent` to search for the true `cause`, fix the issue completely, and return a concise `repair summary` without rerunning the `test suite`.
6. **Collect repairs:** Wait for every parallel `subagent` to finish and collect `summaries`, `changed files`, `remaining risks`, and `follow-up notes`.
7. **Repeat verification:** Return to step `1` after all parallel `subagents` finish, run the full `test suite` again, and repeat the loop until every `test` passes.
8. **Finish condition:** Stop only when the full `test suite` passes; then produce the `Final Report`.

---

## B. Final Report

1. **Logic changes:** Call out every `logic change` made during `repairs` that differs from the intended `implementation design`.
2. **Implementation gaps:** Document every missing `implementation piece` discovered while fixing `tests`, and ensure the necessary `comments` were added.
3. **Tests and fixes:** Report every `failing test` encountered, each `repair group`, each `fix` made, and `changed files`.
4. **Implementation lessons:** Extract the **most important** `lessons` that would improve future `implementation instructions`, prevent repeated `failing-test loops`, and help the `implementation stage` anticipate likely `failure classes` before tests expose them.

---

## C. Hard Limits

1. **No commits:** Never run `git add`, `git commit`, `git tag`, `git push`, and never create a `commit`; commit work is outside this skill.
2. **Test-and-fix scope:** Only run the `test suite`, analyze `failures`, fix `problems`, collect `fixes`, repeat until green, and produce the `Final Report`.
3. **Subagent constraint:** `Subagents` fix assigned `problems` without rerunning the full `test suite` and without commit commands.
4. **Formatting contract:** Keep lettered `H2` sections, `---` dividers, numbered lists, bold labels, and `backticks` on exact terms.
