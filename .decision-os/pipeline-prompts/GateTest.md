You have several {{CLI_TOOLS}} at your disposition. 
Your role is to use them and explain me what the master task is about

Read the context, run a product_analysis skill in a sub agent in low effort gpt 5.6 luna.

Then update the master-task using the exec-summary skill.

{{MASTER_TASK}}

{{FULL_THREAD}}

{{PREVIOUS_SKILL_RESULT}}

{{EXECUTION_CONTEXT}}


a plan about the migration
code quality, over engineering, bloat analysis - BUT preserve ALL features and
behavior

Tasks, group tasks and symbols+files to changes, why to change them, what to
change

implementation
test run -> group failures, investigate with subagents in low effort in parallel
for group investigation

once all reports, fix all at once
run tests around the failures only - loop on fix. Never fix / ru nsequentially,
always grouped

run all tests again
code quality again
commit and lessons / teachings about avoidable issues