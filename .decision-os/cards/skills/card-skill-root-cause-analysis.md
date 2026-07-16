---
name: root-cause-analysis
description: Diagnose ambiguous failures from tests and runtime execution by collecting evidence, listing hypotheses, tracing the failing chain, and identifying the smallest structurally correct fix path. Use when `test-failure-attribution` cannot confidently assign a failure. Use when a repair loop repeats.
---

## A. Purpose

1. **Goal:** Find the fundamental cause of a failure before another implementation worker is dispatched.
2. **Boundary:** Use this skill for diagnosis and fix planning only.
3. **Integrity rule:** Do not hide behavior. Do not disable checks. Do not guess from symptoms.

---

## B. Required Inputs

1. **Failure report:** Read the failure report from `test-failure-attribution`.
2. **Repository evidence:** Read related task groups, changed files, test files, stack traces, logs, and source cards.
3. **Debugging guidance:** Read relevant repository debugging guidance before forming final conclusions.

---

## C. Workflow

1. **Failure statement:** State the exact failure and the observable evidence.
2. **Hypothesis inventory:** List plausible causes before choosing a direction.
3. **Execution trace:** Trace the execution chain from the failure trigger through the failing behavior.
4. **Expected behavior check:** Compare expected behavior from specs and tasks against actual behavior in code and tests.
5. **Hypothesis rejection:** Reject hypotheses with evidence.
6. **Root cause selection:** Identify the smallest root cause that explains the failure.
7. **Corrective path:** Propose the lowest-risk corrective path with affected files and owner group.

---

## D. Output Contract

1. **`Failure Summary`:** Include the command, failing test path when present, runtime path when present, and observed symptom.
2. **`Evidence Collected`:** Include file paths, symbols, logs, stack traces, and relevant snippets.
3. **`Hypotheses`:** Include candidate causes and evidence supporting and rejecting each candidate.
4. **`Confirmed Root Cause`:** Include the fundamental cause and the evidence that rejected other causes.
5. **`Fix Handoff`:** Include the owner group, target paths, corrective action, and verification command.

---

## E. Hard Rules

1. **No bypasses:** Do not hide behavior. Do not disable checks. Do not delete failing coverage. Do not bypass failing behavior unless the operator explicitly asks for a degraded-mode tradeoff.
2. **Evidence first:** Do not skip evidence collection.
3. **Root cause standard:** Do not treat symptoms as root cause.
4. **No implementation:** Do not implement the fix unless explicitly reassigned as an implementation worker.
