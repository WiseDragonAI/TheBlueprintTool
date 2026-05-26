# Agnostic Root Scaffold

Use this when the Specs do not imply one homogeneous language/runtime, or when the repo contains very different technologies such as Flutter plus PHP, native mobile plus backend, CLI plus web, or engine plus admin UI.

## Default Shape

```text
repo/
  <root-block>/
    <native-project-shape>

  <root-block>/
    <native-project-shape>

  shared/
    schemas/
    fixtures/
    examples/

  integration/
    tests/
    harnesses/
    test-data/

  operations/
    scripts/
    migrations/
    runbooks/

  docs/
    architecture/
    decisions/
```

## Rule

The repo root is the full system. Top-level project directories are Root Blocks when they own their own runtime, package metadata, source, tests, native framework shape, deployment target, or operator-defined ownership.

Each Root Block keeps its native ecosystem conventions. Do not force unrelated stacks into `apps/`, `packages/`, shared config, or shared UI.

## Reserved Support Directories

- `shared`: cross-root truth only, such as schemas, protocol examples, fixtures, generated clients, and shared model definitions when explicitly shared.
- `integration`: tests and harnesses that exercise more than one Root Block.
- `operations`: scripts, deployment, migrations, runbooks, and non-runtime orchestration.
- `docs`: architecture notes, decisions, specs, reports, and operator-facing documentation.

## Questions To Ask YOURSELF

- Is each top-level Root Block independently meaningful, or is it only an internal folder of another Root Block?
- Which schemas or artifacts are actually shared across Root Blocks?
- Which tests prove cross-root behavior?
- Which operations are runtime code, and which are deployment/support orchestration?
- Does any proposed shared directory hide stack-specific config that belongs inside a Root Block?



---

Typical *frontend* root block:

(frontend || client || web)/

   src/
      test/ - All tests for the root block

      data/ - All statuc data like localization

      route/ - Flat list of router per domain
         {domain}.ext - Each domain has a router

      ui/
         component/ - Contains HTML or equivalent building blocks
            lib/ - shared components accross domains
            {screen}/ - Each screen has some specific components

         style/ - Contains CSS stylesheets or equivalent
            lib/ - shared styling
            {screen} - Each screen can have specific styling

      state/
         root.state.ext - Root State combining all the core states
         {runtime}.state.ext - State which composes the root state

      business/
         {domain}/
            action/
            controller/
            helper/
            effect/

      lib/ - shared code accross domains, can be http, auth, etc...

---

Typical *backend* root block:

(server || backend)/
    src/
      route/
        {domain}.route.ext

      business/
        {domain}/
          action/
          controller/
          helper/
          effect/

      lib/
        database/
        http/
        auth/
        telemetry/
        config/

    test/
      {domain}/
         {suites}/

---