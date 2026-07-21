# OPERATOR
<!-- decision-os:note {"id":"note-1784101173131-99d6bdc1c964e","timestamp":"2026-07-15T07:39:33.557Z"} -->

![Screenshot_20260715_143919_Brave.jpg](/.decision-os/thread-files/thread-card-1adba778-1e57-4160-858e-e9ebfec1999a/file-1784101173536-f721d13e73eca8-Screenshot_20260715_143919_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784101177682-e808e494d6029","timestamp":"2026-07-15T07:39:38.240Z"} -->

![Screenshot_20260715_143535_Brave.jpg](/.decision-os/thread-files/thread-card-1adba778-1e57-4160-858e-e9ebfec1999a/file-1784101177830-3dcbc2ee0eb4b8-Screenshot_20260715_143535_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1784101232020-2d8fbe703c366","timestamp":"2026-07-15T07:40:32.192Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784101232177-527721dd-b484-44e0-ad2c-40ee3d351aa4.wav","status":"transcribed","transcriptionStartedAt":"2026-07-15T07:40:32.202Z"} -->

Quand je vois ce que la session elle fait là, avec des problèmes pour lancer les tests dans les worktrees, on dirait qu'il y a vraiment une espèce de confusion totale sur comment faire. Et du coup l'agent il essaye, ça rate, il essaye, ça rate. Il ne comprend pas comment lancer les tests. Et on se retrouve avec des codex run qui prennent un quart de temps d'implémentation, un quart de temps de planification et la moitié du temps à essayer de lancer les tests, à rater, à recommencer. Et ça nous fait perdre un temps considérable. Comment est-ce qu'on pourrait faire pour que tout soit simple à faire, clair et qu'on ne perde pas de temps à faire des round trips entre des problèmes de savoir comment lancer les tests ?

# OPERATOR
<!-- decision-os:note {"id":"note-1784101238720-7f616287c29388","timestamp":"2026-07-15T07:40:38.809Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784101238789-a3517ddc-2ecc-497b-97d3-173214d4dc15.wav","status":"transcribed","transcriptionStartedAt":"2026-07-15T07:40:38.818Z"} -->

sachant qu'en plus on a déjà un runbook sur comment lancer les tests.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784101658343-768c4815","timestamp":"2026-07-15T07:47:38.344Z"} -->

The runbook is not the missing piece. The screenshots show that agents still have to reconstruct the execution environment themselves: one test loaded primary-checkout code through inherited `TSX_TSCONFIG_PATH`, and another failed before execution because the worktree lacked package-local dependencies. The existing `execution-profile` improves discovery, but it still returns templates and bootstrap steps rather than owning execution.

I created the master task [Make worktree verification one-command and environment-safe](card:card-1adba778-1e57-4160-858e-e9ebfec1999a) in the new **One-command worktree verification** zone.

The selected correction is one canonical `bin/decision-os-verify.mjs` command that owns admission, active-worktree discovery, dependency preparation, local TypeScript configuration, concurrency, focused/typecheck/full modes, failure classification, and timing output.

Subtasks:

1. [Implement the canonical worktree verification CLI](card:card-ca6d023e-1ff0-40d4-bb77-2ab5c76662e9) — pending.
2. [Make every repository verification path use the canonical CLI](card:card-e5e4a624-579c-424b-8b9e-993bc61b3146) — pending.
3. [Verify zero-guesswork execution in a real fresh worktree](card:card-d7adddda-c781-4bdf-99c2-de7138f5a30f) — pending.

Acceptance requires a fresh worktree with no dependencies and a deliberately poisoned `TSX_TSCONFIG_PATH` to pass through one invocation, prove that changed worktree source executed, and require no manual dependency search, loader selection, symlink command, failed setup attempt, or retry.

# OPERATOR
<!-- decision-os:note {"id":"note-1784102432324-d53e2231e2acb8","timestamp":"2026-07-15T08:00:32.533Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784102432512-3970856d-053b-47d0-b3a4-82db8c15e5d7.wav","status":"transcribed","transcriptionStartedAt":"2026-07-15T08:00:32.543Z","uploadReceivedAt":"2026-07-15T08:00:32.510Z","audioPersistedAt":"2026-07-15T08:00:32.524Z","acceptedAt":"2026-07-15T08:00:32.524Z","providerStartedAt":"2026-07-15T08:00:32.543Z","providerSettledAt":"2026-07-15T08:00:34.349Z","completedAt":"2026-07-15T08:00:34.386Z","revision":4} -->

OK, exécute l'ensemble de la tâche.
