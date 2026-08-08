## A. Purpose

1. Implementation procedures define how a multi-gate Decision OS architecture iteration is developed, verified, reported, and handed to production cutover.

---

## B. Procedures

1. [Epoch-4 task assignment and replicated execution iteration](./epoch-4-task-execution-iteration.md) defines branch isolation, progress publication, gate evidence, verification leases, merge admission, and production handoff.
2. [Default prompt library](./default-prompt-library.md) defines creation, update, syntax, runtime variables, immutable admission, verification, and recovery for `SYSTEM_PROMPT`, `SKILL`, and `CODEX_RUN`.
3. [Integrate a feature into dev](./integrate-feature-into-dev.md) defines child publication, local merge, executable Gitlink admission, exact-SHA push, and cleanup.
