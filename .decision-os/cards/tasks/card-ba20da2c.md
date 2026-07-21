## A. Objective

1. **Verify final behavior.** Exercise one Decision OS server launched from the Termux home against a root-level project and multiple nested project directories beneath an intermediate directory with no Decision OS data.

---

## B. Verification

1. **End-to-end workflow.** Verify recursive discovery, directory-basename project names, nested CWD resolution, multiple ledgers in one project, the `project → ledger → zone → card` hierarchy, global overview, project switching, two-stage task filtering, project configuration, project colors, and project-scoped mutations.
2. **Regression suite.** Run the relevant backend, frontend, Control Room, and ledger tests.
3. **Launch documentation.** Document the exact Termux-home background launch and verification procedure for the master server.

---

## C. Exit Criteria

1. **Operator-ready workflow.** The documented master-server flow satisfies every master acceptance criterion with recorded verification evidence.

---

## D. Current Evidence

1. **Documentation.** `README.md` contains the exact Termux-home background launch command with `PORT=50150`, the mobile frontend root, log path, project-catalog check, and HTTP route check.
2. **Automated workflow.** Synthetic home tests cover a root-level project and nested projects beneath `dev`, with `dev` containing no Decision OS state.
3. **Live launch.** The merged launcher and backend processes are running from the Termux home on port `50150`. `/` and `/decision-os/projects` return HTTP `200`; the live catalog identifies `decision-os` by basename with relative path `.` and six ledgers.
4. **Persistence and isolation.** Live color persistence, restoration, project-scoped state, and invalid-project rejection pass.
5. **Remaining gate.** The live URL was opened in the Android browser. One operator-observed pass of project navigation, project filtering, ledger filtering, and color reload remains required because both available browser automation paths are blocked by verified Android runtime permissions.
