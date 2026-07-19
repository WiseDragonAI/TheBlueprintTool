## A. Contradicted Layout RCA

1. **Failure:** The labels overlapped the Kanban after the previous success report.
2. **Cause:** `.control-command` duplicated the top-bar offset with `position: sticky; top: 64px`.
3. **Evidence:** Before correction, the command began at `y=163`, labels at `y=185`, and tasks at `y=158`.

---

## B. Correction

1. **Implementation:** Desktop `.control-command` is static with no `top` offset.
2. **Preserved behavior:** Full-width columns and independent vertical scrolling remain unchanged.

---

## C. Verification

1. **Rendered pass:** The labels now span `y=87` to `y=121`; the Kanban begins at `y=158`.
2. **Automated pass:** Focused tests `49/49`, typecheck, and full suite `439/439`.
3. **Repository:** `b5078c04` merged as `3225bf0e`.

---

## D. Lesson

1. **Recorded lesson:** Verify sticky and fixed-header geometry on the served surface with screenshots and bounding rectangles; grid-track source assertions are insufficient.
