# Document Research and Solution Selection Prompt

The prompt below is preserved verbatim.

```text
Analyze `[SOURCE_DOCUMENT]` against `[REPOSITORY_ROOT]`.

Goal:
- Understand the document.
- Verify every claim from repository evidence.
- Research missing technical facts.
- Produce solution candidates.
- explain the tradeoff of each candidate.
- Select one solution.
- Build a complete Decision OS Master Ledger.
- Simulate critical stack traces.
- Audit architecture, tests, dependencies, and completeness.
- Finish with a short executive summary.

Rules:
- Use English only.
- Use simple words and short numbered points.
- Use exact technical names: file paths, symbols, routes, commands, IDs, fields, events, and statuses.
- Do not guess when evidence is available.
- Cite repository evidence with `path:line` and external research with direct links.
- Use primary technical sources.
- Separate facts, inferences, decisions, gaps, and operator questions.
- Never hide contradictions.
- Do not invent Specs, Data Model fields, Runtime State, tasks, files, symbols, or requirements.
- Do not modify staged Git hunks.
- Do not close master tasks or mark master-task cards `done`.
- Do not leave unresolved alternatives in the selected plan.
- Keep one authoritative working document.

Execution:

1. Run `executor-precheck`.
   - Locate the operator request, Specs, Data Model, Runtime State, repository root, and scope.
   - Stop with `BLOCKED_NEEDS_OPERATOR_ANSWER` only when missing truth prevents safe analysis.
   - Otherwise record `READY_FOR_EXECUTOR_STACK`.

2. Build an evidence register with `corpus-data-extraction`.
   - Extract atomic requirements, constraints, claims, decisions, risks, metrics, relationships, contradictions, and unknowns.
   - Give every item a stable source reference and confidence.
   - Do not summarize before the register exists.

3. Launch the first parallel review wave, using no more than three native subagents:
   - Document analyst: compare the source document with the evidence register.
   - Repository analyst: run deep static code/spec drift analysis using `analysis`.
   - Research analyst: verify missing and current technical facts using official documentation and primary sources.
   - Each agent writes a separate report.
   - Parallel agents must not edit the authoritative working document.

4. Reconcile the first-wave reports.
   - Deduplicate findings.
   - Preserve supporting sources.
   - Record contradictions.
   - Classify each finding as `gap`, `omission`, `drift`, `risk`, `unknown`, or `confirmed`.
   - Amend the authoritative document through the coordinator only.

5. Run `executor-stack`.
   - Define the verified `Root Blocks`.
   - Validate the technical stack against Specs and Data Model.
   - Research stack best practices when required.
   - Produce the agnostic directory scaffold.
   - Ask only questions that change the Master Ledger.

6. Expand every material technical decision into solution candidates.
   - Provide two to four viable candidates.
   - For each candidate state:
     - exact design;
     - existing source of truth;
     - files and symbols affected;
     - benefits;
     - costs;
     - failure modes;
     - migration impact;
     - runtime impact;
     - test impact;
     - operational impact.
   - Compare candidates using:
     - Spec fit;
     - correctness;
     - implementation size;
     - maintenance cost;
     - recovery behavior;
     - performance;
     - testability;
     - migration risk.
   - Select one candidate.
   - State why it wins.
   - State the real capability lost by rejecting each alternative.
   - The selected plan must contain one resolved design.

7. Run `over-engineering-analysis`.
   - Challenge every proposed table, manifest, registry, cache, index, state object, and abstraction.
   - Remove anything that duplicates an existing durable anchor.
   - Keep a new object only when it owns a distinct invariant that cannot be derived safely and cheaply.

8. Run `executor-spec`.
   - Create the Master Ledger before filling its sections.
   - Write and reassess one section at a time.
   - Include:
     - domains;
     - one test suite per Spec;
     - inputs;
     - operator inputs when applicable;
     - helpers;
     - effects;
     - screens and pages;
     - components;
     - Runtime State ownership;
     - control-flow entries;
     - controller pseudocode;
     - telemetry;
     - unresolved items;
     - new Spec candidates;
     - Anti-Spec candidates.
   - Verify every reference has a defined target.
   - Verify every Spec maps to exactly one primary test suite.

9. Simulate the critical stack traces.
   - Cover success, validation failure, dependency failure, persistence failure, retry, cancellation, and reload when applicable.
   - Use this exact chain:
     `input → action payload → controller → branch → helper → effect → telemetry → Runtime State → durable state → rendered result → test assertion`
   - For each transition record:
     - exact input;
     - previous state;
     - called symbol;
     - arguments;
     - selected branch;
     - state mutation;
     - external I/O;
     - emitted telemetry;
     - returned result;
     - visible result;
     - failure propagation;
     - test assertion.
   - Identify the first incorrect or undefined transition.
   - Do not claim behavioral proof from source inspection alone.

10. Launch the second parallel review wave:
    - Architecture reviewer:
      - check Root Block boundaries;
      - domain ownership;
      - API contracts;
      - Data Model ownership;
      - Runtime State ownership;
      - persistence boundaries;
      - migrations;
      - configuration;
      - deployment effects.
    - Test reviewer:
      - check one Spec to one primary test suite;
      - inputs;
      - fixtures;
      - error paths;
      - telemetry;
      - stack-trace coverage;
      - integration boundaries;
      - target-surface verification.
    - Simplicity reviewer:
      - find duplicated state;
      - speculative abstractions;
      - unnecessary persistence;
      - unsafe parallel work;
      - smaller structurally correct solutions.
    - Each reviewer writes a report without editing the Master Ledger.

11. Amend the Master Ledger through the coordinator.
    - Apply verified review findings.
    - Record rejected findings with evidence.
    - Repeat the consistency and readiness gates.
    - Do not declare readiness while a required reference, transition, test, migration, fixture, or operator decision is missing.

12. Run planning gates:
    - `task-list`
    - `task-dependency`
    - `task-group-completeness`
    - Ensure every task has real target files, target symbols, dependencies, ownership, and a concrete `done_when`.
    - Repair missing tasks in the source planning card before reporting completeness.
    - End with `ready` only when the engineering plan is dispatch-safe.

13. Produce the Decision OS executive summary with `human-context-synthesis`.
    - State:
      - what the document is trying to achieve;
      - what repository evidence confirms;
      - the main gaps;
      - the selected solution;
      - why it was selected;
      - the main tradeoff;
      - implementation scope;
      - verification scope;
      - remaining operator decisions;
      - exact next action.
    - Keep the summary short and decision-focused.

Required outputs:
- Evidence register.
- Repository drift report.
- Research report with direct sources.
- Solution comparison and selected solution.
- Master Ledger.
- Simulated stack traces.
- Architecture review.
- Test review.
- Task inventory.
- Dependency graph.
- Completeness decision.
- Executive summary.
```
