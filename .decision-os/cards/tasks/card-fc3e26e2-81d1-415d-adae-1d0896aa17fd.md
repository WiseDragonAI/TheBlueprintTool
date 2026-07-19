## A. Implementation

1. **The mobile voice dock now exposes `SEND`, `RUN`, and `PIPELINE` controls.**
2. **Each control uses the same `send`, `run`, and `pipeline` launch modes as the keyboard shortcuts.**
3. **The existing cancellation, waveform, optimistic upload, retry, and pending-execution paths remain in place.**

---

## B. Verification Evidence

1. **Focused mobile control, routing, pending upload, and responsive-thread tests passed.**
2. **The full frontend, backend, and browser suites passed.**
3. **The served Settings page includes the new pipeline configuration and `Ctrl+X` help.**

---

## C. Remaining Device Check

1. **On a mobile viewport after the next server restart, record a voice note and exercise `SEND`, `RUN`, and `PIPELINE` once each.**
2. **Confirm the three buttons remain visible, the chosen action is dispatched, and failed transcription clears pending execution.**
