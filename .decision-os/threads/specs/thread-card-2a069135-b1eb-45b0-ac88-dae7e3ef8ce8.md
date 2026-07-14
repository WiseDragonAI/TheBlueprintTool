# OPERATOR
<!-- decision-os:note {"id":"note-1784017397365-73470a56f65c58","timestamp":"2026-07-14T08:23:17.570Z"} -->

![Screenshot_20260714_152256_Brave.jpg](/.decision-os/thread-files/thread-card-2a069135-b1eb-45b0-ac88-dae7e3ef8ce8/file-1784017397540-581380628a2ac-Screenshot_20260714_152256_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784017489316-11019cb4fd5c48","timestamp":"2026-07-14T08:24:49.788Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784017489748-42879793-56eb-44f4-80b3-b6c7839b7038.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T08:24:49.794Z"} -->

J'ai l'impression que le agent.de de décision OS ou peut-être de Home fait trop de travail, il essaie de faire trop de travail dans comment formater les cartes pour l'opérateur en donnant des exemples de sections. Le résultat, c'est qu'on n'a que des cartes MasterCard qui sont mauvaises, puisqu'en fait, l'agent, il essaye de respecter le format, alors qu'en fait, ce qu'on voudrait, c'est ne pas donner de format. On devrait donner les règles de formatage de texte, ça oui, et on devrait donner globalement de quoi un opérateur a besoin pour pouvoir prendre une décision. Mais ça ne doit pas être cette section, ça doit être comme ça, cette section, ça doit être comme ça, cette section, ça doit être comme ça. Parce que si on fait ça, on se retrouve avec un format bloqué alors que le principe de décision OS, c'est de travailler sur plusieurs projets différents, donc il faut être versatile et fluide et flexible. Et donc, du coup, aujourd'hui, les instructions, elles ne sont pas comme ça, elles donnent trop d'informations. Et ce qu'on veut, c'est réduire drastiquement le nombre de mots et d'informations qu'il y a pour formater les cartes. Donc ce que tu vas faire déjà, c'est que tu vas m'expliquer d'où provient le problème et comment tu vas y remédier.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784017641742-7132e003","timestamp":"2026-07-14T08:27:21.743Z"} -->

## A. Where the problem comes from

1. **The home instructions are not responsible.** `../AGENTS.md` contains no card-formatting contract.
2. **The repository instructions create the schema pressure.** `AGENTS.md` line `55` puts `Scope`, `Contract`, and `Acceptance Criteria` directly inside a mandatory formatting rule. A model reads repeated concrete headings as the expected card structure, even when they were intended only to demonstrate syntax.
3. **A Decision OS skill duplicates and expands it.** `.skills/decision-os-treat-open-notes/SKILL.md` lines `76-85` restate eight formatting rules and add `Server Contract` and `Client Contract` examples.
4. **The runtime reinforces it on every card run.** `backend/src/business/codex/helper/build-thread-codex-prompt.ts` line `25` repeats the Markdown recipe. More importantly, `ledger-cli/src/business/ledger/helper/resolve-session-context.ts` lines `101-103` explicitly parse a section named `Acceptance Criteria`, turning one example into an implicit machine contract.
5. **The effect is visible in the data.** `138` of the current `550` card files contain an exact `Scope`, `Contract`, or `Acceptance Criteria` heading. The supplied screenshot shows the same failure mode: a previous answer tried to solve the issue by proposing a different fixed three-section schema.

---

## B. How I will remedy it

1. **Replace the content checklist with one outcome rule:** a card contains only the verified information needed for the current operator decision and omits irrelevant categories.
2. **Keep presentation syntax only:** lettered `H2` headings, dividers, numbered lists, bold labels, and backticks remain. No section names will appear as defaults or examples.
3. **Remove duplicated policy:** the note-treatment skill and the per-run prompt will defer to the single repository rule instead of restating a template.
4. **Remove the hidden schema dependency:** delete the unused parser and output field tied to the literal `Acceptance Criteria` heading. Repository search found no consumer of that field.
5. **Add regression coverage:** prompt and gate tests will use task-specific headings and prove that no named section is required.

The important correction is deletion, not an added sentence saying the examples are optional. Leaving named examples in place would continue anchoring generated cards. I recorded this diagnosis in the renamed master card and created the pending implementation subtask `card:card-dfa1eb1a-a139-4d85-b34e-aae811b5e1dd`. No implementation files have been changed yet; the task remains active for your direction.

# OPERATOR
<!-- decision-os:note {"id":"note-1784018068184-924023a38ebd48","timestamp":"2026-07-14T08:34:28.713Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784018068678-59b7c3db-7f3c-49f6-aa8a-b97d22d10d09.wav","status":"transcribed","transcriptionStartedAt":"2026-07-14T08:34:28.719Z"} -->

OK, je te laisse exécuter ton plan.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784018430950-4399add0","timestamp":"2026-07-14T08:40:30.951Z"} -->

Implemented and merged into `main`.

1. **Card policy:** `AGENTS.md` now contains one compact content rule—include only verified information needed for the next operator decision—and requires task-specific section titles with no default schema.
2. **Instruction reduction:** `.skills/decision-os-treat-open-notes/SKILL.md` replaces eight formatting rules with one reference to the workspace policy. The per-run Codex prompt also references that policy instead of repeating the Markdown recipe.
3. **Hidden schema removed:** `master-task-gate` no longer parses or emits the unused field tied to a literal `Acceptance Criteria` section.
4. **Regression coverage:** the prompt test confirms named default headings are absent; the gate accepts `Current Finding`; the planner accepts `Implementation Detail`.
5. **Verification:** the prompt test passed, and all three affected ledger cases passed across the focused run and failed-case rerun. The initial ledger failure was a verified test-isolation defect (`DECISION_OS_LEDGER_ROOT` inherited from the live session); the fixture now scopes and restores its own environment.
6. **Git state:** implementation commit `b8ef4e2` was merged by `e5cce83`. The isolated worktree and feature branch were removed. The server was not restarted.
7. **Ledger state:** subtask `card:card-dfa1eb1a-a139-4d85-b34e-aae811b5e1dd` is `done`; its master projection is `complete`; `master-task-gate` reports `ready: true` with no discrepancies.

The master task remains active because completing a master requires separate operator authorization.
