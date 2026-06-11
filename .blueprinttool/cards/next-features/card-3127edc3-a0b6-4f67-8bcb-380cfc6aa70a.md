## A. Watch Notes Loop

1. **Goal.** Stop requiring the operator to manually tell the open station to run `corev2-treat-open-notes` after every note.
2. **Control surface.** Use a dedicated Codex profile, for example `watchnotes`, so watcher hooks are active only in sessions that are explicitly started for note watching.
3. **Launcher responsibility.** Provide a small launcher command that starts Codex with the profile and a single seed prompt telling the agent to watch Blueprinttool notes, treat them, verify closure, and wait again.

---

## B. Hook Roles

1. **`SessionStart`.** Load fast watcher context, confirm the workspace, and optionally run a quick unanswered-note check. It must not become the infinite watcher.
2. **Initial inference turn.** The launcher seed prompt creates the first real turn, so Codex has something concrete to execute after startup.
3. **`Stop`.** This is the durable watcher loop. When no work is active, it waits for open notes. When notes appear, it returns `decision: "block"` with a prompt that tells Codex to use `corev2-treat-open-notes`.
4. **`PreCompact` and `PostCompact`.** Use these only to preserve or restore watcher state. They cannot be the main loop because compaction is not guaranteed after every turn.

---

## C. Runtime Flow

1. **Start.** Operator runs the watcher launcher from the target workspace.
2. **Setup.** The profile loads the hooks and `SessionStart` adds workspace context.
3. **Idle.** If no notes exist, the assistant reaches `Stop`.
4. **Watch.** The `Stop` hook blocks while waiting for unanswered notes.
5. **Trigger.** When notes appear, `Stop` returns `decision: "block"` and injects the note payload.
6. **Treat.** The agent runs `corev2-treat-open-notes`, updates card content when required, answers threads, and verifies no relevant unanswered notes remain.
7. **Repeat.** The assistant reaches `Stop` again, and the hook resumes watching.

---

## D. Boundaries

1. **No infinite `SessionStart`.** A long-running `SessionStart` can stall startup and still may not create an inference turn by itself.
2. **No workspace hardcoding.** The watcher must resolve the target workspace from the launcher cwd unless the operator explicitly provides another workspace.
3. **No generic acknowledgements.** The watcher is useful only if it performs the requested ledger or repo work before answering the thread.
