/**
 * WHAT: Defines the stable typed failure used by every worktree controller.
 * WHY: Callers need one error contract carrying a code, exit status, and optional recovery instruction.
 */

export class WorktreeCliError extends Error {
  constructor(code, message, exitCode = 2, instruction = '') {
    super(message);
    this.name = 'WorktreeCliError';
    this.code = code;
    this.exitCode = exitCode;
    this.instruction = instruction;
  }
}
