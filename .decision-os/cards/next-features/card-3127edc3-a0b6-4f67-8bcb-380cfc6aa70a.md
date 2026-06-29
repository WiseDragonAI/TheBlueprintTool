## A. Watch Notes Startup

1. **Goal.** Start a decision-os watcher station without requiring the operator to type `treat open notes` and without spending an initial inference turn.
2. **No seed prompt.** The launcher must not prompt Codex just to make the assistant reach `Stop`. That burns inference before any operator note exists.
3. **Profile as switch.** A dedicated profile, for example `watchnotes`, enables the watcher hooks only for sessions that are intentionally opened as note-watching stations.
4. **Immediate watcher.** Starting the profiled Codex session loads the hook configuration and starts the watcher immediately.

---

## B. Idle Behavior

1. **No note exists.** The watcher waits. The assistant does not need to infer, answer, or reach a normal `Stop` after a user prompt.
2. **Note appears.** The watcher detects unanswered operator notes from the active workspace ledgers.
3. **Watcher triggers inference.** Only after there is actual note work does the hook hand Codex a prompt/context payload.
4. **Agent treats notes.** The agent runs the note-treatment workflow, updates durable cards when required, answers threads, and verifies closure.
5. **Return to watch.** After treatment, the session returns to watcher mode and waits for the next note.

---

## C. Correct Hook Model

1. **Start hook ownership.** The start hook is responsible for launching the watcher at session startup.
2. **No long inference bootstrap.** The design must avoid a fake user prompt whose only purpose is to start the loop.
3. **Blocking wait outside inference.** Waiting for notes belongs to the watcher process/hook layer, not to an assistant turn that consumes model time.
4. **Triggered prompt only.** The first prompt sent to Codex should be the real note-processing prompt created after unanswered notes exist.

---

## D. Workspace Rules

1. **Cwd-scoped workspace.** The watcher resolves the active decision-os workspace from the process cwd unless the operator explicitly names another workspace.
2. **No workspace hardcoding.** The hook and launcher must not bake in decisionOs, MOH, Ardaria, or any other specific directory.
3. **Durable verification.** Each triggered run must verify the relevant ledgers report no unanswered notes before the watcher returns to idle.
