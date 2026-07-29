# OPERATOR
<!-- decision-os:note {"id":"note-1785326631177-fb62cee5e09328","timestamp":"2026-07-29T12:03:51.202Z"} -->

1. a plan about the migration
  2. code quality, over engineering, bloat analysis - BUT preserve ALL features and
  behavior
  3. Tasks, group tasks and symbols+files to changes, why to change them, what to
  change
  4. implementation
  5. test run -> group failures, investigate with subagents in low effort in parallel
  for group investigation
  6. once all reports, fix all at once
  7. run tests around the failures only - loop on fix. Never fix / ru nsequentially,
  always grouped
  8. run all tests again
  9. code quality again
  10. commit and lessons / teachings about avoidable issues

  Try to always develop repeatble tools instead of creating adhoc scripts. Do regular
  analysis of the sessions to identify how to be faster

# OPERATOR
<!-- decision-os:note {"id":"note-1785353584468-37a6e884ba1d2","timestamp":"2026-07-29T19:33:04.604Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1785353584582-4b7890e9-933e-40c0-bb4b-e2444f9ab6ab.wav","status":"transcribed","transcriptionStartedAt":"2026-07-29T19:33:04.647Z","uploadReceivedAt":"2026-07-29T19:33:04.581Z","audioPersistedAt":"2026-07-29T19:33:04.582Z","acceptedAt":"2026-07-29T19:33:04.582Z","providerStartedAt":"2026-07-29T19:33:04.647Z","providerSettledAt":"2026-07-29T19:33:05.913Z","completedAt":"2026-07-29T19:33:05.958Z","codexQueueRequestId":"voice:note-1785353584468-37a6e884ba1d2","codexQueueLaunchMode":"run","codexQueueCardId":"card-121e8a43-3476-49a4-a4ec-f5133d6eb0ee","revision":4} -->

Prépare cette carte comme étant un gate controller prompt.

# AGENT
<!-- decision-os:note {"id":"note-agent-1785353772561-bc85c877-7a3","timestamp":"2026-07-29T19:36:12.752Z"} -->

1. Converted the intake into a feature-preserving migration gate controller.
2. Added ten ordered gates covering migration intake, behavior preservation, quality audits, code-linked grouping, implementation, parallel failure attribution, consolidated repair, full-system proof, and reusable learning.
3. Execution is held at Gate 1 until the migration target and required source material are attached.
