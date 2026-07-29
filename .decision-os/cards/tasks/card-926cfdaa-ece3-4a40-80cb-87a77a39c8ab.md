## A. Gate Objective

1. Run code-quality, over-engineering, and bloat analyses against the accepted migration plan.
2. Preserve every feature and behavior while identifying the smallest structural corrections needed for safe migration.

---

## B. Required Evidence

1. For each finding, name the file, symbol, concrete defect, behavior at risk, proposed correction, and evidence that the correction preserves capability.
2. Reject speculative abstractions, duplicate state, redundant persistence, unnecessary compatibility layers, dead explanation, and one-use machinery lacking a repeated need.
3. Protect existing failure containment, cancellation, bounded waits, durable invalid-state preservation, incident visibility, and explicit recovery.

---

## C. Exit Condition

1. Produce a deduplicated finding register ranked by migration risk and structural yield.
2. End with `READY_FOR_TASK_INVENTORY` when every accepted finding is concrete, behavior-preserving, and linked to source evidence.
