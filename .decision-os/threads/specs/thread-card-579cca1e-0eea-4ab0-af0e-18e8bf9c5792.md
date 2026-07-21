# OPERATOR
<!-- decision-os:note {"id":"note-1784275814241-7fa5f7c7d438a8","timestamp":"2026-07-17T08:10:14.250Z"} -->

![Pasted image](/.decision-os/thread-images/thread-card-579cca1e-0eea-4ab0-af0e-18e8bf9c5792/paste-1784275814243-8b1159b57e4cd.png)

# OPERATOR
<!-- decision-os:note {"id":"note-1784278578961-cd7269397f20a8","timestamp":"2026-07-17T08:56:18.966Z"} -->

make 3 columns on desktop, drag and drop must work to move to backlog back and forth. Desktop column orders: backlog | queue | exec

Unify task card format to the "queue" one, not expand / collapse

# AGENT
<!-- decision-os:note {"id":"note-agent-1784278768650-9dc45797-a32","timestamp":"2026-07-17T08:59:28.651Z"} -->

Treated as an implementation task and converted into the **Desktop Three-Lane Control Room** zone.

1. **Requested desktop result:** show `Backlog | Queue | Exec` simultaneously and use the current compact Queue card structure in every lane with direct navigation and no disclosure UI.
2. **Selected interaction boundary:** reuse vendored SortableJS `1.15.7` under its MIT license for Backlog and Queue; keep Exec read-only.
3. **Persistence contract:** Queue to Backlog writes `status: backlog`; Backlog to Queue writes `status: todo` plus queue ranks; rejected writes reconcile from server truth.
4. **Plan:** four relationship-backed subtasks cover the responsive layout, cross-lane persistence, automated regressions, and served pointer verification.
5. **Readiness:** `READY_FOR_TASK_DEPENDENCY`. No blocking operator answer remains; implementation has not started and all subtasks remain open.
