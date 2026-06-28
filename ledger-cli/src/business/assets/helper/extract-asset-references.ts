import type { AssetReferenceKind } from '../../../lib/types.js';
import { isManagedMediaPath } from './asset-policy.js';
import { normalizeAssetReference } from './workspace-paths.js';

export type ExtractedAssetReference = {
  kind: AssetReferenceKind;
  path: string;
};

function stripCodeFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

function parseMarkdownDestination(destination: string): string {
  const trimmed = destination.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end >= 0 ? trimmed.slice(1, end) : '';
  }
  const quoted = trimmed.match(/^"([^"]+)"|^'([^']+)'/);
  if (quoted) return quoted[1] ?? quoted[2] ?? '';
  return trimmed.split(/\s+/)[0] ?? '';
}

function addReference(
  output: ExtractedAssetReference[],
  input: { kind: AssetReferenceKind; rawReference: string; sourceFile: string; workspaceRoot: string },
): void {
  const path = normalizeAssetReference(input);
  if (!path || !isManagedMediaPath(path)) return;
  output.push({ kind: input.kind, path });
}

function collectJsonStrings(value: unknown, onString: (value: string, kind: 'json-key' | 'json-value') => void): void {
  if (typeof value === 'string') {
    onString(value, 'json-value');
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectJsonStrings(entry, onString);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      onString(key, 'json-key');
      collectJsonStrings(entry, onString);
    }
  }
}

export function extractHardAssetReferences(input: { content: string; sourceFile: string; workspaceRoot: string }): ExtractedAssetReference[] {
  const output: ExtractedAssetReference[] = [];

  if (input.sourceFile.endsWith('.json')) {
    return output;
  }

  const content = stripCodeFences(input.content);
  for (const match of content.matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    addReference(output, {
      ...input,
      kind: 'markdown-image',
      rawReference: parseMarkdownDestination(match[1] ?? ''),
    });
  }
  for (const match of content.matchAll(/::html\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    addReference(output, {
      ...input,
      kind: 'markdown-html-embed',
      rawReference: parseMarkdownDestination(match[1] ?? ''),
    });
  }
  for (const match of content.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    addReference(output, { ...input, kind: 'html-img', rawReference: match[1] ?? '' });
  }
  for (const match of content.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    addReference(output, { ...input, kind: 'html-script', rawReference: match[1] ?? '' });
  }
  for (const match of content.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    addReference(output, { ...input, kind: 'html-link', rawReference: match[1] ?? '' });
  }

  return output;
}

export function extractJsonAssetReferences(input: { content: string; sourceFile: string; workspaceRoot: string }): ExtractedAssetReference[] {
  const output: ExtractedAssetReference[] = [];
  if (!input.sourceFile.endsWith('.json')) return output;
  try {
    collectJsonStrings(JSON.parse(input.content), (rawReference, kind) => {
      addReference(output, { ...input, kind, rawReference });
    });
  } catch {
    return output;
  }
  return output;
}

export function extractSoftAssetReferences(input: { content: string; sourceFile: string; workspaceRoot: string }): ExtractedAssetReference[] {
  if (input.sourceFile.endsWith('.json')) return [];
  const output: ExtractedAssetReference[] = [];
  const content = stripCodeFences(input.content);
  for (const match of content.matchAll(/(?:^|[\s"'(<])((?:\/?\.blueprinttool|\.blueprinttool)\/[^\s"'<>),]+\.(?:css|gif|html|jpe?g|js|mjs|mov|mp4|png|svg|webm|webp))/gi)) {
    addReference(output, {
      ...input,
      kind: 'raw-media-mention',
      rawReference: match[1] ?? '',
    });
  }
  return output;
}
