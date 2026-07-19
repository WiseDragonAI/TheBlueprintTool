## A. Outcome

1. **Requested outcome:** explain why the MOH Codex run displayed shell and JSON fragments as separate `Diagnostic` entries.
2. **Delivered result:** the investigation identified physical-line stderr normalization as the cause, and the operator correctly reframed it as a parsing defect requiring one error block.
3. **Implemented correction:** timestamped stderr severity records now retain their continuation lines until the next severity header and are normalized once as a complete multiline record.
4. **Operator-visible effect:** the MOH command rejection is represented as one `Error` event containing its complete shell and JSON context; independent unstructured stderr lines retain their prior behavior.

---

## B. Retrospective

1. **Initial decision:** the first response explained the fragments and the unaffected database-sync state without changing the parser.
2. **Operator correction:** an error and its continuation payload must be rendered as one error block, which exposed the physical-line parsing boundary as the defect.
3. **Preventive rule:** parse structured stderr by logical severity record, then classify the complete record once; cover the boundary with a byte-equivalent multiline regression.
4. **Durable memory:** saved code memory record `49`, `Classify multiline stderr by structured record`, after a project search returned no equivalent record.

---

## C. Delivery evidence

1. **Implementation commit:** `ddbc40a4` (`fix(codex): group multiline stderr errors`).
2. **Merge commit:** `6949f0e6` (`merge: group multiline Codex errors`).
3. **Regression:** the MOH-shaped fixture requires one diagnostic with `kind: error`, `title: Error`, `errorCount: 1`, and the complete multiline payload.
4. **Checks:** focused controller tests passed `6/6`; backend TypeScript checking passed.
5. **Suite state:** the full backend suite passed `204/208`; the four visible failures were pipeline-catalog expectation conflicts involving the seeded `project-synchronization` pipeline, while the diagnostic regression passed.
6. **Runtime boundary:** the running server was not restarted. The corrected parser loads on the next server start.

---

## D. Closeout

1. **Canonical subtask:** [Trace and explain MOH diagnostic rendering](card:card-b75d1db1-67c1-45f4-8e99-d110a4095702) is `done`.
2. **Gate result:** `master-task-gate` reported `ready: true` with no discrepancies and valid thread roles before completion.
3. **Completion result:** the canonical completion command ran exactly once and marked master card `card-47955f12-4ed3-41dd-aada-7cac51f3e899` `done` in commit `da6a9e9b9523ea246723ea54806f02690d5e9ab7`.
---

Codex run completed: exit code 0
