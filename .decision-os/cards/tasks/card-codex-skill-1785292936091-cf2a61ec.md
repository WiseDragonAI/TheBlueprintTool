## A. Goal / Spec Link

1. **Goal need:** Build mutual clarity in an important relationship. The source goal supplies no defined relationship type, participant roles, decision scope, or clarity outcome beyond the title.
2. **Affected product area:** Card-owned operator questionnaires rendered from card Markdown, with supporting card threads and durable ledger persistence.
3. **Affected workflow:** A user opens an owning card, reviews a question set, selects one of four choices, enters a custom answer, records a voice answer, postpones a question, and the state is persisted through the card mutation boundary.
4. **Affected actor or role:** The code explicitly distinguishes `operator` interaction from `LLM → operator` question provenance. A second relationship participant and a shared-answer workflow are **unknown**.
5. **Relevant context fact:** Questionnaire state is scoped by `contextRevision`; the backend rejects carrying prior answers or voice notes into a changed context revision.
6. **Current behavior:** `::questions[...]` Markdown resolves a safe questionnaire identifier. The card renderer shows one active question, four choices, custom text, voice capture, progress, queue navigation, and `ANSWER LATER`; thread rendering only tells the user to open the owning card.
7. **Expected behavior:** The product must make the relevant relationship context and each participant's understanding explicit, preserve attributable answers, and expose a verified shared-clarity result. The repository does not define how mutual agreement is represented.
8. **Acceptance signal:** **Missing.** No code-backed signal proves that two participants reached the same understanding, acknowledged differences, or completed a relationship-specific clarity outcome.

---

## B. Linked Specs

1. `questionnaire-types.ts` — `CardQuestionnaire` and response contract — source: `shared/schemas/questionnaire-types.ts` — **support** — provides versioned questions, responses, current question, and voice-note fields for a durable clarification flow.
2. `parse-ledger-card-markdown.ts` — `::questions[...]` card block parsing — source: `frontend/src/runtime/ledger/helper/parse-ledger-card-markdown.ts` — **support** — provides the authored entry point for rendering a questionnaire by identifier.
3. `card-questionnaire-state.ts` — questionnaire normalization — source: `frontend/src/runtime/ledger/helper/card-questionnaire-state.ts` — **constrain** — only version `1`, safe identifiers, exactly four choices, valid response statuses, and valid voice metadata reach the renderer.
4. `render-ledger-card-questions.ts` — native operator questionnaire widget — source: `frontend/src/runtime/ledger/component/render-ledger-card-questions.ts` — **support** — implements choice, custom-answer, voice-answer, progress, queue, and deferred-answer interactions.
5. `apply-ledger-mutation.ts` — card questionnaire persistence validation — source: `backend/src/business/ledger/helper/apply-ledger-mutation.ts` — **constrain** — validates questionnaire mutations and blocks answers or voice notes carried across a changed context revision.
6. `card-questionnaires.test.ts` — persistence and context-revision tests — source: `backend/test/unit/ledger/helper/card-questionnaires.test.ts` — **support** — verifies valid persistence, question-owned voice metadata, four-choice validation, and context-bound answer rejection.
7. No inspected source defines a relationship participant model, bilateral consent, shared state, comparison state, or mutual-clarity completion status — **non-goal in current code evidence** — relationship-specific product behavior remains outside the implemented contract.

---

## C. Missing Specs

1. **Implied requirement:** Define the relationship context, participants, and the exact clarity decision being supported. **Missing acceptance signal:** a concrete shared outcome. **Missing UX spec:** how both participants enter, review, and acknowledge answers.
2. **Implied requirement:** Distinguish private answers from mutually visible answers. **Missing technical spec:** authorization and visibility rules. **Missing data spec:** participant identity, answer ownership, sharing status, and agreement state.
3. **Implied requirement:** Compare participant answers and surface alignment or unresolved differences. **Missing acceptance signal:** a deterministic comparison result. **Missing UX spec:** presentation and acknowledgement of agreement, disagreement, and unanswered items.
4. **Implied requirement:** Preserve the relationship context while questions evolve. **Missing technical spec:** context revision ownership and migration rules for participant responses. Existing code only defines a single card questionnaire revision boundary.
5. **Implied requirement:** Support completion and recovery across persistence failures. **Missing operational spec:** failure, retry, audit, and recovery behavior for bilateral state. Existing code only exposes card mutation rollback and a local failure notice.
6. **Implied requirement:** Determine whether voice answers are private, shared, transcribed, editable, and attributable. **Missing data and UX specs:** consent, visibility, transcript correction, and retention behavior.

---

## D. Spec Gaps

1. **Product-boundary decision:** The code supports an operator questionnaire, not a mutual relationship workflow. The boundary between card-owned clarification and a participant-facing relationship product is **unverified**.
2. **Unknown:** The source goal does not identify the relationship domain, participants, authority to answer, or whether the desired result is agreement, understanding, decision-making, or communication planning.
3. **Source gap:** No inspected implementation source contains `mutual`, participant, consent, agreement, or relationship-specific questionnaire semantics.
4. **Data constraint:** `CardQuestionnaire.responses` is keyed only by question ID, so the current contract has no participant dimension. `CardQuestionVoiceNote` likewise has no owner or visibility field.
5. **Technical constraint:** The current renderer persists the whole questionnaire through `patch-card`; it does not expose a separate shared-session or participant-scoped persistence boundary.
6. **UX constraint:** A thread surface is explicitly read-only for questionnaires and directs the user to the owning card; no bilateral review or acknowledgement interaction is defined.
7. **Unverified fact:** The repository does not establish whether the existing four-choice questionnaire is intended to serve this relationship goal. No recommendation or implementation path is supported by the available code evidence.
---

Codex run completed: exit code 0
