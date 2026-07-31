# Voice Delivery Scope and Gate Deviation

## A. Delivered Voice Scope

1. `5cc5837f` corrected same-ID voice lifecycle reconciliation: a durable transcript must replace the optimistic uploading row without discarding browser-owned cleanup metadata. `95efdc27` merged that change to `main`.
2. The remaining acceptance boundary was actor-visible: one microphone capture must become its transcript in the same row without reload, then remain correct after reload. Source and focused automated proof did not substitute for that interaction proof.

---

## B. First Scope Deviation

1. After the focused voice proof, a red repository suite was treated as voice implementation work before any failure was causally connected to the voice delta.
2. Selecting `run-test-and-fix` then widened the iteration because that skill correctly repairs admitted repository failures until the suite is green, but it has no feature-causality admission rule.
3. The resulting lifecycle, fixture, publication, and browser repairs were repository work, not voice work. The later responsive pipeline-metadata repair was independently merged as `808a16a7`.

---

## C. Gate Failure Mode

1. Generated pipeline results were linked only as generic `subtask` relationships. `implementation-commit` requires typed `task-list`, `task-dependency`, and `implementation-orchestrator` lineage, so it stopped before Git inspection.
2. Deadline-truncated `run-test-and-fix` handoffs contained only an empty completion result even though retained execution streams held progress and test evidence. Re-launching the same skill treated that empty handoff as evidence-free and repeated work.

---

## D. Prevention Rule

1. Before selecting repository repair, the gate must identify the first failing transition and establish that it belongs to the current feature delta. Unrelated failures become a separate blocker or task.
2. An execution without its required final report is a failed step. The next gate must inspect the retained run stream before choosing another execution.
3. Pipeline generation must create the typed lineage required by the commit gate. Delivery-affecting verification and review must complete in the implementation worktree before commit, merge, publication, and worktree cleanup.
