## A. Purpose

1. **Goal.** Track every runbook and operator-facing update needed when the watcher workflow is implemented.
2. **Scope.** This card is not the implementation plan itself. It is the release checklist that prevents the new workflow from shipping without usable operating instructions.

---

## B. Runbooks To Update

1. **Agent instructions.** Update `AGENTS.md` with the watcher launcher, cwd rules, and expected operator workflow.
2. **Skill docs.** Update `decision-os-start-doc-server` and `decision-os-treat-open-notes` skill copies if the watcher changes how sessions are started or how notes are processed.
3. **Operator keys.** Update the keyboard contract to include `Ctrl+S` if that remains the chosen processing shortcut.
4. **Server procedure.** Document how to start the doc server and watcher from the same target workspace without cross-workspace leakage.
5. **Troubleshooting.** Add recovery steps for stuck `processing` cards, failed Codex resume, missing queue state, and watcher hook failures.

---

## C. Implementation Checklist

1. **Status model.** Add and document `to_process`, `processing`, completed, and blocked transitions.
2. **Canvas UI.** Add the floating queue notification and expandable queued-card list.
3. **Keyboard handling.** Wire `Ctrl+S` to move queued cards into `processing` or trigger the processing action defined by the final design.
4. **Watcher hooks.** Implement the profile, `SessionStart`, `Stop`, and compaction hook behavior.
5. **Context payload.** Implement the extended unanswered/context payload described in `Unanswered Context Payload`.
6. **Verification.** Add tests for status transitions, shortcut behavior, queue UI visibility, hook prompt construction, cwd preservation, and thread answer closure.

---

## D. Release Criteria

1. **No manual loop.** The operator can start the watcher once and does not need to repeatedly type `treat open notes`.
2. **Visible queue.** The canvas makes pending processing work visible when the thread overlay is closed.
3. **Durable operation.** Watcher state and logs are stored in the active workspace under `.decision-os`.
4. **Runbooks current.** Operator-facing documentation matches the shipped workflow before the feature is considered complete.
