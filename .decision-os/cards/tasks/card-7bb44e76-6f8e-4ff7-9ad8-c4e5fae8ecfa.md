## A. Objective

1. **Change:** Extend the workspace skill-library record with a durable `favorite` boolean.
2. **API:** Return the value from catalog and detail reads and accept it through the conflict-aware skill-library save endpoint.

---

## B. Acceptance Criteria

1. **Default:** Missing values normalize to `false`.
2. **Save:** Toggling a favorite does not modify `SKILL.md` and preserves model and effort defaults.
3. **Coverage:** Store normalization and skill-library route tests prove persistence and reload behavior.
