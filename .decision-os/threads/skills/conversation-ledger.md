# OPERATOR
<!-- decision-os:note {"id":"note-1783444041023-06310459292d3","timestamp":"2026-07-07T17:07:21.029Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1783444041031-be320951-33e0-476e-835a-397e57abc604.wav","status":"transcribed","transcriptionStartedAt":"2026-07-07T17:07:21.038Z"} -->

On a un skills qui s'appelle Ticket Solver, mais là ce que je veux réussir, et on a plein de skills d'ailleurs dans Droid Fleet Factory, je veux que tu me listes les skills qui sont des skills de planification, qui prennent un goal et qui le splittent dans une liste de tâches. Tu me les listes et ensuite tu m'extrais l'information intéressante.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783444248117-a0b31dbd","timestamp":"2026-07-07T17:10:48.117Z"} -->

I updated the Skills ledger card `Planning Skill Inventory` with the durable inventory.

Primary installed planning skills:

1. **`executor-precheck`** checks whether the operator goal has enough `Specs`, `Data Model`, `Runtime State`, repo facts, and scope boundary before planning can start.
2. **`executor-stack`** turns approved specs/data/runtime into root-block and stack planning, plus blocking operator questions and an agnostic directory scaffold.
3. **`executor-spec`** is the closest true `goal -> implementation task list` skill. It builds the `Master Ledger`: domains, one test suite per spec, inputs, helpers, effects, screens/pages, components, state, control-flow entries, unresolved questions, and spec candidates.
4. **`openticket`** turns a broad operator problem into `REQ-*` requirements, scope, dependency blockers, an ideal control-flow DAG, and acceptance checks before creating a GitLab ticket.
5. **`improveticket`** applies the same planning shape to an existing weak GitLab issue and makes it factory-actionable after approval.

Planning-adjacent skills:

1. **`product-analysis`** is the best first analysis step for a vague goal, but it explicitly does not recommend a path or implementation plan.
2. **`ticket-solver`** is execution-first. It creates a working document and full DAG for an existing ticket, then implements and verifies the ticket.
3. **`executor-implement`** consumes the `Master Ledger`; it should not infer architecture or split the goal itself.
4. **`decision-os-treat-open-notes`** processes operator notes, but it is an inbox workflow, not a general task planner.

Interesting extraction:

1. **The real planner chain is** `product-analysis -> openticket/improveticket -> executor-precheck -> executor-stack -> executor-spec -> executor-implement`.
2. **`ticket-solver` belongs after a ticket exists**, not at the start of a broad goal.
3. **The product-level missing capability is a task extractor/work queue:** operator notes should become durable `Tasks`, each execution attempt should become a `Run`, and dependencies, leases, status, and evidence should live outside plain threads.
4. **The staged skill pipeline needs more metadata:** current skill discovery gives `name`, `description`, `source`, and `skillFile`, but not input/output compatibility, stage validity, artifact contract, model defaults, or effort defaults.
