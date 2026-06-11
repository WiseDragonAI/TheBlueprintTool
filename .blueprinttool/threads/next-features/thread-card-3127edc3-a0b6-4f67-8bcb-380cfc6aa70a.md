# OPERATOR
<!-- corev2:note {"id":"note-1781159532169-7e07196999f62","timestamp":"2026-06-11T06:32:12.170Z"} -->

• Assessment: profile is the right control surface, but SessionStart cannot fully replace an
  initial turn by itself.

  What works well:

  1. Profile enables watcher hooks only for watcher sessions.
  2. SessionStart hook loads watcher context and can do a quick unanswered-note check.
  3. Stop hook is the durable loop: after each inference turn, it waits for notes, returns
     decision: "block", and Codex continues with a prompt to use corev2-treat-open-notes.

  4. PreCompact / PostCompact can log or preserve state, but compaction is not guaranteed after
     every turn. It only happens when Codex compacts.

  The weak point:

  SessionStart runs when the session starts, but it does not create a user turn on its own. If
  you open Codex with no prompt, a long-running SessionStart watcher can stall startup, and when
  it eventually returns, Codex may only have added context for the next turn. The reliable
  autonomous trigger is still Stop, because Stop explicitly supports continuing the agent by
  returning decision: "block".

  So the robust design is:

  codex --profile watchnotes "Watch BlueprintTool open notes and treat them when they appear."
          |
          v
  SessionStart: add repo/watcher context, maybe check immediate notes
          |
          v
  Initial inference turn starts
          |
          v
  If no notes yet, assistant reaches Stop
          |
          v
  Stop hook blocks/watches until notes appear
          |
          v
  Stop hook returns decision:block with note payload
          |
          v
  Codex continues automatically
          |
          v
  Agent uses corev2-treat-open-notes
          |
          v
  Stop hook starts watching again

  I would implement this as a small launcher, not manual typing:

  codex --profile watchnotes \
    "Watch BlueprintTool open notes for this Ardaria workspace. When notes appear, use the
    corev2-treat-open-notes skill to process them, update card content when required, answer the
    threads, verify unanswered notes are closed, then wait again."

  Then the profile owns the hooks, and the launcher owns the one seed prompt. That gives you the
  “start watching directly” behavior without relying on you to remember a special message each
  time.

  I would not put the infinite watch in SessionStart; put it in Stop. Use SessionStart only for
  fast setup/context.

# OPERATOR
<!-- corev2:note {"id":"note-1781159567435-be4e8d3143b8f","timestamp":"2026-06-11T06:32:47.439Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781159567442-e71e5c95-ed23-48e0-89fb-3a4f43322689.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:32:47.445Z"} -->

Dans cette carte, on parle du nouveau système qu'on est en train de préparer pour arrêter de devoir dire à l'agent, à la station qui est ouverte, d'utiliser le skill treat open notes tout le temps, tout le temps, tout le temps, qui est du coup pas très agréable. Donc, là dans la carte, tu me remets au propre la logique qu'on a déterminée.

# AGENT
<!-- corev2:note {"id":"note-agent-1781159831336-b02e68f1","timestamp":"2026-06-11T06:37:11Z"} -->

Traité.

J'ai transformé la carte en `Watch Notes Loop` et remis au propre la logique décidée:

1. profil Codex dédié `watchnotes`;
2. launcher avec un seed prompt unique pour créer le premier vrai tour;
3. `SessionStart` limité au setup rapide;
4. boucle durable dans `Stop`, qui attend les notes puis retourne `decision: "block"`;
5. déclenchement automatique de `corev2-treat-open-notes`;
6. vérification des notes fermées, puis retour en attente;
7. pas de hardcoding workspace, résolution depuis le cwd.

La carte dit aussi explicitement pourquoi on ne met pas l'attente infinie dans `SessionStart`.

# OPERATOR
<!-- corev2:note {"id":"note-1781160045747-b76695a224f11","timestamp":"2026-06-11T06:40:45.753Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781160045754-7b426efc-fc7a-47de-8d60-988ba6e7d67c.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:40:45.772Z"} -->

Non, justement, le launcher ne doit pas prompter codex. Le point A3 est mauvais, non. Le launcher, il start la session codex, et comme on a le hook start, ou alors j'ai pas compris, mais dans l'idée, c'est le watcher, il se lance tout de suite sans avoir à lancer un prompt. Ça n'a pas de sens de devoir lancer un prompt, c'est de l'inférence perdue.

# OPERATOR
<!-- corev2:note {"id":"note-1781160101890-c72ac031937ec8","timestamp":"2026-06-11T06:41:41.894Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781160101897-468674a4-47f1-4772-a2eb-5eb3cabf5c52.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:41:41.899Z"} -->

Non, s'il n'y a pas de note qui existe, l'assistant il reach pas stop, le watcher il attend. Non, mais le profile, ça load le hook et ça lance le watcher tout de suite et il n'y a pas de session start. Non, t'as pas du tout compris là. On ne veut pas commencer avec de l'inférence. On veut commencer la session avec le watcher, en attendant qu'il y ait quelque chose.

# AGENT
<!-- corev2:note {"id":"note-agent-1781160377477-8c2e0d91","timestamp":"2026-06-11T06:46:17Z"} -->

Traité.

J'ai corrigé la carte `Watch Notes Loop` pour enlever le modèle faux:

1. plus de seed prompt;
2. plus de première inférence juste pour atteindre `Stop`;
3. le launcher démarre seulement la session avec le profil watcher;
4. le hook de start lance le watcher immédiatement;
5. quand il n'y a pas de note, le watcher attend hors inférence;
6. la première inférence n'arrive que quand une vraie note existe et que le watcher injecte le contexte de traitement.

La carte dit maintenant explicitement que l'attente appartient à la couche hook/watcher, pas à un tour assistant consommant du modèle.

# OPERATOR
<!-- corev2:note {"id":"note-1781160619211-21ff458f43964","timestamp":"2026-06-11T06:50:19.218Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781160619230-99421d99-4439-47cd-bb54-2157c27f750f.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:50:19.260Z"} -->

Sur le profile, il faudrait pouvoir donner quand même un argument. Non seulement il y a le CWD, ça c'est pas mal, mais en plus de ça, il faudrait pouvoir donner un argument qui serait le nom du ledger à regarder. Et pour ça, on pourrait imaginer en fait une tui, TUI, un terminal interface où on pourrait Quand on lance le watcher, d'abord ça va analyser les ledgers qu'il y a dans le repo. On peut sélectionner un ou plusieurs ledgers ou all, il y a une option pour all. Donc ça veut dire que le truc, on le lance dans le CWD, il va scanner Blueprint Tool, il regarde les ledgers qu'il y a, il remonte les ledgers qu'il y a dans l'interface. On peut sélectionner des ledgers et une fois qu'on a sélectionné des ledgers, on lance le watcher que sur ces ledgers-là. Comme ça, l'agent, on est capable, par exemple, si on a des leers qui sont avec des contextes vastement différents, on peut lancer trois agents et les trois agents en fait, même s'ils sont dans le même CWD, ils auront des notifications que sur leur ledger respectif. Ça, c'est vachement important. Donc ça, tu vas me faire une quatrième carte.

# OPERATOR
<!-- corev2:note {"id":"note-1781160629913-18101f7ff9a44","timestamp":"2026-06-11T06:50:29.915Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781160629916-8e81e09c-a930-426f-950f-6af21b99a4b8.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:50:29.922Z"} -->

Une cinquième carte, je veux dire.

# AGENT
<!-- corev2:note {"id":"note-agent-1781160714044-c7a91d2e","timestamp":"2026-06-11T06:51:54Z"} -->

Treated.

I added the fifth card, `Watcher Ledger Selection`, in the same Better Open Notes treatment area.

The card covers:

1. cwd remains the workspace root;
2. the watcher can additionally receive one ledger, multiple ledgers, or `all`;
3. if no ledger argument is passed, the launcher opens a TUI selector;
4. the TUI discovers ledgers from `.blueprinttool/state.json`, with a filesystem fallback;
5. selected ledger file paths become the watcher scope;
6. multiple watcher agents can run in the same cwd while watching different ledger sets.
