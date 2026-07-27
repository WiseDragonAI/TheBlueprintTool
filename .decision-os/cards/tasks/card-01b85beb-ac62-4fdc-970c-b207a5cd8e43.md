## A. Scope

Define three explicit content kinds. `federated-skill` uses the server skill root and agent discovery plus federation. `workspace-skill` uses the active workspace skill root and workspace agent discovery without federation. `pipeline-prompt` uses pipeline-owned storage, is invisible to every natural agent skill scan, and is injected only by an explicitly configured pipeline step.

---

## B. Acceptance

1. Agent-visible skill identity remains `SKILL.md` frontmatter `name`.
2. Pipeline prompts have a stable pipeline-library identity and never create `.skills/<name>/SKILL.md`.
3. APIs return the content kind and allowed execution boundary.
4. Duplicate names, unsafe paths, and invalid kind transitions are rejected deterministically.
5. Tests prove pipeline prompts are absent from workstation, workspace, cloud-agent, and federation discovery while remaining selectable and injectable in pipelines.
