## A. Verified Result

1. **Catalog boundary:** Server definitions persist in `<server-root>/.decision-os/codex-pipelines.json` and are returned with `scope: server`.
2. **Precedence:** A same-ID project pipeline cannot shadow the server definition.
3. **Execution:** Focused integration coverage executes one migrated server definition from two requesting projects while retaining each run in its requesting project.
4. **Migration:** The one-time bootstrap moves legacy reusable definitions into the server catalog and leaves future project definitions local.
