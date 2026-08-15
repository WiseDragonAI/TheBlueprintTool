/**
 * WHAT: Writes the canonical dev setup receipt into worktree-owned Git metadata.
 * WHY: Provisioning evidence must survive without dirtying the repository checkout.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { devRoot } from '../config.mjs';
import { gitText } from './git-text.mjs';

export function writeDevManifest(receipt) {
  const gitDirectory = gitText(devRoot, ['rev-parse', '--absolute-git-dir']);
  const manifest = resolve(gitDirectory, 'decision-os-worktree.json');
  writeFileSync(manifest, `${JSON.stringify({ version: 1, ...receipt }, null, 2)}\n`);
  return manifest;
}
