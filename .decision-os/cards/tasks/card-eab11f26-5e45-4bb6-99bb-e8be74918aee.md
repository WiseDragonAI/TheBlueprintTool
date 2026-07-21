## A. Scope

1. **Objective:** Prove that one server-state skill is usable by agents in every project managed by one Decision OS server.

---

## B. Requirements

1. **Create:** Create one OpenAI-format skill with three references against a server launch root containing a Skills ledger and two fixture projects.
2. **Update:** Change one reference, add one reference, and remove one reference through `ledger-cli skills update`.
3. **Execution:** Verify agents can select and execute the updated skill directly and in a pipeline from both projects.
4. **Ledger boundary:** Verify one zone, one primary card, one card per current reference, exact file mirrors, and no stale cards.
5. **Commit boundary:** Verify focused create and update commits contain only synchronized package, card, thread, and `.decision-os/skills.json` paths.
6. **Quality gate:** Run focused tests, backend TypeScript checks, and the repository test command from the implementation worktree.
