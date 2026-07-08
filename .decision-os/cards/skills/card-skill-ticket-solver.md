## A. Why Kept

1. **Best existing ticket implementer.** `ticket-solver` solves an existing GitLab ticket end to end.
2. **Planning before code.** It still creates a working document and full control-flow DAG before implementation.
3. **Use.** Use it after a ticket exists, not at the start of a broad goal.

---

## B. Boundary

1. **Downstream role.** It should consume a prepared ticket, create the working DAG, implement, test, and report evidence.
2. **Not a broad splitter.** It should not replace `executor-spec` for turning broad specs into implementation structure.
3. **Best fit.** Use when the workflow state is already a GitLab issue and the requested outcome is a solved ticket.
