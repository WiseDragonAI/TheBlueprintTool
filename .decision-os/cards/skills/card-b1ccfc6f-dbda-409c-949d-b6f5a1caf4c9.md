## A. Scope

1. **Source material:** compared the two public prompt files referenced by the operator: `OpenAI/gpt-5.5-thinking.md` and `Anthropic/claude-fable-5.md` from `https://github.com/asgeirtj/system_prompts_leaks`.
2. **Local analysis copy:** fetched both files into `/tmp/system_prompts_leaks` for complete structural review: `OpenAI/gpt-5.5-thinking.md` has `1,991` lines and `Anthropic/claude-fable-5.md` has `3,825` lines.
3. **Authenticity limit:** treat both files as public repository artifacts, not independently verified vendor system prompts.
4. **Copyright and confidentiality limit:** the full prompt text was used for analysis, but this card does not reproduce the complete source prompts verbatim.
5. **Operator question:** identify the strengths of each system, especially what `Claude Fable 5` contains that is absent or weaker in `GPT-5.5 Thinking`, with emphasis on software engineering, planning, implementation, architecture, and design-system behavior.

---

## B. Executive Thesis

1. **GPT-5.5 Thinking architecture:** the OpenAI prompt reads like a compact runtime contract for a general ChatGPT surface. It emphasizes tool schemas, web freshness, citations, multimodal handling, artifact handoff, scheduled automations, memory/user settings, and response style.
2. **Claude Fable 5 architecture:** the Anthropic prompt reads like a larger assistant operating system. It defines product identity, safety subdomains, memory policy, persistent artifact storage, MCP app routing, past-chat retrieval, preference application, skills-first computer use, file lifecycle, visual routing, search strategy, and deferred tool loading.
3. **Core difference:** `GPT-5.5 Thinking` is stronger as a lean execution surface with precise tool and citation mechanics; `Claude Fable 5` is stronger as a planned agent workflow framework with more explicit lifecycle rules.
4. **Most important Fable advantage:** Fable has a deeper task-routing and implementation framework before execution: `skills -> file strategy -> artifact criteria -> MCP/internal tool priority -> visualizer routing -> search scaling -> output sharing`.
5. **Most important GPT advantage:** GPT has a less bloated prompt, clearer web citation syntax, first-class utilities like `finance`, `sports`, `weather`, `time`, `automations`, and strong platform-specific UI widget guidance.

---

## C. Shared System Design Patterns

1. **Tool-first runtime:** both prompts define concrete tool schemas and constrain when tools should be used.
2. **Freshness gate:** both require web/search for current, unstable, or niche information rather than relying on static model knowledge.
3. **Citation discipline:** both include citation/copyright constraints for sourced answers.
4. **Artifact support:** both support generated files or UI artifacts, but with different routing models.
5. **Personalization:** both include memory, preferences, or user-context application with limits.
6. **Multimodal support:** both include image or visual-generation pathways, though Fable separates visual routing more explicitly.
7. **Style control:** both prompts include tone, verbosity, and response-format instructions.

---

## D. GPT-5.5 Strengths Not Fully Matched By Fable

1. **Compact prompt surface:** GPT carries fewer top-level behavioral modules. This reduces instruction collision risk and leaves more context for the user task.
2. **Precise citation grammar:** GPT specifies exact web citation syntax, source reference handling, placement rules, and line/file citation expectations for uploaded or searched documents.
3. **First-class utility APIs:** GPT exposes structured commands for `finance`, `sports`, `weather`, `time`, `calculator`, product search, image search, and web search in one unified `web.run` style.
4. **Scheduled work model:** GPT has an explicit `automations` namespace for future or recurring tasks, including schedule constraints and failure handling. Fable's prompt does not expose an equivalent automation subsystem in the inspected file.
5. **Canvas and document iteration:** GPT includes `canmore` behavior for long-lived editable canvases and code/document textdocs. Fable uses file/artifact creation, but the OpenAI canvas model is more directly oriented toward iterative in-chat documents.
6. **User settings controls:** GPT exposes user-facing controls such as `user_settings`, `bio`, `personal_context`, and memory update flows in the runtime tool stack.
7. **Direct platform widgets:** GPT's rich UI sections define when to show image carousels, product carousels, navigation lists, weather widgets, sports widgets, stock charts, and math widgets.
8. **Lower procedural overhead:** GPT has fewer mandatory preflight steps. For simple tasks, this can produce faster answers and fewer self-imposed detours.
9. **Better directness rules:** GPT has strong style constraints such as avoiding meta-commentary, avoiding specific filler phrases, and keeping responses readable without overusing lists.

---

## E. Claude Fable 5 Strengths Not Fully Matched By GPT-5.5

1. **Agent operating system structure:** Fable uses explicit XML-like modules such as `claude_behavior`, `memory_system`, `computer_use`, `request_evaluation_checklist`, `search_instructions`, and tool sections. This makes the prompt more modular and easier to reason about as a product architecture.
2. **Product ecosystem routing:** Fable knows how to position `Claude Code`, `Claude Cowork`, `Claude in Chrome`, `Claude in Excel`, and `Claude in PowerPoint`, and can recommend apps when a task fits a specialized product surface.
3. **Skills-first implementation discipline:** before creating files, writing code, or running computer tools, Fable requires reading relevant `SKILL.md` files. This is a strong engineering control because it turns hidden environment knowledge into an explicit preflight step.
4. **File lifecycle contract:** Fable specifies when to create files, where uploads live, where scratch work belongs, where final outputs belong, when to use `present_files`, and how to choose between inline answers and durable artifacts.
5. **Artifact architecture:** Fable defines artifact criteria, supported artifact types, single-file expectations for HTML/React, package rules, and restrictions such as avoiding unsupported browser storage APIs.
6. **Persistent artifact storage:** Fable includes a `window.storage` API with key design, shared/private scope, failure handling, and progressive loading guidance. GPT's inspected prompt does not provide an equivalent persistent artifact storage design.
7. **Visual routing DAG:** Fable has a request-evaluation checklist: decide whether a visual is needed, prefer a connected MCP tool when it fits, use file tools when a file is requested, otherwise use the Visualizer. This is closer to product-grade UX routing than GPT's image/widget guidance.
8. **Design-system-aware visualizer:** Fable requires loading visualizer modules such as `diagram`, `mockup`, `interactive`, `data_viz`, `art`, and `chart`, and treats CSS variables, dimensions, typography, and layout rules as authoritative design context.
9. **MCP connector governance:** Fable has a detailed registry and opt-in policy for third-party MCP apps, including when to search for connectors, when to suggest them, when to call them directly, and when to fall back to browser/search.
10. **Past-chat retrieval heuristics:** Fable provides detailed linguistic cues for when to search prior conversations, how to form compact search queries, and how to synthesize snippets without exposing irrelevant personal details.
11. **Memory application policy:** Fable has a full memory subsystem: when to apply memory, when not to, forbidden phrases, examples, direct factual question handling, emotional boundaries, and a separate memory-edit tool guide.
12. **Wellbeing and interpersonal boundaries:** Fable has more detailed user-wellbeing, criticism, abuse, mental-health, and self-destructive-behavior handling than GPT's inspected prompt.
13. **Safety granularity:** Fable contains highly granular child-safety, weapons, harmful substances, malicious-code, legal/financial, political evenhandedness, copyright, and harmful-search constraints.
14. **Search scaling model:** Fable distinguishes one-search facts, medium research, deep research, internal-tool precedence, search query construction, source fetching, and when to suggest a research feature.
15. **Implementation planning primitives:** Fable gives concrete triggers such as when `>10` lines of code should become a file, when long content should be built iteratively, and when to verify tool availability.

---

## F. Software Engineering Implications

1. **Preflight quality:** Fable is stronger for implementation tasks that require environment-specific constraints because the prompt makes skill discovery mandatory before code/file work.
2. **Artifact reliability:** Fable is stronger for generated deliverables because it defines scratch paths, output paths, sharing behavior, artifact type selection, persistence, and rendering constraints.
3. **Architecture diagrams and product UX:** Fable is stronger for visual architecture work because it has an explicit visual-routing DAG and design-system module loading before rendering.
4. **Connector-based workflows:** Fable is stronger for productized agent workflows that touch calendars, email, tasks, issue trackers, apps, or partner services because it specifies connector discovery and consent.
5. **Long-horizon personalization:** Fable is stronger for continuity across conversations because it separates memory, past-chat search, preferences, and contextual application.
6. **Simple execution speed:** GPT is stronger for low-complexity tasks because it avoids mandatory broad preflight checks and has a smaller instruction stack.
7. **Web-grounded answers:** GPT is stronger when exact citation mechanics, source references, and UI result widgets matter more than agentic workflow planning.
8. **Scheduled operations:** GPT is stronger for reminders and recurring tasks because `automations` is a first-class runtime subsystem.

---

## G. Planning And Implementation Comparison

1. **GPT planning model:** GPT relies on concise tool rules and general honesty/factuality constraints. It plans implicitly unless a task requires tools, citations, artifacts, or automation.
2. **Fable planning model:** Fable defines explicit routing layers before execution: skill selection, file-vs-inline decision, MCP-vs-visualizer decision, search depth, internal-vs-web source priority, and output sharing.
3. **GPT implementation model:** GPT is optimized for direct tool invocation with strong schemas. It is efficient when the correct tool is obvious.
4. **Fable implementation model:** Fable is optimized for repeatable delivery workflows. It gives the assistant a process for producing files, code, artifacts, visuals, and connector-backed actions with fewer missing lifecycle steps.
5. **GPT verification model:** GPT emphasizes source trust, citations, and honesty about failed work.
6. **Fable verification model:** Fable adds implementation-specific verification: check tool availability, handle storage errors, show loading states, and present final files through the correct output channel.

---

## H. Architecture And Design-System Comparison

1. **GPT architecture style:** schema-first, tool-list-heavy, platform-feature-oriented, and compact.
2. **Fable architecture style:** module-first, lifecycle-heavy, product-surface-aware, and procedural.
3. **GPT design-system posture:** supports generated images and rich UI widgets, but mostly through individual feature instructions.
4. **Fable design-system posture:** treats visuals as a routed product surface with module-specific constraints, CSS variables, layout rules, platform targeting, and proactive visualization triggers.
5. **GPT artifact posture:** supports documents, spreadsheets, slides, canvas, and generated artifacts, but the inspected prompt does not define a full artifact storage API.
6. **Fable artifact posture:** treats artifacts as software products with persistence, storage keys, loading/error states, package constraints, and output delivery.

---

## I. Fable 5 Additions Over GPT-5.5

1. **More complete agent workflow stack:** Fable adds a clear chain from task classification to tool selection to file/artifact output.
2. **More implementation guardrails:** Fable adds mandatory skills, package-management notes, file-location rules, output-sharing rules, and artifact criteria.
3. **More product-surface intelligence:** Fable adds app recommendation and product routing across chat, code, coworking, browser, spreadsheet, and slides surfaces.
4. **More memory governance:** Fable adds detailed rules for applying memory, searching past chats, avoiding meta-memory language, and handling memory edits.
5. **More visual product design:** Fable adds visualizer routing, module loading, proactive visualization, multi-visual sequencing, and design constraints.
6. **More connector policy:** Fable adds registry search, connector suggestion, third-party opt-in, and internal-tool priority.
7. **More persistent app architecture:** Fable adds `window.storage` for artifacts, including key design, shared scope, and failure handling.
8. **More safety specificity:** Fable has more granular domain-specific safety sections and refusal rules.
9. **More explicit research scaling:** Fable tells the model how many searches/tools to use for simple, medium, deep, and excessive research tasks.

---

## J. Risks And Tradeoffs

1. **Fable prompt bloat risk:** the prompt is nearly twice as long as the GPT file. More instructions can mean more context pressure, more conflicts, and slower task startup.
2. **Fable over-process risk:** mandatory skill reads before code/files/bash can improve quality, but may be excessive for trivial commands or quick diagnostics.
3. **Fable product-marketing risk:** embedding product family claims and app recommendations in the core prompt can age quickly and may create stale behavior.
4. **Fable conflict risk:** artifact storage guidance and browser-storage restrictions can conflict depending on the execution surface.
5. **GPT under-specification risk:** GPT's compact prompt leaves more lifecycle decisions implicit, which can cause weaker file routing, less systematic design output, or missed preflight steps.
6. **GPT product workflow gap:** GPT has many tools, but less explicit governance for connector selection, app routing, and user consent around third-party services.

---

## K. Recommendations For Decision-OS Prompt Engineering

1. **Borrow Fable's lifecycle DAG:** add explicit routing for `inline answer -> card update -> repo edit -> generated artifact -> visual mockup -> server action`.
2. **Borrow Fable's skills preflight selectively:** require skill reads for file/code/artifact/UI work, but avoid making every shell command pay that cost.
3. **Borrow Fable's artifact contract:** define scratch paths, final paths, render/verify steps, storage constraints, and sharing rules for decision-os outputs.
4. **Borrow Fable's visual routing:** before making mockups or diagrams, decide whether the deliverable is a card prose update, standalone image, HTML/CSS mockup, Mermaid/SVG diagram, or repo UI change.
5. **Borrow Fable's connector consent model:** if decision-os later integrates external tools, define `discover -> suggest -> explicit operator choice -> execute` for third-party actions.
6. **Keep GPT's compactness:** do not copy Fable's full breadth. Convert useful Fable behavior into small, decision-os-specific contracts.
7. **Keep GPT's citation rigor:** maintain exact source handling, line references, and explicit uncertainty when source authenticity is not verified.
8. **Avoid anti-specs:** every prompt rule added to decision-os should introduce a concrete requirement, constraint, decision, evidence rule, or action.

---

## L. Direct Answer

1. **What Fable 5 has that GPT-5.5 does not:** Fable has a more complete agent engineering framework: `skills`, `file_creation_advice`, `artifact_usage_criteria`, `persistent_storage_for_artifacts`, `mcp_app_suggestions`, `past_chats_tools`, `memory_application_examples`, `request_evaluation_checklist`, `visualizer` modules, and detailed search-scaling rules.
2. **What GPT-5.5 has that Fable 5 does not emphasize as strongly:** GPT has a cleaner tool/citation runtime, first-class automation, richer utility widgets, and less prompt overhead.
3. **Best software-engineering interpretation:** GPT is a strong general execution interface; Fable is a stronger planning-and-delivery scaffold for complex agentic work.
4. **Best architectural takeaway:** use Fable's lifecycle and routing concepts, but compress them into decision-os-specific rules so the system gains implementation rigor without inheriting the full prompt bloat.
