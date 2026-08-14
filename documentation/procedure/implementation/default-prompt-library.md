## A. Purpose And Canonical Owners

1. This runbook creates, updates, verifies, and recovers the default developer prompts required to operate Decision OS.
2. The server-owned Decision OS root owns prompt identity and metadata in `codex-pipelines.json` and exact UTF-8 Markdown in `pipeline-prompts/<PROMPT_NAME>.md`. Project-owned `.decision-os` roots are not prompt owners.
3. Create prompts through `ledger-cli prompt create`. Update an existing prompt by editing its registered server-owned Markdown directly, then run `ledger-cli prompt update` to validate and commit the working copy. Never edit `.decision-os/codex-pipelines.json` directly.
4. Decision OS packages the required source files under `backend/defaults/pipeline-prompts/` and installs any missing defaults into the server-owned root during pipeline-catalog initialization.
5. The required defaults are:
   1. `SYSTEM_PROMPT` — common Decision OS developer instructions.
   2. `SKILL` — the wrapper for a normal pipeline skill.
   3. `CODEX_RUN` — the wrapper for a direct card and thread Codex run.
   4. `CLI_TOOLS` — the Decision OS command contract available to pipeline prompts.
6. Assign the `System` tag to all four defaults so the library exposes them as required operating prompts.

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

3. A direct card and thread Codex run, including a fresh-session recovery, admits and compiles this root:

   ```text
   {{CODEX_RUN}}
   ```

4. `CODEX_RUN` may reference `{{SYSTEM_PROMPT}}` explicitly when shared policy is required. Root order is byte-significant. The compiled result is the exact `developer_instructions` value passed to Codex.
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
   3. `<SUB_TASKS>`
   4. `<FULL_THREAD>`
   5. `<PENDING_NOTES>`
   6. `<FILE_MAP>`
   7. `<PREVIOUS_SKILL_RESULT>`
   8. `<EXECUTION_CONTEXT>`
4. Direct card-run identity:
   1. `<PROJECT_ID>`
   2. `<CARD_ID>`
   3. `<THREAD_ID>`
   4. `<RUN_SKILL_POLICY>` — optional direct-run skill restriction; empty for an unrestricted run.
   5. `<PROTECTED_GIT_PATCH>` — optional staged-patch protection section; empty when the Git index contains no protected patch.
5. A runtime provider that does not apply to the active execution boundary returns an empty string. Prompt authors must use the variables owned by their graph.

---

## E. Startup Installation

1. Server startup validates the packaged Markdown for `SYSTEM_PROMPT`, `SKILL`, `CODEX_RUN`, and `CLI_TOOLS` before changing durable state.
2. Pipeline-catalog initialization validates every existing server-owned file and registration, recursively compiles the mandatory graphs, and creates only missing files, registrations, and metadata.
3. Existing valid Markdown, registration timestamps, descriptions, favorites, tags, and execution defaults remain unchanged.
4. Missing defaults are installed and committed in the server-owned Decision OS Git repository with the subject `Install mandatory pipeline prompts` and non-empty `WHAT:` and `WHY:` paragraphs.
5. Project-owned `.decision-os/pipeline-prompts/` directories must not contain copies of the mandatory defaults.

---

## F. Update An Existing Default

1. Select the registered server-owned prompt Markdown:

   ```sh
   prompt_name='CODEX_RUN'
   prompt_file="$HOME/.decision-os/pipeline-prompts/${prompt_name}.md"
   test -f "$prompt_file"
   ```

2. Edit `prompt_file` directly with the available file-editing tool. Do not create a temporary replacement Markdown document.
3. Validate and commit the exact edited working copy:

   ```sh
   ledger-cli prompt update \
     --project "$DECISION_OS_PROJECT_ID" \
     --name "$prompt_name"
   ```

4. The command loads the edited working-copy revision and submits it to the project-scoped commit route without transmitting replacement Markdown.
5. The transaction validates registered identity, prompt Markdown, template syntax, exact loaded revision, staged-path protection, focused commit ownership, and committed Git evidence.
6. A clean working copy returns `content_not_changed` and creates no commit.
7. Every authored commit has a concise subject plus non-empty `WHAT:` and `WHY:` paragraphs.

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

1. Confirm the four registered identities in the server-owned store:

   ```sh
   server_decision_os_root="$HOME/.decision-os"
   jq -r '.authoredContent[] | select(.id == "SYSTEM_PROMPT" or .id == "SKILL" or .id == "CODEX_RUN" or .id == "CLI_TOOLS") | [.id,.kind,.contentFile] | @tsv' "${server_decision_os_root}/codex-pipelines.json"
   ```

2. Confirm the authored commit message:

   ```sh
   git -C "$server_decision_os_root" show -s --format=%B HEAD
   ```

3. Confirm the four packaged defaults remain outside every project-owned `.decision-os` root:

   ```sh
   ls backend/defaults/pipeline-prompts/{SYSTEM_PROMPT,SKILL,CODEX_RUN,CLI_TOOLS}.md
   ```

4. Run focused startup, compiler, direct-run, and authored-transaction tests through the repository lease:

   ```sh
   node bin/decision-os-verify.mjs -- node --test --import ./backend/node_modules/tsx/dist/esm/index.mjs backend/test/codex/mandatory-pipeline-prompts.test.ts backend/test/codex/pipeline-prompt-library.test.ts backend/test/codex/build-thread-codex-prompt.test.ts backend/test/codex/start-card-skill-process-controller.test.ts backend/test/content-authoring/authored-file-git-revisions.test.ts
   ```

5. Run the backend typecheck once after code stabilizes:

   ```sh
   node bin/decision-os-verify.mjs -- npm run typecheck --prefix backend
   ```

---

## I. Recovery And Escalation

1. Do not rewrite malformed prompt Markdown, an invalid registration store, staged owner paths, dirty registration bytes, or recovery-pending bytes.
2. Startup preserves the exact files, records a `pipeline-catalog` incident, and keeps unrelated server routes online.
3. Retry an accepted authored mutation through `POST /api/codex/skill-library/:name/revisions/retry` with its returned `recoveryToken` and `contentRevision`.
4. Resume execution only after re-reading and validating the prompt graph and its committed store evidence.
5. A failed recovery keeps the owning prompt scope unavailable while unrelated routes, projects, and executions remain online.
