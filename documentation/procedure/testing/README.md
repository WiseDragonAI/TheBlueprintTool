# Verification Procedure

## A. Admission

1. Run every test and typecheck through the repository lease:

   `node bin/decision-os-verify.mjs -- <command> [args...]`

2. Pass one direct test or typecheck command.
3. Do not wrap the admitted command in a shell command.
4. Use `node bin/decision-os-workload-status.mjs` only as a read-only workload diagnostic.
5. When the lease is occupied, the wrapper reports the active holder's PID, working directory, and admitted command once before waiting.

---

## B. Verification Order

1. Add and run the smallest change-specific test first.
2. Rerun the smallest failing scope after a failure.
3. Run the changed package typecheck once the implementation stabilizes.
4. Run the full suite once after focused checks pass.
5. Do not repeat passing checks after documentation-only edits.
6. Limit mobile test and typecheck work to three-way parallelism.

---

## C. Interaction Evidence

1. Source inspection, syntax checks, and unit tests do not prove browser interactions.
2. Verify touch, pointer, scroll, focus, animation, drag, and optimistic persistence on the served target surface.
3. For optimistic persistence, observe the UI before request completion, verify successful state after reload, and verify reconciliation after request rejection.
4. Record the route, HTTP result, input sequence, and behavioral observation.
5. Follow the platform-specific Chromium section in `BROWSER_RUNBOOK.md` before browser automation.

---

## D. Server Boundary

1. Do not restart, stop, replace, or launch the Decision OS server unless the operator explicitly requests it.
2. Use the MultiTerm-owned server when it is available.
3. For this workstation, the decision-os project route is served through port `50150` under the `AGENTS.md` contract.

---

## E. Evidence

1. `AGENTS.md`
2. `BROWSER_RUNBOOK.md`
3. `bin/decision-os-verify.mjs`
4. `bin/decision-os-workload-status.mjs`
5. `package.json`
