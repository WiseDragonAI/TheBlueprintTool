# Core Master Ledger Generation

Use this procedure when generating a master document from Core `specs.json` and `data.json`.

## Source Ledgers And Tool

Always read full ledger context using the Core CLI tool:

```bash
node Core/tool/ledger-zones.js inspect Core/examples/qa-canvas/ledgers/specs.json --json
node Core/tool/ledger-zones.js inspect Core/examples/qa-canvas/ledgers/data.json --json
```

Do not read raw ledger JSON directly for semantic context unless the operator explicitly asks.

## Project Classification

Core is:

- `client`: browser/canvas UI runtime.
- `server`: Node server, API/route adapters, durable JSON ledger persistence, refresh/file/watch concerns.
- `cli`: ledger inspection, generation, apply/report/patch/worktree modes.
- `shared-data/contracts`: model/type definitions, action contracts, state contracts, ledger contracts.
- `qa-harness`: fixtures, QA canvas, dispatcher tests, browser tests, CLI tests. It is not production app architecture.

## Generation Procedure

1. Establish the analysis root before searching.

   Use the current working directory or operator-specified directory as the
   hard scope. Keep file discovery, AGENTS/README/package detection, ledgers,
   tests, and source inspection inside that directory unless a wider scope is
   explicitly requested.

2. Read `specs.json` and `data.json` through the CLI tool.

3. Discover system roots and stack boundaries before deriving capacities.

   Preserve this nesting in analysis and output:

   ```text
   System root:
     Stack:
       capacities
       inputs
       external actions
       internal emitted actions
       controllers
       effects
       state
       reducers
       helpers
       tests
   ```

   Do not collapse client, server, CLI, shared-data/contracts, QA harness, or
   sibling system roots into one controller/action/effect/state namespace.

   Not every system root or stack should implement every artifact type. Only
   emit artifact groups that fit that runtime boundary. For example, a
   background tool or CLI may have no visual components, shared-data/contracts
   should not have runtime controllers/effects, and a QA harness may own
   fixtures and integration tests without owning production state.

4. Split by stack boundary first: client, server, CLI, shared data/contracts, and QA harness when test infrastructure is relevant.

   Use domain-first structure inside each runtime. Prefer `src/server/domains/<domain>/controllers|helpers|effects` and the equivalent client domain shape over global buckets that repeat the same domains under `actions`, `controllers`, `helpers`, and `effects`.

5. For each stack, define capacities before files.
   Capacities drive all downstream architecture. Example Core capacities:
   client: app runtime, navigation, toolbox, selection, gesture, canvas viewport, card interaction, card geometry, zone authoring, zone geometry, zone deletion, thread panel, voice recording, relationship rendering, group interaction.
   server: ledger routing, ledger persistence, refresh sync, external watch bridge, voice processing.
   CLI: ledger inspection, master ledger generation, worktree generation, generated function generation, dependency graph, generated tests, report, patch batch, apply mode, cleanup.
   shared-data/contracts: models, types, schemas, state contracts, action contracts.

6. For each stack capacity, derive external inputs.
   Inputs are adapters: browser click, pointer gesture, wheel, keydown, route change, HTTP request, file watcher event, CLI command.

7. Derive reusable external actions from inputs.
   Do not generate one Action per spec card. Spec cards describe behavior to prove; Actions describe reusable operator/system intent.

8. Derive internal emitted actions separately.
   Internal emitted actions are effects output or runtime/system continuations. Examples: `emit-telemetry-event`, `emit-render-invalidated`, `emit-ledger-persisted`, `emit-refresh-requested`, `emit-voice-upload-requested`.
   They must not create standalone controllers unless they represent a real lifecycle or external boundary.

9. Derive controllers from business lifecycle/state-machine ownership.
   A controller exists when it protects invariants or coordinates a cohesive operation family.
   Do not create controllers from spec cards, route files, telemetry events, one-line effects, or one action name.

10. Derive effects after controllers.
   Effects are final output mutation/emission functions called by controllers. Controllers may fire effects that emit internal actions.

11. Derive state after capacities/controllers/effects are known.
   State should be grouped by stack.

12. Derive helpers after controller branches are known.
   Helpers are pure or async decision/data functions awaited by controllers.

13. Create one test suite per spec card.
   Each test suite dispatches previous mock state plus one or more reusable
   actions through the dispatcher for that runtime boundary. The test references
   the spec card ID but action names must not mirror spec card titles.

14. Do not put process orchestration in `src`.
    Watchers, HMR process wiring, PM2/Docker-like process supervision, dev-server loops, and boot harness logic are harness/infrastructure concerns. Put them outside production source unless the code is a real reusable runtime module.

15. Store computed runtime values in runtime state.
    Persist stable inputs, authored configuration, and values required to reconstruct the system after reload. Store computed, geometry-dependent, view-dependent, high-churn, or cheaply recomputable consequences such as arrow sides, port slots, bezier paths, label coordinates, hover styling, and selection styling in runtime state, render state, telemetry, or debug artifacts when explicitly needed.

## Output Order

One-shot the full output in this order:

A. Workspace/system-root boundary map.

B. For each system root:

1. System kind and ownership boundary.
2. Runtime stack boundaries.
3. Cross-stack imports/contracts allowed.
4. For each stack:
   - capacities
   - inputs
   - external actions
   - internal emitted actions
   - controllers
   - effects
   - state
   - reducers
   - helpers
   - tests
   - components/adapters

C. Shared contracts/data models, grouped by the stack or system that owns them.

D. Explicit non-crossing rules:

- what must not import what
- what must communicate only through contracts/API/files/events

Do not produce global lists of controllers, effects, actions, or state for a
multi-system or multi-stack workspace.

## Controller Rules

- Name controllers in dash-case.
- Controllers are operation-family orchestrators, not domain directory names.
- Controllers may handle multiple related actions.
- Controller pseudocode must branch on real state/action keys.
- Controller pseudocode must await helpers where needed.
- Controller pseudocode must call effects.
- Controller pseudocode may call behavioral `telemetry()` to explain HOW the branch behaves.
- Do not add telemetry for function names and params because those are automatic.
- Do not create a telemetry controller unless telemetry has a real lifecycle such as buffering/flushing/filtering.

Correct. `card-controller` is too broad. It becomes a switchboard, not a controller.

With one function per file and ~300 LOC controller budget, the right factorization is:

A controller is one goal-oriented operation family with enough branching to justify orchestration, but not so broad that it becomes an index of unrelated actions.

Bad:
- `card-controller`
- `zone-controller`
- `server-controller`
- `generation-controller`
- `canvas-controller`

These are nouns/domains. They will become registries.

Better:
- `open-card-controller`
- `update-card-tab-controller`
- `render-card-content-controller`
- `move-card-controller`
- `restore-card-geometry-controller`
- `select-card-controller`
- `create-zone-controller`
- `resize-zone-controller`
- `delete-zone-controller`
- `move-zone-with-contained-cards-controller`
- `generate-master-ledger-controller`
- `apply-patch-batch-controller`
- `publish-refresh-controller`

But avoid one-action-per-controller reflex. The split point is the goal/lifecycle.

Example good grouping:

`delete-zone-controller`
- request delete from edit panel
- request delete from keyboard
- open confirmation
- cancel confirmation
- confirm deletion
- preserve intersecting cards
- fire persistence effect

This is one goal: delete a zone safely.

`move-card-controller`
- drag starts on selected card
- drag starts on unselected card
- move one card
- move selected card group
- reject move when locked or invalid
- fire runtime geometry effect
- fire persistence effect

This is one goal: move card geometry.

`open-card-controller`
- open card
- bring to top z-index
- set active card
- preserve active tab or default tab
- fire render state effect

This is one goal: open/focus a card.

`update-card-tab-controller`
- switch to notes
- switch to details
- switch to discussion
- default base-card tab to notes
- reject unavailable tab for subtype

This is one goal: manage active tab state.

So the corrected controller rule is:

A controller is a single goal-oriented operation lifecycle, not a domain bucket and not necessarily one action. It should fit as one function in one file, usually under ~300 LOC. If it mainly dispatches to other controllers, it is too broad. If it has no meaningful branching/invariants, it may be just a helper/effect path, not a controller.

Helpers around ~60 LOC means helpers should be small derivation/validation units:
- `derive-zone-delete-target`
- `validate-zone-delete-confirmation`
- `derive-card-drag-scope`
- `resolve-card-tab-default`
- `derive-refresh-target`
- `validate-ledger-edit-patch`

I should update the executor rule accordingly: forbid domain-bucket controllers and require goal-oriented lifecycle controllers sized for one-function-per-file.

## File Ownership Heuristic

Client controllers:

- app/runtime/navigation/toolbox
- canvas/gesture/hit-testing/render
- selection/clipboard
- card/zone/group/relationship/thread/voice/overlay UI lifecycles

Server controllers:

- route/API adapters stay outside controllers.
- ledger persistence, refresh sync, file watch bridge, voice processing, durable state.

CLI controllers:

- inspect, master ledger generation, worktree generation, generated functions, dependency graph, tests, reports, patches, apply/dry-run, cleanup.

Shared data:

- models, types, schemas, payload contracts, state contracts.

QA harness:

- fixtures, test runners, QA canvas surfaces, dispatcher integration tests.
