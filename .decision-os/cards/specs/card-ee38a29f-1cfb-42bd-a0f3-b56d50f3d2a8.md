#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-12T12:43:37.442Z
Queue rank: 1
Active since: 2026-07-13T05:45:59.156Z
Completed at: 2026-07-13T06:00:34.970Z

## A. Specs Summary

1. **Termux master server.** Run one Decision OS server from the Termux home on Android instead of running the server from the Decision OS repository.
2. **Nested repository coverage.** Let that master Decision OS server recursively detect and handle project directories containing one or more Decision OS ledgers anywhere beneath the Termux home. Intermediate directories do not need to contain Decision OS data: for example, `home/admin` can contain Decision OS data while `home/dev` contains none and `home/dev/project-a`, `home/dev/project-b`, and `home/dev/project-c` each contain one or more Decision OS ledgers.
3. **Single user entry point.** Let the user work across those repositories without navigating between separate Decision OS servers.
4. **Global overview.** Provide one overview of all tasks, projects, and work to do across the detected repositories.
5. **Project hierarchy and naming.** Add one layer above ledgers in Control Room. The hierarchy becomes `project → ledger → zone → card`; a project represents its project directory. Its CWD path may contain multiple path segments, while its displayed project name is the project directory basename, not the full CWD path.
6. **Project-aware runtime.** Make the main server and Control Room aware of the different project CWDs.
7. **Task organization.** Organize tasks by project and then by ledger.
8. **Two-stage filtering.** Add a project filter followed by a ledger filter. Selecting a project shows that project's tasks and only that project's ledger filters.
9. **Project colors.** Allow a color to be assigned to each project.
10. **Project configuration.** Add a project configuration layer to the burger menu.
11. **Planning boundary.** Start with discovery of the current codebase and current behavior, then progress through the work required for the final implementation.

---

## B. Delivery Sequence

1. **Discover current behavior** before defining the cross-project contracts.
2. **Define project discovery and identity** from verified repository and runtime evidence.
3. **Define project configuration and colors** as the durable project-level settings contract.
4. **Implement the multi-project server layer** and project-scoped data access.
5. **Add the project layer to Control Room** above the existing ledger hierarchy.
6. **Implement project-then-ledger task filtering** with ledger choices scoped to the selected project.
7. **Add project management to the burger menu**, including project colors.
8. **Verify the complete Termux-home workflow** and document how to launch and use the master server.

---

## C. Acceptance Criteria

1. **Launch scope.** A Decision OS server launched from the Termux home recursively handles project directories containing Decision OS ledgers at different nesting depths beneath that home, including projects beneath intermediate directories that contain no Decision OS data.
2. **Hierarchy.** Control Room exposes `project → ledger → zone → card`.
3. **Unified view.** The user can see work across projects through one Decision OS server.
4. **Task filters.** Tasks can be filtered first by project and then by a ledger belonging to that project.
5. **Project settings.** Each project can be configured in the burger menu and assigned a color.
6. **Project naming.** Each project displays the basename of its project directory while retaining its nested CWD path for project resolution.

---

## D. Subtasks

1. [Map current workspace and server resolution](card:card-ba280bee) — Status: complete
2. [Specify project discovery and identity](card:card-a4db686f) — Status: complete
3. [Specify project registry and color settings](card:card-3144fd86) — Status: complete
4. [Implement multi-project server access](card:card-8ac5b051) — Status: complete
5. [Add the project hierarchy to Control Room](card:card-ad51d385) — Status: complete
6. [Implement project and ledger task filters](card:card-bebbeee1) — Status: complete
7. [Add project configuration to the burger menu](card:card-3f3f5d05) — Status: complete
8. [Verify and document the Termux master workflow](card:card-ba20da2c) — Status: complete