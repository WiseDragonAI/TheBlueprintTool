## A. Why Kept

1. **Best feature surface mapper.** `feature/analyzer` maps feature intent to codebase surface area.
2. **Output.** It produces evidence-backed task breakdown, risks, planner TODOs, planner decisions, and recommended implementation order.
3. **Use.** Use before `feature/planner` when a feature needs grounded codebase surface mapping before the implementation DAG.

---

## B. Boundary

1. **Feature issue scope.** It is useful when the unit of work is one feature issue.
2. **Not an implementer.** It prepares the planner; it does not implement code.
3. **No epic/product decomposition.** It is kept because it is closer to implementation order than `product/decomposer`, `epic/decomposer`, or other composer roles.
