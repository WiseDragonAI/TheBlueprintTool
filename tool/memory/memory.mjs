#!/usr/bin/env node
import process from 'node:process';
import { addMemory, migrateMemories, readMemories } from './memory-store.mjs';

const [, , command = 'list', ...argumentsList] = process.argv;
const option = (name) => {
  const index = argumentsList.indexOf(`--${name}`);
  return index >= 0 ? String(argumentsList[index + 1] ?? '').trim() : undefined;
};

const root = option('root');
if (!root) throw new Error('all commands require --root <server-launch-root>');

let output;
if (command === 'add') {
  output = await addMemory(root, {
    title: option('title'), body: option('body'), tag: option('tag'), subtag: option('subtag'),
    projectId: option('project'), type: option('type'), source: option('source'),
  });
} else if (command === 'list' || command === 'search') {
  output = await readMemories(root, {
    projectId: option('project'), type: option('type'), tag: option('tag'), subtag: option('subtag'),
    query: command === 'search' ? option('query') : '', limit: option('limit'),
  });
} else if (command === 'migrate') {
  output = await migrateMemories({
    root, source: option('source'), projectId: option('project'), type: option('type'),
  });
} else {
  throw new Error('Usage: memory.mjs add|list|search|migrate --root <server-launch-root> [--limit <positive-integer>] [options]');
}

console.log(JSON.stringify(output, null, 2));
