import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeAssetReference } from './workspace-paths.js';

export type AssetKeepRule = {
  pattern: string;
  regex: RegExp;
};

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function keepPatternToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/^\/+/, '');
  let regex = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        regex += '.*';
        index += 1;
      } else {
        regex += '[^/]*';
      }
      continue;
    }
    regex += escapeRegex(character);
  }
  regex += '$';
  return new RegExp(regex);
}

export async function readAssetsKeep(input: { workspaceRoot: string }): Promise<AssetKeepRule[]> {
  const keepFile = resolve(input.workspaceRoot, '.decision-os/assets.keep');
  if (!await exists(keepFile)) return [];
  const content = await fs.readFile(keepFile, 'utf8');
  return content.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => normalizeAssetReference({ rawReference: line, workspaceRoot: input.workspaceRoot }) ?? line.replace(/^\/+/, ''))
    .map((pattern) => ({ pattern, regex: keepPatternToRegex(pattern) }));
}

export function matchesKeepRule(path: string, rules: AssetKeepRule[]): boolean {
  return rules.some((rule) => rule.regex.test(path));
}
