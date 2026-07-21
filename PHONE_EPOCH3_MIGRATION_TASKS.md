## A. Phone Epoch-3 Migration Tasks

1. [x] Workstation migration completed.
2. [x] Pull phone code to commit `f59ddc36`.
3. [x] Verify the phone federation identity is `phone`.
4. [x] Verify the phone registry is version `2` with five projects.
5. [x] Stop the phone server and verify port `50150` is closed.
6. [x] Confirm the phone has no epoch-3 format markers.
7. [x] Verify the workstation migration used commit `f59ddc36`.
8. [x] Confirm the workstation populated and converged with the reset relay.
9. [x] Review preserved phone stashes and backups for state that must be retained.
10. [x] Validate all registered phone projects, Tasks ledgers, card files, thread files, and managed assets.
11. [x] Verify no project repository contains operator-approved staged changes.
12. [x] Commit the phone’s tracked task ledgers, Markdown sidecars, project metadata, and managed assets.
13. [x] Record phone commits: pre-cutover home `145c59b`, Decision OS `5a6be8c4`, and lys `d37136c`; cutover home `5198e22`, Decision OS `b3eff469`, and lys `8698d66`.
14. [x] Freeze phone-side Decision OS edits.
15. [x] Run the node-local phone migration.
16. [x] Save backup `/data/data/com.termux/files/home-decision-os-node-migration-rollback/2026-07-21T19-37-02.453Z-phone` and its `node-migration-report.json`.
17. [x] Confirm the report includes all five projects.
18. [x] Validate every format marker, baseline root, audit, inventory, projection checksum, resource head, and immutable object.
19. [x] Start the phone server.
20. [x] Wait until every phone project root equals its relay root.
21. [x] Confirm workstation-only and phone-only tasks appear in the phone projection.
22. [x] Confirm divergent shared fields appear as explicit conflicts.
23. [x] Verify phone task writes become enabled.
24. [x] Verify exact-hash retrieval of workstation-owned content.
25. [x] Restart the phone once and confirm roots and projections remain unchanged.
26. [x] Retain phone backups and migration evidence through cutover acceptance.
