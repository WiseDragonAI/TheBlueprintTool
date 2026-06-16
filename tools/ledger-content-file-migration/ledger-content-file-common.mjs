import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

export function parseLedgerFiles(argv) {
  const files = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--label') {
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) continue;
    files.push(resolve(arg));
  }
  return files;
}

export function optionValue(argv, option) {
  const index = argv.indexOf(option);
  return index >= 0 && index < argv.length - 1 ? argv[index + 1] : undefined;
}

export function ledgerWorkspaceRoot(ledgerFile) {
  const dir = dirname(resolve(ledgerFile));
  if (basename(dir) !== '.blueprinttool') {
    throw new Error(`Ledger must live directly in a .blueprinttool directory: ${ledgerFile}`);
  }
  return dirname(dir);
}

export function blueprinttoolRoot(ledgerFile) {
  return join(ledgerWorkspaceRoot(ledgerFile), '.blueprinttool');
}

export function ledgerStem(ledgerFile) {
  return basename(ledgerFile, extname(ledgerFile));
}

export function safeSegment(value) {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

export function cardContentRef(ledgerFile, card) {
  const id = safeSegment(card.id);
  return `.blueprinttool/cards/${safeSegment(ledgerStem(ledgerFile))}/${id}.md`;
}

export function resolveContentRef(ledgerFile, contentRef) {
  const root = ledgerWorkspaceRoot(ledgerFile);
  const normalized = String(contentRef).replace(/^\.blueprinttool\//, '');
  return join(root, '.blueprinttool', normalized);
}

export async function readLedger(ledgerFile) {
  const text = await readFile(ledgerFile, 'utf8');
  return JSON.parse(text);
}

export async function writeLedger(ledgerFile, ledger) {
  await writeFile(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

export async function ensureParent(file) {
  await mkdir(dirname(file), { recursive: true });
}

export async function writeTextFile(file, content) {
  await ensureParent(file);
  await writeFile(file, content, 'utf8');
}

export async function sha256File(file) {
  const buffer = await readFile(file);
  return createHash('sha256').update(buffer).digest('hex');
}

export async function copyLedgerBackup(ledgerFile, backupDir) {
  await mkdir(backupDir, { recursive: true });
  const target = join(backupDir, basename(ledgerFile));
  await copyFile(ledgerFile, target);
  return {
    original: ledgerFile,
    backup: target,
    originalSha256: await sha256File(ledgerFile),
    backupSha256: await sha256File(target),
  };
}

export function cardComment(card) {
  return card && typeof card.comment === 'object' && !Array.isArray(card.comment) ? card.comment : {};
}

export function cardBody(card) {
  const comment = cardComment(card);
  return typeof comment.what === 'string' ? comment.what : undefined;
}

export function hasFile(path) {
  return existsSync(path);
}
