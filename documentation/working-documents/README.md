# Working Documents

## A. Purpose

1. This directory holds analysis that is active in the current iteration and legacy sources that predate the working-document lifecycle rule.
2. Its contents are temporary inputs, not canonical current behavior, accepted Specs, procedures, postmortems, or historical storage.
3. A completed new iteration must leave none of its working documents here. Legacy sources remain only until a dedicated recycling iteration settles them.

---

## B. Admission Boundary

1. Add a working document only when the active iteration needs a durable analysis surface that cannot live in its Decision OS card and thread.
2. Keep intermediate TODO lists, implementation checklists, hypotheses, and progress state in the iteration's task system instead of treating them as KB content.
3. Every working document must identify the active iteration that owns its removal.

---

## C. Iteration Closure Gate

1. Reassess every claim against current code, runtime evidence, tests, Specs, and operator decisions.
2. Scrap obsolete hypotheses, superseded plans, temporary measurements, and completed TODO state.
3. Recycle only verified final-state technical knowledge into `documentation/`, `specs/`, `procedure/`, or `postmortem/` according to its role.
4. Link canonical pages to their durable evidence instead of retaining the working narrative.
5. Delete the working document after its durable knowledge has a canonical owner. Do not archive it as a substitute for extraction.

---

## D. Legacy Migration Boundary

1. Files present before this lifecycle rule form the migration backlog; their presence does not classify them as active analysis.
2. A dedicated cleanup iteration names the legacy sources it owns, routes their verified durable knowledge, and deletes every settled source in the same iteration.
3. Unreassessed legacy files remain visible until their cleanup iteration. They are never cited as canonical authority.
