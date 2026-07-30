## A. Purpose And Canonical Owners

1. This runbook creates, updates, verifies, and recovers the default developer prompts required to operate Decision OS.
2. The server-owned Decision OS root owns prompt identity and metadata in `codex-pipelines.json` and exact UTF-8 Markdown in `pipeline-prompts/<PROMPT_NAME>.md`. Project-owned `.decision-os` roots are not prompt owners.
3. Use the existing authored-content API for every create and update. Never edit `.decision-os/codex-pipelines.json` directly.
4. The required defaults are:
   1. `SYSTEM_PROMPT` — common Decision OS developer instructions.
   2. `SKILL` — the wrapper for a normal pipeline skill.
   3. `CODEX_RUN` — the wrapper for a direct card and thread Codex run.
5. Assign the `System` tag to all three defaults so the library exposes them as required operating prompts.

---

## B. Default Prompt Graphs

1. A normal skill admits and compiles these roots:

   ```text
   {{SYSTEM_PROMPT}}

   {{SKILL}}
   ```

2. An authored pipeline prompt such as `GateTest` admits and compiles these roots:

   ```text
   {{SYSTEM_PROMPT}}

   {{GateTest}}
   ```

3. A direct card and thread Codex run, including a fresh-session recovery, admits and compiles these roots:

   ```text
   {{SYSTEM_PROMPT}}

   {{CODEX_RUN}}
   ```

4. Root order is byte-significant. The compiled result is the exact `developer_instructions` value passed to Codex.
5. A pipeline stage receives the fixed user turn `Execute this admitted Decision OS pipeline stage.` A direct card run retains its card, thread, and execution context in the separately recorded user prompt.

---

## C. Template Syntax And Evaluation

1. `{{PROMPT_NAME}}` is a recursive reference to another registered pipeline prompt. Names contain 1–64 letters, numbers, underscores, and hyphens; the first and last characters are alphanumeric.
2. References expand during immutable run admission. Missing references and dependency cycles reject admission.
3. `<RUNTIME_NAME>` is a runtime value. Its strict grammar is `<[A-Z][A-Z0-9_]*>`.
4. Runtime tokens render once immediately before process launch. An injected value is never scanned again.
5. Lowercase angle text such as `<result-specific-title>` remains literal.
6. An unknown uppercase runtime token rejects execution before process launch.
7. The compiler discovers referenced runtime tokens before evaluating providers. Expensive values are gathered only when their tokens occur in the compiled developer snapshot.
8. `FILE_MAP`, conversation hydration, protected Git patch capture, and optional context construction follow this lazy provider boundary.

---

## D. Runtime Variable Catalog

1. Shared environment:
   1. `<PLATFORM>` — authoritative runtime platform.
   2. `<LEDGER_FILE>` — absolute active ledger path.
2. Pipeline identity:
   1. `<SKILL_NAME>`
   2. `<PIPELINE_RUN_ID>`
   3. `<PIPELINE_NAME>`
   4. `<SOURCE_CARD_ID>`
   5. `<SOURCE_CARD_TITLE>`
   6. `<STEP_ID>`
   7. `<STEP_TITLE>`
   8. `<STEP_INPUT_CARD_ID>`
   9. `<STEP_INPUT_CARD_CONTENT>`
   10. `<OUTPUT_PARENT_CARD_ID>`
   11. `<OUTPUT_CARD_ID>`
   12. `<OUTPUT_SUBTASK_POSITION>`
   13. `<OUTPUT_MARKDOWN_FILE>`
   14. `<SERVER_SKILL_CONTEXT>` — exact optional server-package instructions; empty for workspace-discovered skills.
3. Authored prompt context:
   1. `<MASTER_TASK>`
   2. `<SUB_CONTEXT>`
   3. `<FULL_THREAD>`
   4. `<FILE_MAP>`
   5. `<PREVIOUS_SKILL_RESULT>`
   6. `<EXECUTION_CONTEXT>`
4. Direct card-run identity:
   1. `<PROJECT_ID>`
   2. `<CARD_ID>`
   3. `<THREAD_ID>`
   4. `<RUN_SKILL_POLICY>` — optional direct-run skill restriction; empty for an unrestricted run.
   5. `<PROTECTED_GIT_PATCH>` — optional staged-patch protection section; empty when the Git index contains no protected patch.
5. A runtime provider that does not apply to the active execution boundary returns an empty string. Prompt authors must use the variables owned by their graph.

---

## E. Create The Default Prompts

1. Select the server-owned authoring endpoint and canonical source files:

   ```sh
   api_root='http://127.0.0.1:50150/api/codex/skill-library'
   prompt_root='.decision-os/pipeline-prompts'
   ```

2. Create each default in this order: `SYSTEM_PROMPT`, `SKILL`, `CODEX_RUN`.
3. Submit each source file through the authored-content transaction:

   ```sh
   prompt_name='SYSTEM_PROMPT'
   prompt_description='Common Decision OS developer instructions.'
   jq -n \
     --arg name "$prompt_name" \
     --arg description "$prompt_description" \
     --rawfile markdown "${prompt_root}/${prompt_name}.md" \
     '{name:$name,description:$description,contentKind:"pipeline-prompt",markdown:$markdown}' |
     curl -fsS -X POST \
       -H 'content-type: application/json' \
       --data-binary @- \
       "$api_root"
   ```

4. Assign the required system tag after each successful create:

   ```sh
   curl -fsS -X PUT \
     -H 'content-type: application/json' \
     --data-binary '{"tags":["System"]}' \
     "${api_root}/${prompt_name}"
   ```

5. Repeat both commands with the exact descriptions:
   1. `SKILL` — `Decision OS developer wrapper for pipeline skill execution.`
   2. `CODEX_RUN` — `Decision OS developer instructions for direct card and thread Codex runs.`
6. HTTP `201` is complete only when the create response contains the prompt detail and its focused `gitRevision`; the metadata response must return `tags: ["System"]`.

---

## F. Update An Existing Default

1. Read current content and its optimistic revision:

   ```sh
   prompt_name='CODEX_RUN'
   curl -fsS "${api_root}/${prompt_name}" >"/tmp/${prompt_name}.json"
   jq -r '.skill.revision' "/tmp/${prompt_name}.json"
   ```

2. Submit the complete replacement Markdown with the loaded revision:

   ```sh
   prompt_revision="$(jq -r '.skill.revision' "/tmp/${prompt_name}.json")"
   jq -n \
     --arg revision "$prompt_revision" \
     --rawfile markdown "${prompt_root}/${prompt_name}.md" \
     '{markdown:$markdown,revision:$revision,defaultCodexModel:null,defaultCodexEffort:null}' |
     curl -fsS -X PUT \
       -H 'content-type: application/json' \
       --data-binary @- \
       "${api_root}/${prompt_name}"
   ```

3. The transaction validates identity, template syntax, contained ownership, exact loaded revision, staged-path protection, and committed Git evidence.
4. Every authored commit has a concise subject plus non-empty `WHAT:` and `WHY:` paragraphs.

---

## G. Immutable Admission And Execution Evidence

1. Admission recursively includes every prompt dependency and requires the prompt Markdown plus registration store to be regular, contained, tracked, clean, committed, and present in repository `HEAD`.
2. New pipeline executions persist:

   ```json
   {
     "syntaxVersion": 2,
     "developerPromptSnapshot": "<compiled exact bytes>",
     "developerPromptRevision": "<sha256>",
     "developerPromptCommit": "<owning commit>"
   }
   ```

3. Remote installation transports and validates this same envelope. Execution never rereads editable prompt files.
4. Existing persisted runs without `syntaxVersion` remain version 1 and retain the legacy `{{runtime}}` renderer. New admissions accept version 2 syntax exclusively.
5. Initial direct launch and fresh-session recovery record `decision_os.developer_prompt` and `decision_os.user_prompt` separately. A continuation that retains its existing Codex session sends only the new user prompt.

---

## H. Verification

1. Confirm the three registered identities in the server-owned store:

   ```sh
   server_decision_os_root='/home/jbb/.decision-os'
   jq -r '.authoredContent[] | select(.id == "SYSTEM_PROMPT" or .id == "SKILL" or .id == "CODEX_RUN") | [.id,.kind,.contentFile] | @tsv' "${server_decision_os_root}/codex-pipelines.json"
   ```

2. Confirm the authored commit message:

   ```sh
   git -C "$server_decision_os_root" show -s --format=%B HEAD
   ```

3. Run focused compiler, direct-run, and authored-transaction tests through the repository lease:

   ```sh
   node bin/decision-os-verify.mjs -- node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/codex/pipeline-prompt-library.test.ts backend/test/codex/build-thread-codex-prompt.test.ts backend/test/codex/start-card-skill-process-controller.test.ts backend/test/content-authoring/authored-file-git-revisions.test.ts
   ```

4. Run the backend typecheck once after code stabilizes:

   ```sh
   node bin/decision-os-verify.mjs -- npm run typecheck --prefix backend
   ```

---

## I. Recovery And Escalation

1. Do not rewrite malformed prompt Markdown, an invalid registration store, staged owner paths, or recovery-pending bytes.
2. Preserve the exact files and use the stable admission error to identify the rejected boundary.
3. Retry an accepted authored mutation through `POST /api/codex/skill-library/:name/revisions/retry` with its returned `recoveryToken` and `contentRevision`.
4. Resume execution only after re-reading and validating the prompt graph and its committed store evidence.
5. A failed recovery keeps the owning prompt scope unavailable while unrelated routes, projects, and executions remain online.
