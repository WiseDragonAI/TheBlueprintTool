---
name: executor-stack
description: Phase 1 Analysis. Analyze the Specs and Data ledger passed as argument or discovered in the current project, contextualize the stack in the whole specs invariants, define root stacks and validate techical choices. Expand awareness and confirm technical completude before executor-spec questions.
---

# Executor

- This skill exists to transform a ledger of `Specs`, `DataModel` and `Runtime State` into an implementation scaffold, saved in one file: The `Master Ledger`.

- **Never invent** new nomenclature to describe phenomenons.

- If you can't describe what you are doing with the approved nomenclature in this skill, the analyzed `specs`, `data model` and `runtime state`, stop and explain to the operator what misses.

- Read project specs/data through the CLI ledger tool first, identify where `specs.json` and `data.json` are, relative to the project.

```bash
`node ./tool/ledger-zones.js inspect specs.json --json`
`node ./tool/ledger-zones.js inspect data.json --json`
```

---

## A. Nomenclature and Definitions

### A.1. Spec

A `spec` is an `operator`-authored truth constraint over the system: it defines an expected property, behavior, capability, or invariant that must hold in *all applicable situations*, **independent of how the system is implemented**.

### A.2. Data Model

A `Data Model` is the `operator`-authored schema of the system’s *durable and contractual data*: the entities, tables, records, fields, identities, relationships, and constraints that the implementation must *store, load, validate, and exchange*.


### A.3. Runtime State
`Runtime State` is the current *in-memory state* of the running system: the session, UI, interaction, process, cache, selection, pending operation, telemetry, and *transient values* that can change *while the system executes* and that may be derived from, synchronized with, or eventually persisted into the `Data Model`.

### A.4. Root Block

- A Root Block is a top-level system part with its own runtime or ownership boundary.

- It can be a frontend, backend, mobile app, CLI, worker, engine, library, QA harness, or shared contract package when it owns its own project shape.

- When you detect a webserver along a browser client, use the default nomenclature *backend* and *frontend*. If it's a mobile app, use *app*.

- If the `specs` are specifying another nomenclature, use the `specs` as canonical nomenclature.

A Root Block usually has its own:
- source directory
- package/build metadata
- runtime entrypoint
- tests
- framework conventions
- deployment or execution target
- data/generated output ownership

>Example:
>repo/
>  frontend/   # Root Block
>  backend/    # Root Block
>  worker/     # Root Block

---

## B. Hard Rules

### B.1 STICK TO THE SPECS

- **NEVER invent** nomenclature NOT present in the Specs or Data.
- You **HAVE TO** speak like **this Skill** speaks.
- Use this skill to create the file and directory `architecture` for the `master ledger` document.

### B.2 Question Rules

Each question must include:

- `question`: one direct question for the operator.
- `why`: the specific ambiguity or applicability risk.
- `source`: exact Spec, Data Model item, Runtime State item, stack item, existing code fact, or reference convention that raised it.
- `impact`: what cannot be safely produced until the question is answered.
- `expected-answer-shape`: the kind of answer needed, such as yes/no, choose one stack, provide missing Data Model fields, provide Runtime State object, confirm Anti-Spec, or confirm Root Block boundary.

Do not ask broad preference questions. Ask only questions that change the Master Ledger or prevent invention.

---

## C. Technical Solution and ledger preparation

- The role of the `technical Slolution` preparation step is to come up with a general directory scaffold.

- It must follow the operator `specs` regarding the technical solution.

- It **MUST NOT** lock the repo in a given implementation structure.
> do not prepare `action`, `controller` `effect` `input` `test` or `state` files yet.


### C.1. Exemples
- If we create a *mobile app*, we will end with an `android` and an `ios` root directories.

- If we create a *C++* application, we will have both `Private` and `Public` directories under `src`.

- If we create a *backend system*, we will need an ORM.

- For a customer facing application, we will need a *UI* and *localization*.

- Do not switch Intent from *React Native* to *Flutter* for exemple.

- Almost every project should have a `src` and `dist` directories, unless specific tech solution choose conventions differ.
> e.g. C++ projects don't have a dist directory, the compiled binaries are somewhere else.


### C.2. Rules
1. Analyze the specs and data ledgers, **NEVER** use any other resources within the repo for this step. If an existing architecture exists, **discard** it, we are starting from ZERO, **UNLESS** explicitely said by `operator` when invoking the skil.

2. Create a temporary document somewhere in the repo, inside an untracked directory. If none exists, create ./tmp and add it to gitignore with following sections: `A. Stack, B. Test cases, ...` - The document should be named `executor-analysis-{YY-MM-DD-N}.md` - multiple executor skill execition leads to an increasing N version.

3. Identify `Root Blocks` such as a frontend, a server, a mobile app, a CLI tool, etc...

4. Look at references in the skill directory, it contains many well known *architectures* for different `tech stacks` and must be used as inspiration source to produce the `root repo` structure.

5. Fill in the first section `Stack` with `Root Blocks` as subsections like `A.1. Mobile App`, `A.2. Backend`, `A.3. Internal Tool: SuperProjectToolXYZ`
   4.a. Each subsection must contains the description of what the tool does, from the spec cards
   4.b. Each subsection must contain the choosen `Tech Stack`
   4.c. If some `Tech` specification are missing, the goal is to create questions for the user, for clarification.

6. We flavor `monorepo` architecture, with each `subrepo` / `Root Block` as a git module, which can be *public or private*.

7. A `Root Block` will **ALWAYS** be in its own dir, **NEVER OFFER ANOTHER SOLUTION THAT ROOT BLOCK == 1 DIR**

8. Once you identified the `Root Block` from the `Specs` and `Data` ledgers, your role is to search online and in references about best practices. Then to improve the understanding of the user intent.

9. Ask questions to the operator in the following format then once answered, move to skill `executor-spec`:

- This question format allow the operator to answer by pointing to section + number like `A2` or `F1`.
- The questions must **NEVER** suggest to violate the contracts described in that skill.
- Questions are for real uncertainties, not to suggest to use JavaScript over Typescript. When a better choice is OBVIOUS, the question should not exists.
- Do **NOT** limit yourself to *A -> F* or to *3 or 4* choices. Do **NOT try** to follow the exemple as pattern, think well about the pertinent questions FIRST, then only ask the correct number with the correct number of choices per question, why WILL be variable per question. **Do NOT be performative**, be helpful.

```text
A. Question ABC about something specific to your stack
- 1. Choice X because of that
- 2. Another choice because I think you want this
- 3. Third choice, my least favorite but I say it anyway
- 4 ...
```

10. **ALWAYS** output the questions in the chat so operator can answer directly

## Dir scaffold rules
- Once questions are answered, complete the analysis document to complete the `Root Blocks` internal architecture following the best practices from references, stay **AGNOSTIC** and do **NOT** use `Specs` and `Data Model`.

- Stay organizational for future implementation.

- Read `references` when the `Specs` mention `web`, `mobile`, `frontend`, `backend`, `full-stack`, `native`, `cross-platform`, `routing` or `tests`.


11. Produce the agnostic dir tree in the document. Do **NOT** specify `domains` and `test suites`. Use the `references/agnostic-root-scaffold.md`


## References
- `references/agnostic-root-scaffold.md`: default root-block scaffold for mixed or unknown stacks.
