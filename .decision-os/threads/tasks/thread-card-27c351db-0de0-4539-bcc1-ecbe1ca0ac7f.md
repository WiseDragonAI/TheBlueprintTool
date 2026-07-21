# OPERATOR
<!-- decision-os:note {"id":"note-1783967591556-3fc16372e9964","timestamp":"2026-07-13T18:33:11.671Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783967591638-f8a2c3a5-3bc0-4a17-b103-9b8e86c0dbb6.wav","status":"transcribed","transcriptionStartedAt":"2026-07-13T18:33:11.680Z"} -->

J'ai un projet qui a disparu de la control room, j'arrive pas à comprendre pourquoi. Est-ce qu'il n'y a pas encore, c'est le projet Pink, est-ce qu'il n'y a pas encore un genre de header ou de cookie qui existe, qui est capable de faire un filtre sur ce qui est visible dans le client ?

# AGENT
<!-- decision-os:note {"id":"note-agent-1783967947251-da24a390","timestamp":"2026-07-13T18:39:07.254Z"} -->

Pink is not being filtered by a client cookie or request header.

Verified cause: the live server has `DECISION_OS_ROOT=/data/data/com.termux/files/home/decision-os/.decision-os`. Catalog discovery is therefore confined to `/data/data/com.termux/files/home/decision-os`, while Pink is at `/data/data/com.termux/files/home/health/pink`. The live `/decision-os/projects` response consequently contains only `decision-os`.

Pink's `.decision-os/state.json` exists and declares its `tasks` ledger. The server integration contract rejects the legacy `decision-os-project` cookie and `x-decision-os-project` header as project selectors, and the served mobile client fetches the global catalog with `cache: no-store`.

The exact recovery is to relaunch the server from `/data/data/com.termux/files/home` with `DECISION_OS_ROOT` unset, preserving port `50150` and the `frontend-mobile` root. This requires a server restart.

Please authorize that restart if you want me to restore Pink now.

# OPERATOR
<!-- decision-os:note {"id":"note-1783968539660-1cf298e41b2768","timestamp":"2026-07-13T18:48:59.918Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783968539865-36400352-54dc-4cd8-a514-baf1bdbe1f71.wav","status":"transcribed","transcriptionStartedAt":"2026-07-13T18:48:59.924Z"} -->

Non mais le Legacy DecisionOS, projet cookie et le header, j'espère bien que ça a été supprimé complètement de la codebase et que ça ne persiste pas. Il ne faut absolument pas que ça persiste. Et deuxièmement, le DecisionOS root, on s'en fout. En fait euh je je je ne comprends pas pourquoi le root il est là. En fait le DecisionOS root, non, on veut que ce soit dans la home de Termux depuis le début, puisque le service Termux, il utilise ça. Et le DecisionOS root, normalement, c'est juste quelque chose qui nous permet de résoudre le ledger CLI, mais ce n'est pas censé interférer sur la route, puisque si on fait un multi-project, on ne va pas lancer DecisionOS dans DecisionOS, ça n'a aucun sens. Il faut le lancer depuis la home, c'est évident. Donc continue ton analyse, parce que là, c'est bancal.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783968811141-b6bd360f","timestamp":"2026-07-13T18:53:31.143Z"} -->

The deeper finding confirms that the previous recovery was incomplete.

1. The Termux service is already correct: its run script changes to `/data/data/com.termux/files/home`, sets port `50150`, selects `frontend-mobile`, and does not set `DECISION_OS_ROOT`.
2. The `runsvdir` supervisor inherited the active Decision OS card environment, including `DECISION_OS_ROOT=/data/data/com.termux/files/home/decision-os/.decision-os`, `DECISION_OS_PROJECT_ID`, and `DECISION_OS_LEDGER_FILE`.
3. The backend then incorrectly consumes `process.env.DECISION_OS_ROOT` before its launch cwd. `create-http-server.ts` derives the master project catalog root from that value. This is the first incorrect transition and the structural cause of Pink disappearing.
4. `DECISION_OS_ROOT` is valid for one purpose: `decision-os-codex-runtime.ts` injects the active project's root into Codex children, and `ledger-cli` uses it to reject out-of-scope ledger access. It must not participate in server startup.
5. The legacy project selector is absent from runtime source, but complete removal is not true. The exact legacy cookie and header names remain in `backend/test/server/decision-os-project-catalog.integration.test.ts` and `frontend-mobile/test/mobile-control-room.test.mjs`.

Options assessed:

1. Clearing the variable only in the Termux service would restore Pink but leave backend startup vulnerable to the same contamination elsewhere.
2. Adding a new catalog-root environment variable would add configuration despite the launch cwd already being the canonical catalog boundary.
3. Relaunching once from a clean shell would be transient and would not correct the code contract.
4. Selected correction: sanitize project-scoping variables in the launcher, remove `process.env.DECISION_OS_ROOT` from backend root resolution, retain it only for Codex children and `ledger-cli`, remove both legacy test literals, update the obsolete documentation, and add regressions for inherited-environment isolation.

I have recorded this corrected implementation plan and reopened the implementation subtask. I have not changed server code or restarted the service because your latest request was to continue the analysis.

# OPERATOR
<!-- decision-os:note {"id":"note-1783969114135-ea2db200f7fc","timestamp":"2026-07-13T18:58:34.362Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783969114312-83f0e54a-d0d9-46ea-a5fe-b8a67fc70d8e.wav","status":"transcribed","transcriptionStartedAt":"2026-07-13T18:58:34.368Z"} -->

Bon vas-y euh ta ton option 4 elle a l'air d'être bien. Effectivement, il faut bien faire en sorte que ce décision OS root qui est une variable d'environnement, il soit expliqué, puisque j'ai compris qu'il est utilisé que pour les jerkely du coup. Mais dans ce cas-là, il faut peut-être changer le nom de la variable, parce que sinon en fait, ça prête à confusion et on ne comprend plus. Et du coup, il peut y avoir un autre agent qui se qui se dit que ah ben non, tiens, c'est pas linked alors que normalement, ça devrait être décision root et donc du coup, il va bouger le CWD, on va avoir une régression. Donc le nom de la variable, il est probablement pas bon. Et ça serait plutôt euh je sais pas moi, Ledgerly root ou quelque chose comme ça. Je sais pas, faut en tout cas euh faut effectivement clarifier pour pas qu'il y ait quoi que ce soit qui prête à confusion. Donc tu reassesses et tu euh fais les changements pour que ce soit parfaitement aligné.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783969869988-242a1c5d","timestamp":"2026-07-13T19:11:09.988Z"} -->

The correction has been implemented and merged.

1. The ambiguous project-scoping variable was renamed to `DECISION_OS_LEDGER_ROOT`. Its contract is now limited to Codex children and `ledger-cli` filesystem-scope enforcement.
2. Server catalog discovery now derives from the launch cwd only. The launcher also strips inherited `DECISION_OS_*` project context except `DECISION_OS_FRONTEND_ROOT`, so an agent environment cannot narrow the multi-project catalog.
3. The former root name and the legacy project cookie and header literals were removed from source, tests, and documentation outside managed Decision OS historical content.
4. Automated verification passes: backend and ledger CLI typechecks, `51` ledger CLI tests, `37` mobile Control Room tests, both launcher tests, and focused backend boundary tests.
5. The change is merged into `main` at `d94689a` through the required isolated-worktree workflow.

The live service is still running the previous process, because the server procedure requires explicit restart authorization. Please authorize the Termux Decision OS service restart; I will then verify that `/decision-os/projects` contains Pink and that Pink appears in the Control Room.
