# OPERATOR
<!-- decision-os:note {"id":"note-1784481805535-41e78ad3f3a59","timestamp":"2026-07-19T17:23:25.539Z"} -->

I need a system on the workstation and decision os where I can enqueue a system shutdown after the queue is flushed and executed. Find what system is the most adapted and prepare a plan for it. It must be sudo-less (maybe a file we write in) and must be loop-safe so we dont end in a shutdown loop. Find the best solution and plan.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784482117763-758cc6c0-460","timestamp":"2026-07-19T17:28:37.763Z"} -->

# AGENT
<!-- decision-os:note {"id":"note-3"} -->

Planning is complete. The selected design is a Decision OS-owned, durable one-shot drain state machine backed by the existing global local-workstation Codex scheduler, with systemd-logind as the sudo-less poweroff executor. This workstation reports systemd `255` and `CanPowerOff = yes`, so no root helper or custom polkit rule is required.

The plan closes new local Codex admission while armed, drains every already-pending and running local project item, atomically records `firing` before invoking `systemctl poweroff --no-block --no-ask-password`, never retries after firing or failure, and requires a new explicit arm after a reboot. Six relationship-backed implementation subtasks cover persistence, global coordination, admission, Control Room UX, backend safety tests, and browser workflow tests.

The master task remains open for dependency analysis and implementation. Status: `READY_FOR_TASK_DEPENDENCY`.

# OPERATOR
<!-- decision-os:note {"id":"note-1784539452337-f1d1f9f5a792b","timestamp":"2026-07-20T09:24:12.521Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784539452518-56c0c997-d638-43d8-acbd-8e8476fd7147.wav","status":"transcribed","transcriptionStartedAt":"2026-07-20T09:24:12.586Z","uploadReceivedAt":"2026-07-20T09:24:12.518Z","audioPersistedAt":"2026-07-20T09:24:12.519Z","acceptedAt":"2026-07-20T09:24:12.519Z","providerStartedAt":"2026-07-20T09:24:12.586Z","providerSettledAt":"2026-07-20T09:24:15.994Z","completedAt":"2026-07-20T09:24:16.053Z","codexQueueStatus":"started","codexQueueRequestedAt":"2026-07-20T09:24:12.519Z","codexQueueRunId":"codex-skill-1784481807058-702ba75b","revision":4} -->

Je veux une carte, la master task, il faut que ce soit un exécutif summary, il faut que ce soit facile à lire pour un opérateur, là, ce n'est pas le cas, c'est impossible à lire. Je ne vais pas lire un compte-rendu comme ça avec un tableau de tâches, ça n'a aucun sens. Ton tableau de tâches, tu le mets dans une sous-tâche. Et la mastercard, ça doit être un exécutif summary pour un CTO avec des bullet points courts qui me permettent de comprendre l'entièreté du contexte.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784540760101-49bba707-217","timestamp":"2026-07-20T09:46:00.101Z"} -->

The master task is now a CTO-facing executive summary with short sections covering the decision, operator workflow, safety guarantees, scope, and delivery status. The detailed implementation table has been removed from the master card and placed in `TL-01`. All six canonical subtask relationships and `todo` statuses are preserved. The master task remains open at `READY_FOR_TASK_DEPENDENCY`.
