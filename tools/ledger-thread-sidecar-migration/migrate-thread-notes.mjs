#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

const metadataPrefix = '<!-- corev2:note ';
const metadataSuffix = ' -->';

function safeSegment(value) {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function parseLedgerFiles(argv) {
  return argv.filter((arg) => !arg.startsWith('--')).map((arg) => resolve(arg));
}

function ledgerWorkspaceRoot(ledgerFile) {
  const dir = dirname(resolve(ledgerFile));
  if (basename(dir) !== '.blueprinttool') throw new Error(`Ledger must live directly in .blueprinttool: ${ledgerFile}`);
  return dirname(dir);
}

function threadContentRef(ledgerFile, threadId) {
  return `.blueprinttool/threads/${safeSegment(basename(ledgerFile, extname(ledgerFile)))}/${safeSegment(threadId)}.md`;
}

function resolveContentRef(ledgerFile, contentRef) {
  return join(ledgerWorkspaceRoot(ledgerFile), contentRef.replace(/^\.\//, ''));
}

function noteRole(note) {
  const role = String(note?.role ?? '').toLowerCase();
  return role === 'agent' || role === 'assistant' ? 'AGENT' : 'OPERATOR';
}

function metadataFor(note) {
  const metadata = {};
  for (const key of ['id', 'timestamp', 'voiceFileRef', 'status', 'transcriptionStartedAt', 'error']) {
    if (typeof note?.[key] === 'string' && note[key]) metadata[key] = note[key];
  }
  return metadata;
}

function formatThreadMarkdown(notes) {
  return `${notes.map((note) => {
    const body = String(note?.message ?? note?.body ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    return [`# ${noteRole(note)}`, `${metadataPrefix}${JSON.stringify(metadataFor(note))}${metadataSuffix}`, '', body].join('\n').replace(/\n+$/g, '');
  }).join('\n\n')}\n`;
}

const ledgerFiles = parseLedgerFiles(process.argv.slice(2));
const force = process.argv.includes('--force');

if (ledgerFiles.length === 0) {
  console.error('Usage: migrate-thread-notes.mjs [--force] <ledger.json>...');
  process.exit(1);
}

const summaries = [];
for (const ledgerFile of ledgerFiles) {
  const ledger = JSON.parse(await readFile(ledgerFile, 'utf8'));
  const notes = ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? ledger.notes : {};
  const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles) ? ledger.threadFiles : {};
  let migrated = 0;
  let skipped = 0;

  for (const [threadId, threadNotes] of Object.entries(notes)) {
    if (!Array.isArray(threadNotes) || threadNotes.length === 0) {
      delete notes[threadId];
      skipped += 1;
      continue;
    }
    const ref = threadFiles[threadId] ?? threadContentRef(ledgerFile, threadId);
    const outputFile = resolveContentRef(ledgerFile, ref);
    const markdown = formatThreadMarkdown(threadNotes);
    if (existsSync(outputFile) && !force) {
      const existing = await readFile(outputFile, 'utf8');
      if (existing !== markdown) throw new Error(`Refusing to overwrite changed thread file: ${outputFile}`);
    }
    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, markdown, 'utf8');
    threadFiles[threadId] = ref;
    delete notes[threadId];
    migrated += 1;
  }

  ledger.threadFiles = threadFiles;
  ledger.notes = notes;
  await writeFile(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  summaries.push({ ledgerFile, migrated, skipped });
}

console.log(JSON.stringify({ ok: true, summaries }, null, 2));
