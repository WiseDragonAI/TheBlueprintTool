# OPERATOR
<!-- decision-os:note {"id":"note-1784538793591-ce2e4730802fe8","timestamp":"2026-07-20T09:13:13.679Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784538793675-02bb1a2c-f3f4-4ec2-843e-9de8359072f9.wav","status":"transcribed","transcriptionStartedAt":"2026-07-20T09:13:13.691Z","uploadReceivedAt":"2026-07-20T09:13:13.675Z","audioPersistedAt":"2026-07-20T09:13:13.677Z","acceptedAt":"2026-07-20T09:13:13.677Z","providerStartedAt":"2026-07-20T09:13:13.691Z","providerSettledAt":"2026-07-20T09:13:17.389Z","completedAt":"2026-07-20T09:13:17.393Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-20T09:13:13.677Z","codexQueueRunId":"codex-skill-1784538797500-5500d520","revision":4} -->

Il y a eu plusieurs fois où j'ai demandé que quand on ouvre un thread, ça vient tout le temps en bottom, par défaut, ce n'est toujours pas le cas. Ça veut dire qu'il y a des cartes que j'ouvre, le thread, ça me l'ouvre en haut, au lieu de me l'ouvrir en bas. Donc euh il y a eu plusieurs commits qui ont été faits sur ça, ça veut dire qu'ils ne marchent pas. S'ils ne marchent pas, ça veut dire que l'ownership n'est pas bon. Et si l'ownership n'est pas bon, ça veut dire qu'il faut se reposer à la question du runtime state, de l'ownership, des contrôleurs. Il faut que tu lises tous les commentaires, ça se trouve, il manque des commentaires, il manque des helpers, il y a de la factorisation qui n'est pas bonne. Il faut que tu fasses une analyse complète et profonde pour voir quel est le problème.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784539401922-bf7a5634-a87","timestamp":"2026-07-20T09:23:21.922Z"} -->

## A. Analysis Result

1. **Verified root cause:** Persisted follow-bottom state owns both continuation behavior and entry behavior. A stored `false` from an earlier upward scroll makes `openThreadPanel()` and `selectThread()` suppress the pin request, so the renderer restores the saved offset.
2. **Why only some cards fail:** The `false` record is stored per thread in `decision-os.canvas.state`; unseen threads default to bottom, while previously paused threads reopen at their old position.
3. **Responsive failure:** `closeMobileThread()` retains the thread ID, so reopening the same card makes `selectThread()` return before deriving a new pin decision. Commit `9564267c` also removed the responsive unconditional pin.
4. **Ownership failure:** `threadPinOnRender` is an undeclared global boolean with no thread, surface, generation, or reason identity. Desktop, responsive, deep-link, master-task, and shortcut paths do not share one entry controller.
5. **Regression proof:** The focused suite passes `23/23` while explicitly asserting that a persisted pause must prevent pinning on return. The tests therefore protect the reported bug.

---

## B. Selected Correction

1. **Typed transition:** Replace `threadPinOnRender` with a thread-scoped, surface-scoped, generation-scoped viewport pin request.
2. **Single controller:** Route every thread entry through one controller that owns selection, panel visibility, active surface, follow enablement, pin request, and render order.
3. **Explicit precedence:** Panel open, thread switch, and tab activation always pin the activated surface and enable follow. Ordinary rerenders preserve a paused reader and pin a following reader.
4. **Single scroll writer:** Remove duplicate log scroll mutation from the log renderer and apply one matched viewport decision after content mounting.
5. **Delayed layout:** Repin followed content after lazy media expansion through one active `ResizeObserver`.

---

## C. Durable Output

1. **Master and zone:** Renamed to `Fix Thread Open-Bottom Runtime Ownership` and `Thread Open-Bottom Runtime Ownership`.
2. **Analysis document:** `documentation/thread-open-scroll-ownership-analysis.md` records repository intent, iteration intent, fifteen evidence-backed findings, commit drift, and remediation paths.
3. **Subtask graph:** Five canonical `subtask` relationships cover contradicted-success reproduction, typed state, controller consolidation, render ownership, and regression plus served verification.

---

## D. Current State

1. **Implementation:** Not started. No runtime component or styling code changed.
2. **Statuses:** The master remains open and all five subtasks remain `todo`.
3. **Next gate:** Capture the exact served desktop and mobile-viewport failure with persisted `false` state before editing, then implement through the ordered subtask chain.

# OPERATOR
<!-- decision-os:note {"id":"note-1784539896483-ff18c75bc3c24","timestamp":"2026-07-20T09:31:36.486Z"} -->

execute immediately

# AGENT
<!-- decision-os:note {"id":"note-agent-1784542362025-518ee94e-dc7","timestamp":"2026-07-20T10:12:42.025Z"} -->

## A. Executed

1. **Fixed:** Explicit panel open, thread switch, and tab activation now pin the active surface to the newest content even when persistence contains `follow=false`.
2. **Preserved:** Real upward scrolling still pauses ordinary continuation renders.
3. **Ownership:** A typed thread/surface/generation request, one entry controller, one shared viewport writer, one log-only continuation effect, and one coalesced resize observer now own the lifecycle.

---

## B. Verification

1. **Automated:** Frontend TypeScript passes; full frontend tests pass `492/492`.
2. **Served:** HTTP `200` in `/snap/bin/chromium` at `390x844` and `1280x900`. Real wheel input created an `890px` paused offset; same-card reopen returned to `0px`; ordinary render retained `700px`; tab activation and delayed growth returned to `0px`.
3. **Commits:** The implementation is merged into `main` at `d208e773`.

---

## C. Status

1. **Subtasks:** All five canonical subtasks are verified.
2. **Master:** The master remains open; it was not manually closed.
