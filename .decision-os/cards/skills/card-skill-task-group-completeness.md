---
name: task-group-completeness
description: Perform a deep engineering completeness review of proposed task groups against the full stack, complete specs, data model, runtime state, and operator constraints. Repair the injected input card when fundamental tasks are missing, then write the injected report card. Use after task-dependency and before implementation-orchestrator launches workers.
---

## A. Purpose

1. This skill performs a **deep engineering completeness review** of **proposed task groups** before **implementation worker dispatch**.
2. It judges whether the plan is **logically solid**, **technically complete**, and grounded in the **full stack**, **complete specs**, **data model**, **runtime state**, and **operator constraints**.
3. It returns `ready` only when no **fundamental implementation tasks** are missing, and `blocked` when **planning logic** has unresolved gaps.

---

## B. Deep Planning Audit

1. Reconstruct the **implementation logic** from the injected source material, not just the **task list**.
2. Judge whether the grouped plan would produce a **coherent implementation** across **architecture**, **data**, **state**, **APIs**, **UI**, **config**, **migrations**, **tests**, **fixtures**, and **handoff**.
3. Look for **fundamental missing tasks** that would make implementation fail even when every requirement appears mapped and every task appears grouped.
4. Treat traceability checks as **supporting evidence**, not the **audit result**.
5. Reject a plan that is only **performatively complete**: named tasks, mapped requirements, and grouped work are not enough to prove **engineering completeness**.

---

## C. Input Card Changes

1. Repair the injected **input card** before writing the **report card** when deep analysis finds a **fundamental task gap**.
2. Add missing tasks needed for **architecture boundaries**, **data model changes**, **state transitions**, **API contracts**, **UI behavior**, **config changes**, **migrations**, **fixtures**, **test strategy**, and **handoff data**.
3. Amend **existing groups** when they hide **dependencies**, **sequencing risks**, **shared-file collisions**, **missing integration work**, **missing verification strategy**, and **unclear implementation ownership**.
4. Leave a **blocking question** only when the full stack and spec evidence does not determine the **necessary task**.
5. Keep the edited card in the **same structure and style** as this skill.

---

## D. Report Card

1. Write the **audit report** into the injected **report card** after the **input card changes** are complete.
2. The report card explains the **engineering reasoning**, the **planning risks tested**, the **input card repairs**, the **remaining gaps**, and the final **dispatch decision**.
3. Include the **report sections** `Engineering Completeness Findings`, `Fundamental Missing Tasks`, `Input Card Edits Applied`, `Dispatch-Ready Groups`, `Blocking Questions`, and `Dispatch Readiness`.
4. Include **group ids**, **task ids**, **source card ids**, **target files**, **missing engineering logic**, **verification strategy**, **migration needs**, **fixture needs**, **config needs**, **unanswered questions**, and final status using `ready` and `blocked`.
5. Keep the report card in the **same structure and style** as this skill.

---

## E. Hard Rules

1. Do not approve a **group** from **checkbox traceability** without testing the **engineering logic** behind the plan.
2. Do not invent **tasks** without **source evidence**.
3. Do not treat **requirement-to-task mapping** and **task-to-group mapping** as proof of **planning completeness**.
4. Do not leave an **input-card correction** only in the **report card**.
5. Use bold only for the **important words that carry the point** inside a sentence; do not turn each **numbered item opening** into a subtitle.
6. Do not implement **product code** and do not run **implementation tests**.
7. Do not change **card status** during this audit.
