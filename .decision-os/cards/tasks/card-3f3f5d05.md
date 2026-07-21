## A. Objective

1. **Add project configuration.** Add a project layer to the burger menu.

---

## B. Implementation

1. **Project list.** Display the projects known to the master server.
2. **Color control.** Let the user assign and persist one color for each project.
3. **Shared update.** Reflect saved project configuration in Control Room and task filtering without requiring navigation to another server.

---

## C. Verification

1. **Settings coverage.** Test project listing, color persistence, reload behavior, and propagation to project-aware views.

---

## D. Implementation Evidence

1. **Burger menu.** The navigation drawer lists catalog projects, shows each nested relative path as the control title, switches project context, and provides a color input per project.
2. **Persistence.** Color changes call the validated master-scoped project endpoint and re-render project navigation and Control Room.
3. **Automated checks.** Backend color persistence tests and all frontend-mobile tests pass.
4. **Live persistence.** On the operator-facing server, project `Lg` persisted `#38d9e8 → #123456`, returned `#123456` on a fresh catalog request, and was restored to `#38d9e8`. Project-scoped state returned the expected project and six ledgers; an invalid project id returned HTTP `404`.
5. **Interaction gate.** The color input and browser reload still require one observed Android touch pass because browser automation is unavailable in this Termux environment.
