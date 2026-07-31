## A. Objective and Context

1. **Objective:** Eliminate the active Decision OS runtime failures by tracing each failure family to its first incorrect application transition, correcting that boundary, adding a regression, and preserving diagnostic availability throughout recovery.
2. **Global context:** The durable incident ledger and diagnostics endpoint are the authoritative operational evidence; this recurring review remains open across iterations so newly active failures enter the same governed workflow.

---

## B. Verified Current State

1. **Incident families:** The active set collapses into three boundaries: duplicate listener ownership on the canary port, authored federated skills that do not reach synchronized publication, and execution-state reads for cards absent from the current task projection.
2. **Existing containment:** Listener failures are durably recorded, authored saves are detached from federation convergence, and missing optimistic cards can already return an empty execution projection; the remaining work is to prove the first incorrect transition for each active family and make recovery settle its incident scope.
3. **Evidence boundary:** An incident remains active until the owning scope is revalidated and the diagnostics endpoint reports it resolved.

---

## C. Strategic Path

1. **Path:** Resolve the listener ownership boundary first, then federated publication convergence, then stale execution-state request handling; each subtask owns the source correction, regression, and scoped recovery proof for its family.
2. **Why this advances the objective:** The sequence restores deterministic server availability first, then shared-library convergence, then read-path hygiene, while keeping unrelated projects and diagnostics online.
3. **Constraint:** Preserve invalid durable state byte-for-byte, avoid restarting the production server, and clear no incident from evidence alone.

---

## D. Current Decision

1. **Decision:** Execute the three positioned subtasks as the single incident-remediation path.
2. **Closeout:** Keep this recurring master task open after the current families are resolved so the next incident snapshot can be reviewed under the same containment and proof rules.
