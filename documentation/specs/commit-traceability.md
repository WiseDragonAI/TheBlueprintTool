# Commit Traceability

## A. Required Commit Shape

1. Every agent-authored Git commit, including a merge commit, has a concise subject and a non-empty body.
2. The body contains a `WHAT:` paragraph that identifies the changed behavior, documentation, data contract, or operational boundary.
3. The body contains a `WHY:` paragraph that records the incident, invariant, operator decision, or verified need that required the change.
4. `WHAT:` describes the committed result, not the commands used to produce it.
5. `WHY:` preserves enough causal context for a later operator to reconstruct the decision without relying on chat history.

---

## B. Boundaries

1. Commit messages do not contain credentials, secret values, private card bodies, or unredacted production payloads.
2. A body does not replace focused commits. Unrelated changes remain separate even when one explanation could mention both.
3. An issue ID, card ID, or incident name may supplement `WHY:`; it does not replace the causal explanation.
4. Generated merge subjects are accepted only when the merge commit body still contains `WHAT:` and `WHY:`.

---

## C. Verification

1. Inspect the completed message with:

   ```bash
   git show -s --format=%B HEAD
   ```

2. Require one subject line, a non-empty `WHAT:` paragraph, and a non-empty `WHY:` paragraph before pushing.
3. The repository policy owner is `AGENTS.md`.
4. The runtime enforcement prompt owner is `backend/src/business/codex/helper/resolve-codex-command.ts`.
5. `backend/test/codex/resolve-codex-command.test.ts` proves that new headless Codex processes receive the same contract.

---

## D. Example

```text
fix: bound task mutation causal context

WHAT: Limit mutation and register contexts to the entity paths and fields changed by the mutation.

WHY: A project-wide migration clock made one durable journal replay exceed the 64 KiB entity limit and crash startup.
```
