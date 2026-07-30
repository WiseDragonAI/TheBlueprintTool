/**
 * WHAT: Builds the pinned local CodeMirror and Pierre browser bundles and copies their licenses.
 * WHY: The editor and revision diff must not depend on a runtime CDN or unpinned package resolution.
 */
import { copyFile, readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const expected = {
  codemirror: '6.0.2',
  '@codemirror/lang-markdown': '6.5.1',
  '@pierre/diffs': '1.2.12',
};

for (const [name, version] of Object.entries(expected)) {
  if (packageJson.dependencies?.[name] !== version) {
    throw new Error(`${name} must remain pinned to ${version}.`);
  }
}

const common = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  supported: { 'template-literal': false },
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: [new URL('codemirror-vendor-entry.ts', import.meta.url).pathname],
  outfile: new URL('../assets/vendor/codemirror-6.0.2.js', import.meta.url).pathname,
});
await build({
  ...common,
  entryPoints: [new URL('../src/runtime/content-authoring/worker/authored-file-diff-worker.ts', import.meta.url).pathname],
  outfile: new URL('../assets/vendor/pierre-diff-worker-1.2.12.js', import.meta.url).pathname,
});
await build({
  ...common,
  entryPoints: [new URL('pierre-vendor-entry.ts', import.meta.url).pathname],
  outfile: new URL('../assets/vendor/pierre-diffs-1.2.12.js', import.meta.url).pathname,
});
await copyFile(
  new URL('../node_modules/codemirror/LICENSE', import.meta.url),
  new URL('../assets/vendor/codemirror-6.0.2.LICENSE', import.meta.url),
);
await copyFile(
  new URL('../node_modules/@pierre/diffs/LICENSE.md', import.meta.url),
  new URL('../assets/vendor/pierre-diffs-1.2.12.LICENSE', import.meta.url),
);
