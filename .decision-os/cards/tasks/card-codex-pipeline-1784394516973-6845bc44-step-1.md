## A. Outcome Review

1. **Requested outcome:** identify why a registered project was absent from `/projects` and repair it immediately.
2. **Delivered result:** the investigation traced the first incorrect transition to federation grouping unrelated projects by shared ID `Lg`; the repair assigned `Ardaria` stable ID `927a2e68-e8e4-426f-9f77-fd05a2877bd9` without deleting project files.
3. **Verified state:** catalog and Control Room responses expose distinct `Ardaria` and `home` entries, while duplicate-path registration still returns HTTP `400`.
4. **Remaining observation:** rendered `/projects` verification was unavailable and was explicitly left as an operator refresh check; no operator contradiction followed the delivered result.

---

## B. Durable Lesson

1. **Saved memory `50`:** when a registered project is absent from the federated catalog, compare the durable registry, project manifest, replica authority, and repository origin before changing registration state.
2. **Evidence:** unrelated `Ardaria` and `home` projects shared ID `Lg`, so federation grouped both replicas under the authoritative `home` row and hid `Ardaria`.
3. **Classification:** `code` / `federation` / `project-identity`.
4. **Source:** `codex-skill-1784393103215-07765d96`; `codex-pipeline-1784394516973-6845bc44`.

---

## C. Closure

1. **Gate:** `master-task-gate` reported `ready: true` with no discrepancies.
2. **Completion:** the authorized canonical completion closes the master task and its canonical subtasks atomically.
---

Codex run completed: exit code 0
