## A. Delivery Decision

1. **Safe in-app authoring** `requires` a dedicated `dev` branch, isolated worktree, canary on `50151`, and separate Wrangler relay state before implementation.
2. **Production `main`, federation, and port `50150`** `remain` unchanged until the canary boundary and complete served interaction are proven.
3. The corpus `defines` the target contract; it does not `establish` implementation, verification, or promotion readiness.

---

## B. Authoring Boundary

1. The existing **Skills interface** `must create`, `edit`, `save`, and `inspect` `federated-skill`, `workspace-skill`, and `pipeline-prompt` content through an explicitly selected kind.
2. A locally bundled **CodeMirror 6 modal** at `80vw` by `95vh` `owns` Markdown editing, history, search, keyboard commands, dirty state, accessible focus, and tools; loading, Git persistence, federation, and pipeline injection `remain` outside the editor adapter.
3. **Pipeline prompts** `remain` outside `.skills` directories and every agent, workspace, workstation, cloud-agent, and federation discovery path; a pipeline step `injects` one only by explicit selection.
4. **Skill identity** `comes` from the `SKILL.md` frontmatter `name`; federated skills `synchronize` from the server root, while workspace skills `remain` confined to the active workspace.

---

## C. Revision Integrity

1. Every successful **content save** `must create` one scoped Git commit containing only the authored file and, for a pipeline prompt, its required metadata file.
2. Project-scoped APIs `must expose` the current file and complete commit history; previous and next controls `must render` each selected revision against its successor through `@pierre/diffs` `1.2.12`.
3. **Revision diffs** `must show` removals in red and additions in blue while preserving signs, line numbers, and accessible labels.
4. A failed save or commit `must not report` a new revision; the authored file and Git evidence `must remain` available for explicit recovery.

---

## D. Promotion Gate

1. **Promotion** `remains` an operator decision after canary proof, not an implementation-side action.
2. The **evidence package** `must document` the authoring, revision, Git, conflict, injection, federation, canary deployment, rollback, and cleanup contracts.
3. The canary `must prove` content-kind isolation, discovery exclusion, explicit prompt injection, path containment, revision conflicts, scoped Git history, commit-failure recovery, accessible Pierre rendering, export invalidation, federation behavior, and separation from production.
4. The operator `must review` the served canary evidence on `50151` and `authorize` promotion only after every gate passes.
---

Codex run completed: exit code 0
