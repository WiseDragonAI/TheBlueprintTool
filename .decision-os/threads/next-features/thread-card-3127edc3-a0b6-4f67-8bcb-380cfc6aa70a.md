# OPERATOR
<!-- decision-os:note {"id":"note-1781159532169-7e07196999f62","timestamp":"2026-06-11T06:32:12.170Z"} -->

• Assessment: profile is the right control surface, but SessionStart cannot fully replace an
  initial turn by itself.

  What works well:

  1. Profile enables watcher hooks only for watcher sessions.
  2. SessionStart hook loads watcher context and can do a quick unanswered-note check.
  3. Stop hook is the durable loop: after each inference turn, it waits for notes, returns
     decision: "block", and Codex continues with a prompt to use decision-os-treat-open-notes.

  4. PreCompact / PostCompact can log or preserve state, but compaction is not guaranteed after
     every turn. It only happens when Codex compacts.

  The weak point:

  SessionStart runs when the session starts, but it does not create a user turn on its own. If
  you open Codex with no prompt, a long-running SessionStart watcher can stall startup, and when
  it eventually returns, Codex may only have added context for the next turn. The reliable
  autonomous trigger is still Stop, because Stop explicitly supports continuing the agent by
  returning decision: "block".

  So the robust design is:

  codex --profile watchnotes "Watch decision-os open notes and treat them when they appear."
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
  Agent uses decision-os-treat-open-notes
          |
          v
  Stop hook starts watching again

  I would implement this as a small launcher, not manual typing:

  codex --profile watchnotes \
    "Watch decision-os open notes for this Ardaria workspace. When notes appear, use the
    decision-os-treat-open-notes skill to process them, update card content when required, answer the
    threads, verify unanswered notes are closed, then wait again."

  Then the profile owns the hooks, and the launcher owns the one seed prompt. That gives you the
  “start watching directly” behavior without relying on you to remember a special message each
  time.

  I would not put the infinite watch in SessionStart; put it in Stop. Use SessionStart only for
  fast setup/context.

# OPERATOR
<!-- decision-os:note {"id":"note-1781159567435-be4e8d3143b8f","timestamp":"2026-06-11T06:32:47.439Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781159567442-e71e5c95-ed23-48e0-89fb-3a4f43322689.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:32:47.445Z"} -->

Dans cette carte, on parle du nouveau système qu'on est en train de préparer pour arrêter de devoir dire à l'agent, à la station qui est ouverte, d'utiliser le skill treat open notes tout le temps, tout le temps, tout le temps, qui est du coup pas très agréable. Donc, là dans la carte, tu me remets au propre la logique qu'on a déterminée.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781159831336-b02e68f1","timestamp":"2026-06-11T06:37:11Z"} -->

Treated.

I transformed the card into `Watch Notes Loop` and cleaned up the decided logic:

1. dedicated Codex profile `watchnotes`;
2. launcher with one seed prompt to create the first real turn;
3. `SessionStart` limited to fast setup;
4. durable loop in `Stop`, waiting for notes and then returning `decision: "block"`;
5. automatic triggering of `decision-os-treat-open-notes`;
6. verification that notes are closed, then return to waiting;
7. no hardcoded workspace, resolution from the cwd.

The card also states explicitly why the infinite wait does not belong in `SessionStart`.

# OPERATOR
<!-- decision-os:note {"id":"note-1781160045747-b76695a224f11","timestamp":"2026-06-11T06:40:45.753Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781160045754-7b426efc-fc7a-47de-8d60-988ba6e7d67c.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:40:45.772Z"} -->

Non, justement, le launcher ne doit pas prompter codex. Le point A3 est mauvais, non. Le launcher, il start la session codex, et comme on a le hook start, ou alors j'ai pas compris, mais dans l'idée, c'est le watcher, il se lance tout de suite sans avoir à lancer un prompt. Ça n'a pas de sens de devoir lancer un prompt, c'est de l'inférence perdue.

# OPERATOR
<!-- decision-os:note {"id":"note-1781160101890-c72ac031937ec8","timestamp":"2026-06-11T06:41:41.894Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781160101897-468674a4-47f1-4772-a2eb-5eb3cabf5c52.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:41:41.899Z"} -->

Non, s'il n'y a pas de note qui existe, l'assistant il reach pas stop, le watcher il attend. Non, mais le profile, ça load le hook et ça lance le watcher tout de suite et il n'y a pas de session start. Non, t'as pas du tout compris là. On ne veut pas commencer avec de l'inférence. On veut commencer la session avec le watcher, en attendant qu'il y ait quelque chose.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781160377477-8c2e0d91","timestamp":"2026-06-11T06:46:17Z"} -->

Treated.

I corrected the `Watch Notes Loop` card to remove the wrong model:

1. no seed prompt;
2. no first inference just to reach `Stop`;
3. the launcher only starts the session with the watcher profile;
4. the start hook launches the watcher immediately;
5. when there is no note, the watcher waits outside inference;
6. the first inference only happens when a real note exists and the watcher injects the treatment context.

The card now states explicitly that waiting belongs to the hook/watcher layer, not to an assistant turn that consumes model work.

# OPERATOR
<!-- decision-os:note {"id":"note-1781160619211-21ff458f43964","timestamp":"2026-06-11T06:50:19.218Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781160619230-99421d99-4439-47cd-bb54-2157c27f750f.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:50:19.260Z"} -->

Sur le profile, il faudrait pouvoir donner quand même un argument. Non seulement il y a le CWD, ça c'est pas mal, mais en plus de ça, il faudrait pouvoir donner un argument qui serait le nom du ledger à regarder. Et pour ça, on pourrait imaginer en fait une tui, TUI, un terminal interface où on pourrait Quand on lance le watcher, d'abord ça va analyser les ledgers qu'il y a dans le repo. On peut sélectionner un ou plusieurs ledgers ou all, il y a une option pour all. Donc ça veut dire que le truc, on le lance dans le CWD, il va scanner decisionOs, il regarde les ledgers qu'il y a, il remonte les ledgers qu'il y a dans l'interface. On peut sélectionner des ledgers et une fois qu'on a sélectionné des ledgers, on lance le watcher que sur ces ledgers-là. Comme ça, l'agent, on est capable, par exemple, si on a des leers qui sont avec des contextes vastement différents, on peut lancer trois agents et les trois agents en fait, même s'ils sont dans le même CWD, ils auront des notifications que sur leur ledger respectif. Ça, c'est vachement important. Donc ça, tu vas me faire une quatrième carte.

# OPERATOR
<!-- decision-os:note {"id":"note-1781160629913-18101f7ff9a44","timestamp":"2026-06-11T06:50:29.915Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1781160629916-8e81e09c-a930-426f-950f-6af21b99a4b8.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:50:29.922Z"} -->

Une cinquième carte, je veux dire.

# AGENT
<!-- decision-os:note {"id":"note-agent-1781160714044-c7a91d2e","timestamp":"2026-06-11T06:51:54Z"} -->

Treated.

I added the fifth card, `Watcher Ledger Selection`, in the same Better Open Notes treatment area.

The card covers:

1. cwd remains the workspace root;
2. the watcher can additionally receive one ledger, multiple ledgers, or `all`;
3. if no ledger argument is passed, the launcher opens a TUI selector;
4. the TUI discovers ledgers from `.decision-os/state.json`, with a filesystem fallback;
5. selected ledger file paths become the watcher scope;
6. multiple watcher agents can run in the same cwd while watching different ledger sets.
