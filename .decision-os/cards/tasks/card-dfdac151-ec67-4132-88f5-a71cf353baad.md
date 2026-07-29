## A. Gate Objective

1. Audit the proposed groups against the full migration contract, behavior baseline, data model, runtime state, test strategy, and operational constraints.
2. Select one implementation sequence that preserves ownership and minimizes cross-group collisions.

---

## B. Required Evidence

1. Prove that each requirement, invariant, finding, migration stage, fixture, test boundary, and rollback need has an owner.
2. Resolve missing work inside the task graph before dispatch.
3. Record the files and symbols reserved to each group plus the predecessor evidence required for launch.

---

## C. Exit Condition

1. Produce a complete dispatch registry with no duplicated task placement and no unowned acceptance boundary.
2. End with `READY_FOR_GROUPED_IMPLEMENTATION` only after the implementation sequence is deterministic.
