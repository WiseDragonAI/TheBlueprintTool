## A. Source Wording

1. **Skill.** `ticket/improver`.
2. **Source group.** `DroidFactory`.
3. **Source wording.** Normalizes an existing weak issue into a factory-ready ticket. Required body structure: `Problem Report`, `REQ-###`, `Scope`, `Codebase Impact Intent`, `Dependency Blockers`, `Ideal Control-flow DAG`, and `Acceptance`. It classifies the issue as `feature` or `bug`; the orchestrator then applies the first pipeline labels.

---

## B. Pipeline Fit

1. **Role.** Factory issue normalizer.
2. **Best use.** Use when DroidFactory should non-interactively normalize an `improve` issue and classify it for the feature or bug pipeline.

---

## C. Evidence Boundary

1. **Inventory source.** Reused from `.decision-os/cards/skills/card-9a1d7843-0bf4-47e8-b6df-cbc4e5571e39.md`.
2. **Terminology rule.** Keep the skill name, body structure names, labels, and pipeline stage names exactly as listed above when using this card.
