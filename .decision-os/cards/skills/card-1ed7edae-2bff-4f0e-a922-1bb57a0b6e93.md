## A. Goal

1. **Skill purpose:** Create a Codex skill that turns an analysis card into a complete screen-content plan for future mockups.
2. **Primary outcome:** The skill must determine which screens are needed, what each screen must contain, and what source data is still missing before visual mockup creation begins.
3. **Workflow position:** This is the first skill in a two-skill workflow. It prepares screen definitions only; the visual mockup creation skill is out of scope and will be specified later.

---

## B. Input Contract

1. **Required source:** The skill starts from one analysis card or equivalent card content that describes the requested product change, stack context, implementation plan, current UX context, and relevant constraints.
2. **Stack alignment:** The skill must extract or request the active tech stack, UI framework, component system, routing model, data-loading pattern, and any design constraints that affect screen content.
3. **Existing product alignment:** The skill must account for existing screens, existing features, current user flows, reusable UI patterns, and already-defined product behavior.
4. **Plan alignment:** The skill must use the provided implementation or product plan to understand which workflows, states, roles, and edge cases need screen coverage.

---

## C. Clarification Rules

1. **Screen count check:** The skill must infer the number of screens when the analysis content is sufficient, and must ask focused questions when the number of screens cannot be determined confidently.
2. **Missing data check:** The skill must identify missing information that would change screen content, including user roles, feature boundaries, route names, data entities, states, permissions, and existing UI references.
3. **Question discipline:** The skill should ask only questions that block accurate screen definition. It should not ask for visual style details reserved for the later mockup creation skill.
4. **Assumption handling:** When a decision is low-risk and implied by the analysis card, the skill may state the assumption and continue instead of blocking.

---

## D. Screen Definition Output

1. **Screen inventory:** The skill must output the final list of screens, including each screen name, purpose, route or surface when known, primary actor, and workflow position.
2. **Per-screen content:** For every screen, the skill must define the required sections, components, data fields, controls, navigation affordances, empty states, loading states, error states, and permission states.
3. **Data requirements:** For every screen, the skill must identify required data sources, derived values, mock data needs, and any source facts that must be preserved from the analysis card.
4. **Feature mapping:** Every screen must map back to the relevant feature, requirement, or workflow from the analysis card so the later visual mockup skill has traceable intent.
5. **Reuse guidance:** The skill must name existing screens, components, or patterns that should be reused or respected when producing visual mockups later.

---

## E. Out Of Scope

1. **No visual mockups:** This skill must not generate final UI mockups, image assets, high-fidelity layouts, or visual styling systems.
2. **No implementation:** This skill must not edit product code, scaffold components, or implement routes.
3. **No detached invention:** This skill must not invent screens that are unrelated to the analysis card, current stack, current feature set, or existing workflows.

---

## F. Acceptance Criteria

1. **Completeness:** The output gives enough screen-by-screen content detail for a separate visual mockup skill to generate mockups without rediscovering product intent.
2. **Grounding:** Each proposed screen is grounded in the analysis card, existing product context, stack constraints, or an explicitly stated assumption.
3. **Clarified scope:** Any unresolved blockers are listed as concrete questions, and non-blocking assumptions are separated from confirmed facts.
4. **Two-skill boundary:** The final output clearly hands off to a later visual mockup creation skill without doing that visual work itself.
