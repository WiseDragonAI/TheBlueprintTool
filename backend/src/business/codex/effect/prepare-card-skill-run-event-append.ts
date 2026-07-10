/**
 * WHAT: Repairs a Codex JSONL continuation boundary and returns its existing physical line count.
 * WHY: Appended continuation events need stable source-line IDs even when the prior run omitted its final newline.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export function prepareCardSkillRunEventAppend(stdoutFile: string): number {
  // WHAT: Start new continuation artifacts at physical line zero.
  // WHY: The child process may not have created its stdout file yet.
  if (!existsSync(stdoutFile)) return 0;
  const rawContent = readFileSync(stdoutFile, 'utf8');
  const content = rawContent.replace(/\r\n?/g, '\n');
  // WHAT: Keep an empty artifact unchanged.
  // WHY: No continuation separator is needed before the first event.
  if (!content) return 0;
  const lineCount = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
  // WHAT: Terminate an incomplete final line before the child appends new JSONL.
  // WHY: Two physical events must never be concatenated into one invalid JSON value.
  if (!/[\r\n]$/.test(rawContent)) appendFileSync(stdoutFile, '\n', 'utf8');
  return lineCount;
}
