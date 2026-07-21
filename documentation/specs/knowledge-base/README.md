# Knowledge-Base Contract

## A. Required Structure

1. The canonical KB root is `documentation/README.md`.
2. Canonical material is organized by role, then domain, then topic.
3. Current behavior, intended behavior, procedure, root cause, working analysis, and archive material remain distinct.

---

## B. Ownership Invariants

1. Every durable fact has one primary canonical page.
2. Secondary pages link to the primary page instead of duplicating the body.
3. A topic is represented by one Markdown file or one directory containing `README.md`.
4. The tree must not contain a same-name topic file and topic directory at the same level.
5. Runtime ledger data remains under `.decision-os/`; the KB describes it without becoming a second runtime source of truth.

---

## C. Evidence Invariants

1. Current-state claims carry an exact repository, runtime, test, ledger, or operator source.
2. Missing evidence is recorded as missing and is not converted into a conclusion.
3. Contradictions remain visible until stronger evidence resolves them.
4. Historical files are archived only after their durable content has a canonical owner.

---

## D. Acceptance Criteria

1. Role and domain indexes resolve to existing pages.
2. Relative Markdown links resolve.
3. No canonical page depends on a temporary extraction register for its meaning.
4. No API key, voice upload, runtime session, or local secret is committed to the KB.
5. The root index gives an operator and a developer a direct path to the relevant canonical page.
