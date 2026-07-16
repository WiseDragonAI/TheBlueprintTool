## A. Scope

1. **Objective:** Verify the Codex `STOP` control on the operator-facing served thread surface with a real active process.
2. **Route:** Use `http://127.0.0.1:50150/projects/ZGVjaXNpb24tb3M/specs/zone/zone-34058ea4-80db-479d-b410-20d999711670/card/card-64a9c5b1-3061-462b-bda0-275d69947712` and open the master task thread containing the active Codex session widget.
3. **Server ownership:** Inspect the existing process and route without restarting or stopping the decision-os server unless the operator explicitly requests it.

---

## B. Verification Sequence

1. **Initial state:** Start a disposable Codex run from a test card and confirm the widget shows the large square `STOP` control only while the run is cancellable.
2. **Pointer behavior:** Activate `STOP` with representative browser pointer input and confirm one cancellation request is emitted before the control becomes disabled as `STOPPING`.
3. **Process state:** Confirm the targeted Codex child process terminates and the widget reaches terminal `CANCELLED` state without another request.
4. **Reload:** Reload the same thread and confirm the persisted run remains terminal and the `STOP` control does not reappear.
5. **Failure behavior:** Exercise a controlled rejected cancellation request and confirm the enabled `STOP` control returns with the server error visible.

---

## C. Completion Gate

1. **Evidence:** Record the route, HTTP result, browser input, request count, process observation, terminal widget state, reload state, and rejected-request reconciliation.
2. **Behavioral requirement:** Do not mark this card `done` from source assertions, syntax checks, or unit tests alone.
3. **Claim:** Until the browser sequence is observed, report `implemented; automated checks pass; device interaction not yet verified`.

---

## D. Current Verification State

1. **Route:** The exact project-scoped card route returns `200 text/html` with `cache-control: no-store`.
2. **Assets:** The served widget module returns `200 text/javascript` and contains `codex-run-stop`, `Stop Codex run`, the solid `■` icon, and `STOP`; the served stylesheet contains the `58px` stop-control rules.
3. **Backend regression:** The focused integration test starts a real fake child process, sends the stop request, observes `SIGTERM`, and reads terminal `cancelled` status.
4. **Open gate:** The operator-facing server process started before merge `de000dd`; it must be restarted before the corrected project runtime registry can be exercised through the browser.

---

## E. Contradicted Mobile Evidence

1. **Screenshot:** Mobile Brave displayed a running `Codex Log` status strip with no stop action at `2026-07-13T09:20:17.638Z`.
2. **RCA:** The photographed surface used `renderThreadCodexLogStatus`; the previous button existed only in `renderCardSkillRunWidget`.
3. **Current served files:** The mobile route and all four corrected assets return `200` and expose the `64px` `STOP` control plus mobile click routing.
4. **Backend state:** The decision-os backend process has restarted since merge `de000dd`, loading the persistent project runtime registry required for the stop endpoint to find the active child.
5. **Focused validation:** Reload the same Brave route, open `Codex Log` while its status is `RUNNING`, tap `STOP`, and report whether the widget shows `STOPPING` then `CANCELLED`.
6. **Visual checkpoint passed:** The operator screenshot at `2026-07-13T09:36:42.610Z` shows `RUNNING`, elapsed `00:04`, tools `0`, and the large red square `STOP` control on mobile Brave.
7. **Interaction checkpoint open:** No supplied evidence yet shows the tap, cancellation request, terminated child process, terminal `CANCELLED` state, or persistence after reload.
8. **Redesign checkpoint:** After merge `98d60f9`, verify mobile Brave shows one row containing the action, model, effort, elapsed time, and tools; terminal runs must replace red `STOP` with blue `RESUME`.

---

## F. Failed-Tap Checkpoint

1. **Operator evidence:** The mobile Brave tap reported at `2026-07-13T09:44:46.987Z` did not stop the displayed run.
2. **Missing capture:** No browser request trace accompanies the report; request emission and response status for that tap remain unverified.
3. **Verified UI cause:** The served renderer previously exposed `STOP` from a `runId` plus a default `running` status without requiring backend-confirmed `active: true`; polling also removed the controller's transient rejection DOM.
4. **Corrected served assets:** The route returns `200`; served modules now require confirmed active state and retain pending/error state through rerenders. The current read endpoint returns `active: true` for the running process.
5. **Server constraint:** No manual restart is required and none was performed.
6. **Open interaction:** Tap the newly served `STOP` control once on mobile Brave and record `STOPPING`, terminal `CANCELLED`, and the post-reload terminal state before marking this card `done`.
