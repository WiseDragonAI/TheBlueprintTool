## A. Why Kept

1. **Best direct implementation skill.** `executor-implement` consumes the `Master Ledger` and turns the generated scaffold into complete implementation.
2. **Scope.** It delivers real code with no placeholder code, no missing feature, and no bug from the prepared scaffold.
3. **Use.** Use it after `executor-spec`, not before.

---

## B. Boundary

1. **No architecture inference.** It must use the `Root Blocks`, domains, screens/pages, components, inputs, actions, controllers, helpers, effects, state, and tests from the `Master Ledger`.
2. **Stop condition.** If implementation requires a missing `Spec`, `Data Model`, `Runtime State`, domain, input, action, controller, helper, effect, screen/page, component, or test, stop and ask an operator question.
3. **Verification.** Confirm each `Master Ledger` item is implemented, each `Spec` still has a test suite, helper/effect unit tests pass, compile when applicable, launch app/site when applicable, screenshot every screen, and inspect the result.
