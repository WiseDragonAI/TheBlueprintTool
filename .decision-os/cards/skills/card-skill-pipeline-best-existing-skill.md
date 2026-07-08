## A. Recommendation

1. **Best existing local chain.** Use `executor-precheck -> executor-stack -> executor-spec -> executor-implement` when the goal is to turn approved `Specs`, `Data Model`, `Runtime State`, and previous analysis into implementation structure and then code.
2. **Strongest splitter.** Use `executor-spec` as the strongest executor-side `goal -> implementation structure` splitter because it builds the `Master Ledger`: domains, one test suite per spec, inputs, effects, helpers, screens/pages, components, state, control-flow entries, unresolved questions, and spec candidates.
3. **Implementation step.** Use `executor-implement` after the `Master Ledger`; it should not infer architecture or split a broad goal by itself.
4. **Verification step.** Keep verification inside `executor-implement`: confirm each `Master Ledger` item is implemented, each `Spec` still has a test suite, helper/effect unit tests pass, compile when applicable, launch app/site when applicable, screenshot every screen, and inspect the result.

---

## B. Factory Alternative

1. **Existing issue normalizer.** Use `improveticket` or `ticket/improver` when the starting point is an existing weak GitLab issue.
2. **Single-feature path.** Use `feature/analyzer -> feature/planner` when a feature issue needs grounded codebase surface mapping before the implementation DAG.
3. **Bug path.** Use `bug/rca` when the requested work is a bug because it produces fix scope, fix DAG, regression test plan, and fixer checklist before implementation.

---

## C. Boundary

1. **Not enough for this request.** `product/decomposer` splits an approved product ticket into child epic tickets; that is less direct than `executor-spec` for code execution order and parallel implementation blocks.
2. **Missing contract.** The inventory does not contain a skill whose explicit contract is to launch one sub-agent per block of tasks while passing implementation instructions. Use the separate `Orchestration Skill Gap` card for that missing contract.
3. **Source boundary.** This recommendation reuses wording from `.decision-os/cards/skills/card-9a1d7843-0bf4-47e8-b6df-cbc4e5571e39.md`, `.skills/executor-precheck/SKILL.md`, `.skills/executor-stack/SKILL.md`, `.skills/executor-spec/SKILL.md`, and `.skills/executor-implement/SKILL.md`.
