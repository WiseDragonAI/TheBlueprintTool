# OPERATOR
<!-- decision-os:note {"id":"note-1783696519787-5ccc31207d7df","timestamp":"2026-07-10T15:15:19.789Z"} -->

For mobile
One card with 2 tabs
Edited document
Conversation

Use codex headless with session synthesis and warm agents.md 

Cards in todo, operator stack
Move to bottom for cards you dont wanna treat.

Tasks for sequential prompts.

Link to a file and show the git diff
https://diffs.com/

Select a zone of text and send it as context with line number and quote in the thread

Stage lines directly from card like git kraken. 

Use groups as sub canvas to lighten the main canvas. Can nest any number of canvas.

Split cards with a tool to select where to split. Or auto split by section

Tool to export the whole canvas.

Tool to ask questions and propose answers like in senior.

View list of pending cards to process

Auto git versioning after a turn

Video embedding

Mobile version

Team and users, collaborate with people.

Authentication

Better ledger organization in the right panel as vertical list instead of tab header

Create header from within app

General ledger thread not assigned to zone or card to send notes that should be contextualized in existind card or in a new card. Agent has to know what to update and where.

Upload files to card

Audio player

Iframe in card to show html linked files

For consecutive audio file, adjust the number of columns in grid automagic, no carousel

Adjust volume per file for sfx

Column sorting on tables

Use tanstack/virtual for scroll thread

Add an exec button to treat with codex exec, if cache is old, summarize the conversation with cheap model then start a new session.

Open file from card, in a modal

Ctrl z to rewind history

Grouping zones creates a new canvas that we can zoom in and out to switch canvas and offer an infinite zoomable surface

Task list, so I can tell the agent to add some general tasks to the ledger, without being linked to a card. It can be some research or general ledger work touching multiple cards.

Link card or zone to sqlite database

Render html into cards so we can have custom views which doesn't need to be integrated in the codebase. Arbitrary html fed with arbitrary data

Mobile interface to take vocal notes from app + threads like droid master

Integration custom html

Mobile app and deployment

The decision UX on mobile is crucial. Ability to show me any context, at least with images, web, file system, diffs.

# OPERATOR
<!-- decision-os:note {"id":"note-1783696541258-c458064e06563","timestamp":"2026-07-10T15:15:41.268Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1783696541268-e8d42e19-504c-4d4b-a239-2fb997e35ac1.wav","status":"transcribed","transcriptionStartedAt":"2026-07-10T15:15:41.268Z"} -->

Je veux que tu me mettes cette carte au propre en prenant ce que j'ai mis dans le thread et tu me découpes bien ça en sections pour faire une liste propre. Tu regardes si on n'a pas déjà fait des choses, parce que là dans cette liste, je crois qu'il y a des choses qui sont déjà faites.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783696821063-54420750","timestamp":"2026-07-10T22:20:21+07:00"} -->

## A. Result

1. **Card rewritten:** Replaced the placeholder with a structured, mobile-first feature inventory covering mobile decisions, operator workflow, Codex execution, Git and file context, nested canvases, media, custom data, collaboration, and security.
2. **Duplicates merged:** Consolidated repeated mobile requirements, pending-card queue requests, nested-canvas ideas, and custom HTML requests without dropping distinct capabilities.
3. **Existing work separated:** Marked headless Codex, threads, voice transcription, file and image thread uploads, Markdown media, sandboxed HTML embeds, groups, card statuses, ledger creation, and card tabs as verified foundations. Sequential Codex pipelines are identified as implemented in the current worktree.
4. **Boundary preserved:** Card status and ledger JSON were not changed. The ambiguous phrase `Create header from within app` remains in one clarification item instead of being interpreted without evidence.

## B. Verification

1. **Focused checks:** `36` frontend tests and `19` backend tests passed across the cited card rendering, status, ledger navigation, upload, voice, headless Codex, and sequential pipeline behavior.
