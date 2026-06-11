# OPERATOR
<!-- corev2:note {"id":"note-1781161902006-43c2093f6dae","timestamp":"2026-06-11T07:11:42.010Z","voiceFileRef":"/home/jbb/dev/EditorBP/CoreV2/.blueprinttool/voice-uploads/voice-1781161902013-310f9b67-28c6-4d76-950a-9045bedb4d36.wav","status":"transcribed","transcriptionStartedAt":"2026-06-11T07:11:42.015Z"} -->

Non, le pending text, c'est pending messages, pending operator messages, et c'est un array de strings. C'est important que chaque message, quand même, il soit contextualisé, qu'on les concatène pas vraiment, c'est juste on les met dans un array. Là, tu me changes juste ça dans la section B. Sinon, ouais, tu changes aussi la section A4 pour dire justement que ça doit être préservé de manière séparée. OK.

# AGENT
<!-- corev2:note {"id":"note-agent-1781162060453-d39e6a84","timestamp":"2026-06-11T07:14:20Z"} -->

Treated.

I updated `Lean Unanswered Payload` so pending operator messages are not concatenated:

1. section `A4` now says pending notes must remain separate strings in chronological order;
2. section `B` now uses `pendingOperatorMessages: string[]`;
3. the TypeScript comment explicitly says each array item is one operator message and must not be concatenated.
