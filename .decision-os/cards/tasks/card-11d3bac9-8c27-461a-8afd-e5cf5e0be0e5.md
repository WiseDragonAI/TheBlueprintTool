## A. Gate Objective

1. Apply the complete evidence-backed repair set in one coordinated batch after all failure reports are reconciled.
2. Keep shared-file and shared-state repairs under one owner.

---

## B. Grouped Verification Loop

1. Run the focused tests for every repaired failure group together.
2. Regroup remaining failures, investigate independent groups in parallel, reconcile all reports, then apply the next complete repair batch.
3. Never alternate one isolated fix with one isolated test run.
4. Continue until every attributed failure group passes its focused boundary.

---

## C. Exit Condition

1. All focused failure groups pass with regressions at the causal boundaries and no hidden bypass.
2. End with `READY_FOR_FINAL_SYSTEM_PROOF`.
