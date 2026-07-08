## A. Why Kept

1. **Best implementation planner.** `executor-spec` is the strongest executor-side `goal -> implementation structure` splitter.
2. **Output.** It builds the `Master Ledger`: domains, one test suite per spec, inputs, effects, helpers, screens/pages, components, state, control-flow entries, unresolved questions, and spec candidates.
3. **Use.** Use it after stack analysis when the operator needs code execution order and concrete implementation structure.

---

## B. Boundary

1. **No architecture invention.** It must speak with words present in the `Specs`, `Data Model`, `Runtime State`, existing codebase, references, or operator instruction.
2. **No one-pass inference.** It creates the `Master Ledger` section by section, then re-assesses each section.
3. **Gate.** It is ready for `executor-implement` only when there are no dangling references, unreachable control-flow entries, missing helpers/effects/components/state/domains, or blocking unresolved items.
