## A. Implemented behavior

1. Removed the quick-capture conditional that replaced `send` with `run`.
2. Forwarded the explicit `launchMode` from the clicked `SEND`, `RUN`, and `PIPELINE` controls.
3. Preserved recorder, thread, transcription, optimistic-note, backend admission, and explicit execution behavior.
4. Updated the floating microphone accessible label to describe recording without implying execution.

---

## B. Verification

1. Focused checks, voice lifecycle checks, frontend typecheck, and the full frontend suite passed.
2. Live quick microphone followed by `SEND` produced `launchMode=send`, `queueCodex=false`, and no Exec navigation.
3. Commit `f2abacf0`; merged by `d110a2ce`.
