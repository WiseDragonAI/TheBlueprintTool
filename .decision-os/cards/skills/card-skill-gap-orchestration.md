## A. Missing Contract

1. **Gap.** The inventory has `executor-implement`, `ticket-solver`, `openspec-apply-change`, and Factory implement stages, but it does not list a skill whose explicit contract is to launch one sub-agent per block of tasks.
2. **Operator wording preserved.** The missing role is the requested `orchestration skill`: it would use a block of tasks plus an implementation skill, or launch a sub-agent per block of tasks while passing implementation instructions.
3. **Existing source to consume.** The safest source for those task blocks is the `Master Ledger` from `executor-spec`, especially domains, test suites, inputs, effects, helpers, screens/pages, components, state, and control-flow entries.

---

## B. Non-Invention Boundary

1. **Do not rename existing phases.** Keep `executor-precheck`, `executor-stack`, `executor-spec`, and `executor-implement` as the existing executor vocabulary.
2. **Do not replace implementation.** The missing orchestration role should not infer architecture; `executor-implement` already owns implementation from the `Master Ledger`.
3. **Do not replace verification.** Verification remains the `executor-implement` verification contract unless a separate verification skill is explicitly created later.

---

## C. Acceptance For A Future Skill

1. **Input.** Consume a prepared `Master Ledger` and a list of task blocks derived from existing `Root Blocks`, domains, control-flow entries, tests, screens/pages, components, helpers, and effects.
2. **Execution.** Start one implementation run per independent block only when dependencies allow parallel work.
3. **Output.** Return implemented code, tests, verification evidence, and unresolved operator questions without changing the source `Specs`, `Data Model`, or `Runtime State`.
