#task #task-todo #backend #codex

## A. Deliverable

1. **Dispatch:** Support typed thread, skill, pipeline, continuation, cancellation, and status commands.
2. **Ownership:** Bind each run to node, project, card, thread, coordinator command, and local run IDs.
3. **Sequence:** Lease, sync, start, stream, checkpoint, release, and publish terminal status.
4. **Cancellation:** Forward cancellation to the owning local controller and record settlement.

---

## B. Acceptance Criteria

1. **Target:** A workstation command never executes on the phone.
2. **Queue:** Offline-node work stays queued until reconnection.
3. **Replay:** Duplicate delivery returns the prior acknowledgement without starting another run.
4. **Status:** Phone reads queued, running, blocked, cancelled, failed, and completed transitions.
5. **Persistence:** Terminal output appears after fast-forward and reload on the other node.
