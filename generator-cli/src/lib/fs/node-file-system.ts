/**
 * WHAT: Node filesystem adapter for generator-cli helpers and effects.
 * WHY: Tests inject this boundary while production code needs durable reads and writes.
 */
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { FileSystemPort } from '../types.js';

export const nodeFileSystem: FileSystemPort = {
  readFile(path) {
    return fs.readFile(path, 'utf8');
  },
  async writeFile(path, content) {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, content, 'utf8');
  },
  async mkdir(path) {
    await fs.mkdir(path, { recursive: true });
  },
  async rm(path) {
    await fs.rm(path, { recursive: true, force: true });
  },
  async exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },
  readdir(path) {
    return fs.readdir(path);
  },
  stat(path) {
    return fs.stat(path);
  },
};
