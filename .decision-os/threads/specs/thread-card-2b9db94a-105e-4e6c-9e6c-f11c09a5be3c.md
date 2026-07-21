# OPERATOR
<!-- decision-os:note {"id":"note-1784220144953-7b98a179408e","timestamp":"2026-07-16T16:42:25.098Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784220145075-ab80738d-3385-43d4-a2c8-f310e52c0fad.wav","status":"transcribed","transcriptionStartedAt":"2026-07-16T16:42:25.105Z","uploadReceivedAt":"2026-07-16T16:42:25.075Z","audioPersistedAt":"2026-07-16T16:42:25.091Z","acceptedAt":"2026-07-16T16:42:25.091Z","providerStartedAt":"2026-07-16T16:42:25.105Z","providerSettledAt":"2026-07-16T16:42:30.034Z","completedAt":"2026-07-16T16:42:30.048Z","revision":4} -->

Je veux qu'on réfléchisse à comment est-ce qu'on peut créer des tâches récurrentes, périodiques, qui permettent de lancer un pipeline. Par exemple, l'idée, ça serait d'aller se connecter à une API et de récupérer des données, ou alors ça serait de récupérer des messages Instagram, des commentaires. Enfin, peu importe en fait. L'idée, c'est juste de pouvoir lancer des pipelines à des tâches périodiques. Pas à des tâches périodiques, à des... Avec un schedule, en fait.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784220319184-22ff019a-070","timestamp":"2026-07-16T16:45:19.185Z"} -->

## A. Intake result

1. **Category:** Feature work across `pipelines`, `scheduling`, backend persistence, API, frontend controls, and verification.
2. **Verified baseline:** Decision OS already persists saved pipelines and durable runs, exposes `POST /api/codex/pipelines/runs`, enforces FIFO process capacity, and reconciles runs after restart. No recurring schedule model or trigger loop exists.
3. **Selected boundary:** Persist cron plus IANA time zone schedules and deduplicate each occurrence with `(scheduleId, scheduledFor)`, then launch through the existing pipeline runner and queue.
4. **Breakdown:** Five canonical subtask cards now cover the contract, persistence and endpoints, due-run enqueueing, pipeline-library controls, and end-to-end verification.
5. **State:** The master task and all subtasks remain open for implementation.
