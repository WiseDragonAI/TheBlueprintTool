#!/usr/bin/env node
/**
 * WHAT: Saves the complete HTML response body from a URL to a local file.
 * WHY: Operators need a small repeatable tool for capturing route or page HTML.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const requestHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
};

function usage() {
  return 'Usage: save-html <url> <filename>';
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }
  const [url, filename] = argv;
  if (!url || !filename || argv.length !== 2) {
    return { error: usage() };
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: `Invalid URL: ${url}` };
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { error: `Unsupported URL protocol: ${parsedUrl.protocol}` };
  }
  return { url: parsedUrl, filename };
}

function curlHeaderArgs(headers) {
  if (!headers) return [];
  return [
    '--user-agent',
    headers['user-agent'],
    '--header',
    `Accept: ${headers.accept}`,
    '--header',
    `Accept-Language: ${headers['accept-language']}`
  ];
}

async function saveWithFetch(url, outputPath, headers) {
  const response = await fetch(url, headers ? { headers } : undefined);
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status} ${response.statusText}`.trim());
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
  return { outputPath, bytes: bytes.length, finalUrl: response.url };
}

async function saveWithCurl(url, outputPath, headers) {
  const { stdout } = await execFileAsync('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--compressed',
    '--output',
    outputPath,
    '--write-out',
    '%{url_effective}',
    ...curlHeaderArgs(headers),
    String(url)
  ], { encoding: 'utf8' });
  const file = await stat(outputPath);
  return { outputPath, bytes: file.size, finalUrl: stdout.trim() || String(url) };
}

function errorMessage(error) {
  const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
  return stderr || (error instanceof Error ? error.message : String(error));
}

async function saveHtml(url, filename) {
  const outputPath = resolve(filename);
  await mkdir(dirname(outputPath), { recursive: true });
  const attempts = [
    ['curl', () => saveWithCurl(url, outputPath)],
    ['curl with browser headers', () => saveWithCurl(url, outputPath, requestHeaders)],
    ['fetch', () => saveWithFetch(url, outputPath)],
    ['fetch with browser headers', () => saveWithFetch(url, outputPath, requestHeaders)]
  ];
  const errors = [];
  for (const [label, attempt] of attempts) {
    try {
      return await attempt();
    } catch (error) {
      errors.push(`${label}: ${errorMessage(error)}`);
    }
  }
  throw new Error(errors.join('; '));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.error) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await saveHtml(args.url, args.filename);
    console.log(`Saved ${result.bytes} bytes from ${result.finalUrl} to ${result.outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
