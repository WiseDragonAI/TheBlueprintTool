# Postmortem Knowledge Base

## A. Purpose

1. This role owns durable root causes, failure modes, repair lessons, and regression-prevention rules.
2. Current architecture extracted from a postmortem must be promoted to `../documentation/`.
3. Required behavior extracted from a postmortem must be promoted to `../specs/` after operator approval.

---

## B. Current Population

1. [Epoch-3 workstation and phone production cutover](./epoch-3-production-cutover-2026-07-21.md) records the offline migration, restart failures, recovery, convergence evidence, and remaining deployment evidence from `2026-07-21`.
2. [Epoch-4 Workstation cutover and thread consistency](./epoch-4-workstation-cutover-2026-07-24.md) records the recoverable migration redesign, in-place media contract, Workstation activation, post-cutover note corruption, and consistency repairs.
3. [Temporary federation verification node production saturation](./temporary-federation-verification-node-production-saturation-2026-07-29.md) records the unsafe production-attached proof node, automatic library-sync fan-out, production starvation, containment, and the mandatory gentle verification boundary.
4. [Task content conflict recovery and observability](./task-content-conflict-recovery-and-observability-2026-07-31.md) records the stale-projection race, the delivered lossless thread recovery, and the remaining incident-ownership gap.
5. [Voice delivery scope and gate deviation](./voice-delivery-scope-and-gate-deviation-2026-07-31.md) records the delivered voice correction, the unrelated suite-repair scope leak, and the gate rules that prevent recurrence.
6. [Epoch-4 replication incident](./epoch-4-replication-incident-2026-08-09.md) records the `rel-0.4.2` through `rel-0.4.8` failure chain, architectural corrections, recovery boundary, and restart-proven closure.

---

## C. Admission Rule

1. A canonical postmortem identifies the failed invariant, first incorrect transition, root cause, detection gap, repair boundary, and regression evidence.
2. A failed attempt is not a root cause by itself.
3. Do not retain stale implementation detail as current architecture.
