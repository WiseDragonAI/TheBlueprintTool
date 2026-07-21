#master-task

Ledger: Specs

## A. Scope

1. **Flatten `/skills` and `/pipelines`:** show records from all managed projects immediately, without a project-selection stage.
2. **Improve Card Processing:** use the same searchable, tagged list treatment for direct skills and pipelines inside the active card context.
3. **Preserve ownership:** identify project-owned records and keep run, edit, and persistence requests scoped to the owning project.
4. **Reuse Control Room patterns:** use compact project chips, secondary tag chips, and a clear action.

---

## B. Verified Context

1. **Server synchronization:** `ledger-cli skills create/update` writes server packages under `.skills/<name>` and projects them into `.decision-os/skills.json`.
2. **Runtime discovery:** the skill scanner combines server, workspace, user, system, and plugin roots with deterministic precedence.
3. **Current defect:** the mobile `/skills` and `/pipelines` routes render project buttons first and load records only after a project click.
4. **Existing UI asset:** Control Room already provides project-filter chips and secondary filter chips suitable for reuse.

---

## C. Acceptance Criteria

1. **Skills route:** opening `/skills` immediately displays one deduplicated skill list from the managed project catalog.
2. **Pipelines route:** opening `/pipelines` immediately displays one pipeline list annotated with its owning project.
3. **Filtering:** search, project chips, and tag chips filter the visible library without navigation.
4. **Card Processing:** Skills and Pipelines tabs expose search and tag filters while remaining scoped to the active card project.
5. **Ownership:** selecting a global pipeline binds editing and saving to its owning project.
6. **Verification:** focused automated tests pass, the served routes return `200`, and mobile Chromium verifies the target surface.

---
