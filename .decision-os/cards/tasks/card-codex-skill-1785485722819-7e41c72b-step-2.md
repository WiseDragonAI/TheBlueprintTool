## A. Gate Context

1. **Task-dependency** `returned` `READY_FOR_TASK_GROUP_COMPLETENESS` from source card `card-codex-skill-1785485722819-7e41c72b` with six tasks, three sequential groups, nine directed edges, and no unresolved product ambiguity.
2. **Repository audit** `confirmed` that `GET /api/diagnostics/incidents` already supplies the incident `context`, scope, status, severity, components, occurrences, and observation timestamps required by `T1`; `GET /decision-os/projects` already supplies the exact catalog ids consumed by the frontend.
3. **Architecture boundary** `remains` frontend-only: no backend API, durable data model, configuration, migration, or production fixture change is required.
4. The **`dev` branch** and `origin/dev` both `resolve` to `10ae9985` in `/home/jbb/dev/EditorBP/decision-os/.worktrees/dev`; all inventoried product and test paths are clean, no staged hunks exist, and unrelated modified Decision OS files must `remain` untouched.
5. The **dev canary** on `50151` `serves` `/status` with HTTP `200` from that worktree and exposes both project-owned and unowned active incidents plus an incident-free catalog project; final served proof must `target` `http://127.0.0.1:50151/status` without restarting either server.

---

## B. Engineering Repairs

1. **T1** must `resolve` owner identity from an exact catalog match in `incident.context.projectId`, then parse an exact catalog id from `/p/:projectId` request scopes and colon-delimited scope tokens; unknown ids and substring-only matches must `remain` unowned.
2. **T1** must `group` by owner plus code and message after ownership resolution, aggregate occurrences, components, scopes, incident count, earliest first observation, latest last observation, and interruption state, and select severity deterministically with `fatal` above `error` above `warning`.
3. **T1** must `return` one renderable row model containing every catalog project with its unchanged availability projection and nested incident groups, followed by one conditional System row only when unowned active groups exist.
4. **T4** must `add` negative ownership fixtures for unknown `context.projectId`, substring-only scope matches, and conflicting context-versus-scope owners; it must also prove deterministic severity precedence and complete aggregate retention.
5. **T5** must `create` a disposable catalog workspace inline in `tests/browser/application/system-status-project-incidents.spec.ts`, with stable `project.json` ids, minimal project ledgers, and a valid root `.decision-os/runtime-incidents.json` containing project-owned, unowned, identical cross-owner, mixed-severity, and resolved incidents. The fixture and isolated server process must `be removed` in `finally`.
6. **T6** must `record` the final branch SHA, exact changed-path inventory, focused and full verification commands, canary route HTTP result, pointer and keyboard observations, viewport overflow result, page-error result, and confirmation that the served process still derives its frontend from `/home/jbb/dev/EditorBP/decision-os/.worktrees/dev`.

---

## C. Corrected Dispatch Groups

1. **G1** `owns` `T1`, `T2`, `T3`, and `T4` in that order across `frontend/src/app/responsive/runtime-status.js`, `frontend/src/app/responsive/application.js`, `frontend/index.html`, `frontend/assets/runtime-status.css`, and `frontend/test-responsive/runtime-status.test.mjs`.
2. **G1** must `complete` the owner resolver, owner-scoped aggregation, deterministic severity precedence, unified native `details` and `summary` rendering, responsive styling, shell cleanup, and positive plus negative focused fixtures before handoff.
3. **G2** `owns` `T5` only in `tests/browser/application/system-status-project-incidents.spec.ts` after G1 stabilizes the row model and DOM. It must `prove` initial open state, pointer and keyboard toggling, conditional System placement, retained incident labels, desktop and 390-pixel layout, no horizontal overflow, and no page errors against its disposable fixture server.
4. **G3** `owns` verification-only `T6` after G2 passes. It must `run` the scoped frontend typecheck and full repository suite through `node bin/decision-os-verify.mjs -- <direct-command>`, then inspect the existing dev canary without restarting it.

---

## D. Sequential Gates

1. **G1 to G2:** projection and shell tests must `pass` for exact owner priority, false-attribution rejection, no cross-owner merge, deterministic severity, resolved-history exclusion, complete field retention, federated-cache availability independence, conditional System placement, and standalone-block removal.
2. **G2 to G3:** the isolated Linux Playwright scenario must `pass` using `/snap/bin/chromium` with `--no-sandbox`, `--disable-dev-shm-usage`, and `--disable-gpu`.
3. **G3 defect routing:** any product or fixture defect found during final verification must `return` to its owning group; G3 must remain verification-only.

---

## E. Dispatch Boundary

1. **No blocking question** `remains`; current source and repository evidence determine the necessary implementation and verification work.
2. **Dispatch readiness** is `ready` after these input-card repairs.
