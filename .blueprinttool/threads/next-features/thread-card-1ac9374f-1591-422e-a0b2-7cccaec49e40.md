# OPERATOR
<!-- corev2:note {"id":"note-1781159659689-c9ba1cf2d4d2d","timestamp":"2026-06-11T06:34:19.696Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781159659702-54919284-4472-4ffe-a27f-1c80779e8f92.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:34:19.706Z"} -->

Dans cette carte que tu vas traiter après la première carte où il faut remettre au propre la logique, ça va être au niveau des fonctionnalités qu'on a besoin sur le canvas, puisque quand on envoie une note dans un thread, la carte en question, elle passe en processing. Et en fait, l'idée, ça serait de pouvoir les mettre en tout process plutôt que processing, et ça les mettrait dans une file d'attente. Et ensuite, ce que je voudrais, c'est avoir un raccourci clavier qui permet de les passer en processing. Et quand elles passent en processing, le watcher qu'on est en train de créer, en fait, il se trigger, il arrête de watcher, il se trigger et il extrait, du coup, le contexte des cartes, des zones dans lesquelles les cartes sont, d'ailleurs. Ça sera intéressant. Et il extrait ce contexte-là et il l'envoie directement dans l'agent en inférence. Il va falloir retravailler sur le format. Donc ça, ça va être dans cette carte-là, tu vas me mettre le... Non, tu vas créer une autre carte dans la même zone, une troisième carte dans la même zone qui va être à propos du format qu'on utilise aujourd'hui pour le Ledger CLI API quand on fait la commande Unanswered. Qu'est-ce que l'agent reçoit comme contexte ?

# OPERATOR
<!-- corev2:note {"id":"note-1781159709625-b7279767982a88","timestamp":"2026-06-11T06:35:09.630Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781159709633-1b9531ef-7bab-47b5-8395-ce8af60d9212.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:35:09.635Z"} -->

Et dans cette carte, du coup, ce qu'on va faire, ça va être la préparation en fait du nouveau script, comment il va fonctionner, qu'est-ce qu'il va faire, avec du coup le contexte qu'on va vouloir donner. Non, pas avec le contexte, parce que le contexte, on va le mettre dans l'autre carte, dans la troisième carte qu'on est en train de créer. Et cette carte, du coup, ça va être à propos de ce changement de statut to process, processing, le raccourci clavier, et il faut afficher quelque part dans l'UI, je ne sais pas encore où, la liste des cartes qu'on doit process.

# OPERATOR
<!-- corev2:note {"id":"note-1781159764642-7ff0e0dd56c14","timestamp":"2026-06-11T06:36:04.645Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781159764649-90db5896-089d-4997-b2a2-db926314b6ca.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:36:04.656Z"} -->

En fait, le mieux pour afficher cette liste, c'est quand le layout, l'overlay de conversation de thread, il n'est pas affiché, et bien sur la droite du canvas, on a en floating une notification, en fait, avec le nombre de cartes qu'on doit traiter. Et si on clique sur ça, on peut l'expand ou le fermer. Et ça nous ouvre le layer de droite, mais ce que ça fait, c'est que ça nous fait la liste des cartes, en fait, qui vont être traitées, ce qui nous permet de juste de voir, mais c'est de toute façon, cette interface, elle n'est pas très très importante, mais bon, voilà quand même au moins qu'elle existe. Et le raccourci clavier, je pense que ce serait un contrôle S.

# OPERATOR
<!-- corev2:note {"id":"note-1781159778757-0745bd8306b058","timestamp":"2026-06-11T06:36:18.761Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781159778762-0b72d54d-6c42-4118-af57-049fb51d714e.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T06:36:18.765Z"} -->

Il faudra bien penser à updater les runbooks aussi, une fois qu'on fera l'implémentation. Donc tu fais une quatrième carte avec toute la liste des choses à faire.

# AGENT
<!-- corev2:note {"id":"note-agent-1781159831336-c83f5a42","timestamp":"2026-06-11T06:37:11Z"} -->

Treated.

I transformed this card into `Processing Queue UX` with:

1. the `to_process` status;
2. the explicit transition to `processing`;
3. the `Ctrl+S` shortcut;
4. the floating notification on the right side of the canvas when the thread overlay is not open;
5. the expandable list of cards to process;
6. triggering the watcher when cards move to `processing`;
7. clear separation from the context-format card.

I also created two cards in the same zone:

1. `Unanswered Context Payload`, to define what the agent receives from `ledger-cli unanswered` and the expected extended context: card, thread, zone, ledger, queue.
2. `Watcher Runbook Checklist`, to list the runbooks and tasks to update during implementation.
