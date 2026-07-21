# Postmortem Knowledge Base

## A. Purpose

1. This role owns durable root causes, failure modes, repair lessons, and regression-prevention rules.
2. Current architecture extracted from a postmortem must be promoted to `../documentation/`.
3. Required behavior extracted from a postmortem must be promoted to `../specs/` after operator approval.

---

## B. Current Population

1. [Epoch-3 workstation and phone production cutover](./epoch-3-production-cutover-2026-07-21.md) records the offline migration, restart failures, recovery, convergence evidence, and remaining deployment evidence from `2026-07-21`.
2. Existing root-cause and reassessment files remain migration sources until their claims are reconciled with current code and Specs.

---

## C. Admission Rule

1. A canonical postmortem identifies the failed invariant, first incorrect transition, root cause, detection gap, repair boundary, and regression evidence.
2. A failed attempt is not a root cause by itself.
3. Do not retain stale implementation detail as current architecture.
