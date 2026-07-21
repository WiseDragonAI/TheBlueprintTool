# OPERATOR
<!-- decision-os:note {"id":"note-1783947394559-f51439b2bf51f8","timestamp":"2026-07-13T12:56:34.691Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1783947394671-c572dc1b-dcd6-45cc-b742-437f2571609b.wav","status":"transcribed","transcriptionStartedAt":"2026-07-13T12:56:34.694Z","uploadReceivedAt":"2026-07-13T12:56:34.670Z","audioPersistedAt":"2026-07-13T12:56:34.675Z","acceptedAt":"2026-07-13T12:56:34.676Z","providerStartedAt":"2026-07-13T12:56:34.694Z","providerSettledAt":"2026-07-13T12:56:39.749Z","completedAt":"2026-07-13T12:56:39.773Z","revision":4} -->

Il y a un runbook dans le rootset de la home, donc pas dans Decision OS, il faut que tu remontes d'un directory, qui explique comment lancer Chromium quand on est sur le téléphone, quand on est en mode mobile. Il faut que tu rapatries ce runbook aussi dans le CWD Decision OS et que tu le références dans le agents.md pour ne pas se retrouver dans les mêmes problèmes qui ont fait crasher le serveur. Alors bon, tu ne trouveras pas ces informations-là, mais ce n'est pas important. Ce qui est important, c'est d'utiliser Chromium correctement sur le mobile quand on veut faire des tests et faire des captures d'écran.

# AGENT
<!-- decision-os:note {"id":"note-agent-1783947667352-60411110","timestamp":"2026-07-13T13:01:07.368Z"} -->

Added `BROWSER_RUNBOOK.md` to the `decision-os` repository and linked it as mandatory guidance from `AGENTS.md` for phone-based Chromium tests, debugging, automation, and screenshots.

The local runbook uses the verified shared helper at `../tool/browser/browse.js`, the Chromium binary at `/data/data/com.termux/files/usr/bin/chromium-browser`, and preserves `--no-sandbox`, `--no-zygote`, `--single-process`, `--disable-dev-shm-usage`, and `--disable-gpu`. It also prohibits browser preparation from restarting, stopping, replacing, or launching the Decision OS server.

Verification found Chromium `138.0.7204.168`, the shared helper, and `puppeteer-core` on this device. The documentation is committed as `336dd9c`. Chromium was not launched and the Decision OS server was not restarted or stopped. The master task and linked subtask remain active because this run did not receive explicit card-completion authorization.
