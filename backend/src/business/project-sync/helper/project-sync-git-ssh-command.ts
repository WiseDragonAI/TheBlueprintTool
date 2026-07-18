import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function projectSyncGitSshCommand(settingsInput: unknown): string {
  const settings = settingsInput && typeof settingsInput === 'object' ? settingsInput as AnyRecord : {};
  const configured = String(
    process.env.DECISION_OS_PROJECT_SYNC_GIT_SSH_IDENTITY_FILE
      ?? settings.projectSyncGitSshIdentityFile
      ?? '',
  ).trim();
  if (!configured) return '';
  if (!isAbsolute(configured)) throw new Error('Project synchronization SSH identity path must be absolute.');
  const identityFile = resolve(configured);
  if (!existsSync(identityFile)) throw new Error('Project synchronization SSH identity file is unavailable.');
  return `ssh -i ${shellQuote(identityFile)} -o IdentitiesOnly=yes -o BatchMode=yes`;
}
