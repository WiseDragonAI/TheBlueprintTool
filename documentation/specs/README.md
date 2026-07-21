# Specs Knowledge Base

## A. Purpose

1. This role indexes accepted behavior, invariants, boundaries, and non-goals.
2. The live product Specs remain in `.decision-os/specs.json` and `.decision-os/cards/specs/`.
3. KB spec pages explain cross-cutting contracts without copying every ledger card.

---

## B. Domains

1. [Knowledge Base](./knowledge-base/README.md) defines canonical KB ownership and maintenance invariants.
2. [Commit traceability](./commit-traceability.md) requires agent-authored commit bodies to record exact `WHAT:` and `WHY:` evidence.

---

## C. Source Rule

1. A KB page must not silently promote an analysis finding into an accepted Spec.
2. New behavior discovered during documentation work remains a `New Spec Candidate` until the operator approves it in the Specs ledger.
3. Forbidden behavior remains an `Anti-Spec Candidate` until operator approval.
