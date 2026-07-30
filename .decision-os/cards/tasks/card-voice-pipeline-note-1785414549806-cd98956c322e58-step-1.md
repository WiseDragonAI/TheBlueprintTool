## A. Analysis Mission

1. **Incident** `shows` a voice note remaining stale in the active frontend after backend transcription completes; a fresh reload `shows` the persisted transcription.
2. **Trace** `follows` upload acceptance, transcription settlement, durable note revision, live transport publication, frontend ingestion, store reconciliation, selected-thread hydration, and note rendering.
3. **Root cause** must `identify` the first incorrect transition with exact files, symbols, and causal evidence.

---

## B. Decision Boundary

1. **Minimal patch** must `preserve` the existing voice-note component, rendered structure, styling, interaction model, persistence authority, and reload behavior.
2. **Regression boundary** must `exercise` the first incorrect transition and distinguish live update from reload hydration.
3. **Execution** `stops` after analysis; do not edit implementation code, run a server, restart a server, commit, push, close subtasks, or close the master task.

---

## C. Required Handoff

1. **Finding** `states` the verified root cause and rejects competing causes using repository evidence.
2. **Change map** `lists` exact files and symbols for one structurally correct patch.
3. **Verification plan** `defines` focused automated coverage and the later served-surface interaction proof required before a success claim.
4. **Master-task update** `records` the complete causal view in the operator-facing master body using its required military format.
---

Codex run completed: exit code 0
