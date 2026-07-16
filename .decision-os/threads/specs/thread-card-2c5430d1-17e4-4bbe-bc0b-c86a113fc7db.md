# OPERATOR
<!-- decision-os:note {"id":"note-1783941575744-7dfa7dac178a3","timestamp":"2026-07-13T11:19:36.697Z"} -->

![Screenshot_20260713_181919_Brave.jpg](/.decision-os/thread-files/thread-card-2c5430d1-17e4-4bbe-bc0b-c86a113fc7db/file-1783941576653-58968b65ca4c3-Screenshot_20260713_181919_Brave.jpg)

# OPERATOR
<!-- decision-os:note {"id":"note-1783941595072-15103922083e48","timestamp":"2026-07-13T11:19:55.576Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783941595551-8d3d7859-a7d2-4c48-8ec7-415a0bc671ce.wav","status":"transcribed","transcriptionStartedAt":"2026-07-13T11:19:55.582Z","uploadReceivedAt":"2026-07-13T11:19:55.548Z","audioPersistedAt":"2026-07-13T11:19:55.554Z","acceptedAt":"2026-07-13T11:19:55.555Z","providerStartedAt":"2026-07-13T11:19:55.582Z","providerSettledAt":"2026-07-13T11:20:06.224Z","completedAt":"2026-07-13T11:20:06.246Z","revision":4} -->

Le backtick, il a été mis dans du fonte Consolas alors qu'on veut que ce soit toujours la même fonte, la fonte de base et jamais une fonte Consolas. Le backtick, c'est uniquement la couleur, ça a déjà été dit et répété. Je ne comprends pas pourquoi on a des régressions là-dessus.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783942020360-b2aeb2aa","timestamp":"2026-07-13T11:27:00.369Z"} -->

Implemented and verified the inline-code font correction on both card surfaces.

1. **Root cause:** Desktop card inline-code rules explicitly selected `--mono`; the mobile rule omitted a font declaration and inherited the browser's default monospace styling for `code`.
2. **Correction:** Inline code in desktop card titles, desktop card bodies, and mobile card bodies now uses `font-family: inherit`. The existing color treatment remains unchanged. Fenced code blocks remain monospace.
3. **Verification:** The focused desktop suite passed `6/6`, the focused mobile suite passed `36/36`, frontend typecheck passed, and `git diff --check` passed.
4. **Live evidence:** The running `50150` server returned `200` for the mobile stylesheet. Chromium computed both inline code and adjacent prose as `Ubuntu, system-ui, sans-serif`, while fenced code computed as `monospace`.
5. **Delivery:** The source changes are committed and merged into `main` in merge commits `e16825c` and `84b4b34`.

The linked implementation subtask is `done`. The master task remains `#task-active` because master completion was not authorized.
