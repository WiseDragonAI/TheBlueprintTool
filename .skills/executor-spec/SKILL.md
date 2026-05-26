---
name: executor-spec
description: Transform Specs, Data Model, Runtime State and executor-stack analysis output into a master ledger then used to create the scaffold of the whole codebase or codebase section. Read the WHOLE document, not only a subsection. CREATE the master-ledger document FIRST, then WRITE each section one AFTER the other.
---

# Executor Spec

The purpose is to turn `stack analysis` into a `Master Ledger`, containing the complete or partial scaffold, depending on the `operator` demand.

---

## A. Nomenclature and Definitions

### A.1 Spec

- A `spec` is an `operator`-authored truth constraint over the system: it defines an expected property, behavior, capability, or invariant that must hold in *all applicable situations*, **independent of how the system is implemented**.

- An `Anti-Spec` is an operator-authored truth constraint that says what the system must not do, must reject, or must never infer.

### A.2 Data Model

A `Data Model` is the `operator`-authored schema of the system’s *durable and contractual data*: the entities, tables, records, fields, identities, relationships, and constraints that the implementation must *store, load, validate, and exchange*.

### A.3 Runtime State
`Runtime State` is the current *in-memory state* of the running system: the session, UI, interaction, process, cache, selection, pending operation, telemetry, and *transient values* that can change *while the system executes* and that may be derived from, synchronized with, or eventually persisted into the `Data Model`.

### A.4 Root Block

- A Root Block is a top-level system part with its own runtime or ownership boundary.

- It can be a frontend, backend, mobile app, CLI, worker, engine, library, QA harness, or shared contract package when it owns its own project shape.

- Root blocks should have already been defined by the previous `executor-stack` step.

- A root block is a package/app/engine/tool with its own source, package, build process, metadata, README/AGENTS guidance, runtime entrypoint, data, generated and tests.


### A.5 Domain

A `domain` is a business subject area inside a `Root Block`.

It groups the logic that owns the same business object, capability, or invariant.

```text
business/
  auth/
  billing/
  podcast/
  subscription/
  account/
```

A `domain` is not a screen and not a route.

- `route/auth.route.ext` receives auth-related input.
- `ui/component/login/` renders a login screen.
- `business/auth/` owns auth behavior: login, logout, register, recover password, permissions.

Inside a `domain`, use the Skill behavior nouns:

```text
business/
  auth/
    action/
    controller/
    helper/
    effect/
```

Short definition:

> A `domain` is the business ownership boundary for related `actions`, `controllers`, `helpers`, and `effects` inside a `Root Block`.

###### Domain and Data Model

A `domain` can match a `Data Model` entity, but it does not have to.

- A `Data Model` is durable and contractual data: tables, records, fields, relationships, schemas.
- A `domain` is business ownership: the area that owns behavior, invariants, controllers, helpers, and effects.

They often overlap:

```text
Data Model: User
Domain: auth or account

Data Model: Subscription
Domain: subscription or billing

Data Model: Podcast
Domain: podcast
```

They can also diverge:

```text
Domain: checkout
Data Models: cart, user, subscription, payment, invoice

Domain: auth
Data Models: user, session, permission, token

Domain: search
Data Models: podcast, tag, author
```

Rule:

> A `domain` is derived from business behavior and invariants, not mechanically from table names or model names.

If one `Data Model` owns a coherent lifecycle, it may become one `domain`. If a lifecycle crosses several `Data Models`, the `domain` should follow the lifecycle, not the storage shape.



### A.6 Screen || Page

A `screen` or `page` is a user-facing UI surface inside a frontend, client, or mobile `Root Block`.

It is the presentation composition that the operator can see or interact with.

A `screen` or `page` can:

- render `components`
- read `Runtime State`
- emit `inputs`
- display `effects` feedback

A `screen` or `page` is not a `domain`.

A `screen` or `page` can involve several `domains` at the same time.

Example:

```text
ui/
   component/
      login/
      checkout/
      account-settings/
   style/
      login/
      checkout/
      account-settings/
```

*checkout* as a screen may involve:

```text
business/
  cart/
  account/
  subscription/
  payment/
```

A `screen` or `page` is also not a *route*.

- A *route* receives navigation or browser input.
- A `screen` or `page` renders the UI surface.
- A `controller` owns behavior after an `action` is created.
- A `domain` owns business logic and invariants.

Rule:

> A `screen` or `page` is a UI composition boundary, not a business ownership boundary.

### A.7 Component

A `component` is a UI building block.

It renders part of a `screen` or `page`.

A `component` can receive data, display state, and emit user inputs like clicks, typing, or gestures.

A `component` does not own business logic. Business logic belongs to `controllers` inside `business/{domain}`.




### A.8 Test
Proves the full flow through `input`, `action`, `controller`, `helper`, and `effect` with the `help` of `telemetry`

### A.9 Input
A named entry condition *from outside* the behavior. It is part of the `spec` surface, not an execution unit.
> Examples: browser load, click, pointer drag, HTTP request, file watcher event, server refresh event.

### A.10 Action
Command **payload** describing what happened or what is requested.

### A.11 Controller
Behavior owner. It branches, orchestrates, and decides the path.
It **DOES NOT** contains implementation details, only branching, functions calls: `helpers`, `effects` and `telemetry`

### A.12 Helper
*Implementation extraction* from `controller` logic.
It may be sync or async and may do IO.

> Exemple: parsing text, validating data, querying a database, writing a file, deriving a branch decision, formatting output, calculating geometry, normalizing values or loading configuration.

### A.13 Effect
Final output call; called by the `controller` with no expected response.
A `controller` can call several `effects` along the execution.

> Exemple: Effects are final output calls used by controllers for things like publishing a state change, emitting a UI update, sending a response, notifying another system, committing a visible write result, or reporting telemetry.

### A.14 Telemetry

`Telemetry` is the execution evidence emitted during the flow so `tests`, `operators`, and `stack trace` can prove what happened.

It records things like the selected `controller branch`, `helper` calls, `effect` calls, `arguments`, `timing`, `errors`.

`Telemetry` is *observational*: it may report execution, but it **MUST NOT** decide behavior, replace controller branching, or become the source of truth for the result.



---

## B. Hard Rules

### B.1 STICK TO THE SPECS

- **NEVER invent** nomenclature NOT present in the Specs or Data.
- You **HAVE TO** speak like **this Skill** speaks.
- Speak with the words present in the Specs, Data Model, Runtime State, existing codebase, references, or operator instruction.
- Use this skill to create the file and directory `architecture` for the `master ledger` document.
- Use `references` only to pressure-test stack `topology` and applicability, not to override operator `Specs`.

### B.2 Question Rules

Each question must include:

- `question`: one direct question for the operator.
- `why`: the specific ambiguity or applicability risk.
- `source`: exact Spec, Data Model item, Runtime State item, stack item, existing code fact, or reference convention that raised it.
- `impact`: what cannot be safely produced until the question is answered.
- `expected-answer-shape`: the kind of answer needed, such as yes/no, choose one stack, provide missing Data Model fields, provide Runtime State object, confirm Anti-Spec, or confirm Root Block boundary.

Do not ask broad preference questions. Ask only questions that change the Master Ledger or prevent invention.


---


## C. Workflow

- Read `Specs`, `Data Model`, and `Runtime State` through the ledger read tool.
- Read the `executor-stack` output in `./tmp` directory -> `executor-analysis-{YY-MM-DD-N}.md`
- Refer to the proposed Root Repo Structure, your job is now to complete the `root blocks`
- Create or update a temporary document inside an untracked `tmp` directory under the analysis root.
- Name it `master-ledger-{iteration-name (root if whole codebase)}-{YY-MM-DD-N}.md`, increasing `N` when a file already exists for the date.
- Your role is to create the master ledger section by section. You do **NOT** infer it all at once.
- Write a section, then reflect on the section, then improve, then next section.

### C.1 List of all domains

- Using the definition of `domain`, prepare a list of `domains` that will become the specific nomenclature for the codebase.

```js
{
   root_block: 'name of the root block', // Refer to the root block for traceability
   description: 'what the domain is about, which data models and runtime states it refers to', // Prose
   domain_name: 'single word or rarely, composed dash case name', // Unique
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure** the list of domains cover all the `specs` semantic and there is no hidden point.

### C.2 Test Suites
Create a list of `tests suites`, one suite per Spec.

```js
{
   suite_name: 'case we are verifying is true', // The description of what we are testing, prose
   spec_id: 'the original spec id', // Contained in the card
   root_block: 'name of the root block', // Refer to the root block for traceability
   path: './path/to/the/test/file.ext', // Depends on root blocks topology and tech
   expected_telemetry: ['list', 'of', 'expected', 'telemetry', 'events'], // It can summed as an early list of asserts

   // Future fields to leave blank for now
   input_lists: [] // Leave blank - Will be retrofilled once we know inputs
   prev_state: {} // Leave blank for now - Will be retrofilled when we have the state shape
   controller_id: '' // Leave blank for now - Will be retrofilled once we know controllers
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure NO** `spec` is forgotten, `specs` <- 1:1 -> `test suites`

### C.3 Inputs

Create the list of inputs necessary for each treated `root block`.

```js
{
   root_block: 'name of the root block', // Refer to the root block for traceability
   input_name: 'Name of the input',
   input_type: 'operator:keyboard, server:http, ...',
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure** we can trigger all the tests paths with the list of inputs.

### C.4 Operator Inputs

**ONLY** if one root block has a runtime state, like a client.
Create the input state:

```js
{
   left_click: false,
   // ... Continue with all operator inputs
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure** All `specs` mentionning `inputs` yielded an input entry.

### C.5 Effects and I/O Helpers
Create the list of effects and io helpers, those are the measurable outcomes reflected by the `telemetry`.

```js
{
   type: 'effect | helper',
   root_block: 'name of the root block', // Refer to the root block for traceability
   description: 'what the function does', // Prose to explain the role of the helper, MUST contains implementation details.
   name: 'meaningful-name', // dash-case
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure** All `telemetry` events mentionned in section `test suites` have their matching `effect` or `helper`.


### C.6 Screens || Pages

**WHEN APPLICABLE**, list all the screens || pages

```js
{
   root_block: 'name of the root block',
   screen_name: 'single word or dash-case screen/page name',
   description: 'what the operator sees or does on this UI surface and how does it serves specs', // Prose
   components: ['list', 'of', 'specific', 'or', 'shared', 'components', 'used', 'by', 'this', 'screen'] // They don't exist yet
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure** all the `specs` will be actionable when the `screens || pages` are implemented.
**Ensure** you don't have several `components` with similar names, enfore *unicity* and *factorization*.


### C.7 Components

- Create a list of `components` from the lists created in the `page` || `screen` section.

- A components can be a form, a modal, a popup, a small unit like a button, etc...

- Components can have inheritance, a specific button will inherit from the parent button.

```js
{
   root_block: 'name of the root block',
   screen_name: 'single word or dash-case screen/page name', // Screen name or SHARED for shared components
   name: 'name-of-the-component',
   parent_component: 'name-of-the-component', // NULLABLE - used only when component extends a parent. e.g. a specific button in one screen whioch extends a shared one
   description: 'What the component show on screen, how it shows it',
   local_state: ['list', 'of', 'runtime', 'state', 'props', 'the', 'component', 'needs', 'to', 'show' ], // From a local state, e.g. useState in react
   runtime_state: ['list', 'of', 'runtime', 'props', 'the', 'component', 'needs', 'to', 'show' ], // Lists the global runtime state variables the component needs to access to display information.
   helpers: ['list', 'of', 'helpers', 'the', 'component', 'needs', 'to', 'dispatch', 'actions'], // Refer to control-flow reference file
}
```

> WRITE IN FILE THEN RE-ASSESS
**Ensure** the `screens || pages` will be properly built and has all the necessary `components`.
**Ensure** `components` are properly factorized, no duplication. Use inheritance/`shared` if necessary.


### C.8 State

- From the list of `component` state props, the `Data` ledger and your understanding of the runtime shape, create a composed state.

- Only applicable for a state machine (e.g. `frontend`, `app` - **NOT** stateless `backend`).

```js
{
   root_block: 'name of the root block',
   name: 'name-of-the-state', // ROOT if base state
   domain: 'name-of-the-domain',
   props: [ 'list', 'of', 'runtime', 'props', 'used', 'by', 'the', 'app', ], // Ensure unicity accross states
}
```

> WRITE IN FILE THEN RE-ASSESS
**Ensure** proper factorization, no cross-ownership - This is the **MOST** delicate operation in the whole process -> A wrong ownership will create tech debt that is sometimes extremelly costly to fix.

**Ensure** NO local state props leaked in the global state


### C.9 Control-Flow Entries

Create the list of `control-flow entries` for each `Root Block`.

A `control-flow entry` defines one behavior address:

The generator will create both `action` and `controller` so the *control-flow* block is enough.

```js
{
   root_block: 'name of the root block',
   domain: 'domain name',
   controller: 'dash-case-controller-name',
   description: 'behavior lifecycle owned by this controller',
   action_payload: ['list', 'of', 'inputs', 'that', 'create', 'this', 'action'], // This is the arguments of the controller functions, set by the component helper or route helper.
   helpers: ['helper-name'], // list of helpers used by the controller
   effects: ['effect-name'], // List of effects used by the controller
   pseudoCode: `here the pseudo code, containing the comments, function signature, branching, state usage if applicable, helpers and effects calls plus telemetry events - it must be valid syntax` // Read the references/controller-pseudo-code.md file, and implement the pseudo code LIKE IN THAT FILE - use backticks for multiline
}
```

> WRITE IN FILE THEN RE-ASSESS

**Ensure** every `control-flow entry` is reachable from at least one `helper`.
**Ensure** every `control-flow entry` contributes to at least one `test suite`.
**Ensure** every `helper` and `effect` event used by the list and pseudo exists in previous ledger sections.

---

## D. Post Master-Ledger Document Creation

### D.1 Consistency Pass

Verify the `Master Ledger` has no dangling references.

**Ensure** every `domain` used by a `control-flow entry`, `screen || page`, `component`, `state`, `helper`, or `effect` exists in `C.1`.

**Ensure** every `input` used by a `test suite`, `component`, `route`, or action helper exists in `C.3`.

**Ensure** every `component` listed by a `screen || page` exists in `C.7`.

**Ensure** every `state` prop used by a `component` or `control-flow entry` exists in `C.8`.

**Ensure** every `helper`, `effect`, and `telemetry` event referenced by a `control-flow entry` exists in previous sections.

**Ensure** every `control-flow entry` is reachable from at least one `input`.

**Ensure** every `test suite` maps to one original `Spec`.

### D.2 Operator Questions and Unresolved Items

Create the list of questions only for gaps that cannot be answered from:

- `Specs`
- `Data Model`
- `Runtime State`
- `executor-stack` output
- existing approved nomenclature
- explicit operator instruction

Each question must use the required question format:

```js
{
   question: 'one direct question for the operator',
   why: 'specific ambiguity or applicability risk',
   source: 'exact Spec, Data Model item, Runtime State item, stack item, code fact, or reference convention',
   impact: 'what cannot be safely produced until answered',
   expected_answer_shape: 'yes/no, choose one, provide missing fields, confirm Anti-Spec, confirm Root Block boundary, etc.'
}
```

### D.3 New Spec and Anti-Spec Candidates

Create this section only when the `Master Ledger` reveals missing or forbidden behavior.

Use `New Spec Candidate` when implementation needs an operator-approved truth constraint that does not exist yet.

Use `Anti-Spec Candidate` when the system must reject, forbid, or never infer something.

```js
{
   type: 'new-spec-candidate | anti-spec-candidate',
   statement: 'the candidate truth constraint',
   why: 'why this is needed',
   source: 'ledger section or unresolved item that revealed the gap',
   impact: 'what implementation or test cannot be completed without this decision'
}
```

### D.4 Final Readiness Gate

The `Master Ledger` is ready for `executor-implement` only if:

- no required `Spec` is uncovered
- no `control-flow entry` is unreachable
- no referenced `helper`, `effect`, `component`, `state`, or `domain` is missing
- no unresolved item blocks generation
- every `test suite` has enough `input`, `state`, `control-flow`, `helper`, `effect`, and `telemetry` information to be generated
- the controllers contains pseudo code with function signature, comments, branching, telemetry events, helpers/effects calls