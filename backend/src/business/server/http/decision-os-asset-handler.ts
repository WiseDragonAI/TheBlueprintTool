/**
 * WHAT: Serves authorized project-owned Decision OS assets.
 * WHY: Project media delivery is an HTTP capability and does not belong in application composition.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { contentTypeFor } from '../helper/content-type-for.js';

const decisionOsAssetPrefix = '/.decision-os/';
const allowedDecisionOsImageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
const allowedLedgerStaticAssetExtensions = ['.html', '.css', '.js', '.mjs', ...allowedDecisionOsImageExtensions];

function contentDisposition(filePath: string): string {
  const filename = basename(filePath).replace(/"/g, '');
  const type = contentTypeFor(filePath);
  const previewable = type.startsWith('image/')
    || type.startsWith('text/')
    || type === 'application/pdf'
    || type.startsWith('audio/')
    || type.startsWith('video/');
  return `${previewable ? 'inline' : 'attachment'}; filename="${filename}"`;
}

function isAllowedAsset(filePath: string, relativeAssetPath: string): boolean {
  const normalized = filePath.toLowerCase();
  if (allowedDecisionOsImageExtensions.some((extension) => normalized.endsWith(extension))) return true;
  const normalizedRelative = relativeAssetPath.split('\\').join('/');
  if (/^thread-files\/[^/]+\/.+/.test(normalizedRelative)) return true;
  return /^cards\/[^/]+\/assets\/.+/.test(normalizedRelative)
    && allowedLedgerStaticAssetExtensions.some((extension) => normalized.endsWith(extension));
}

export function tryServeDecisionOsAsset(input: {
  url: string;
  decisionOsRoot: string;
  response: ServerResponse;
}): boolean {
  let decodedUrl = '';
  try {
    decodedUrl = decodeURIComponent(input.url);
  } catch {
    decodedUrl = input.url;
  }
  if (!decodedUrl.startsWith(decisionOsAssetPrefix)) return false;

  const assetPath = resolve(input.decisionOsRoot, decodedUrl.slice(decisionOsAssetPrefix.length));
  const relativeAssetPath = relative(input.decisionOsRoot, assetPath);
  const isInsideDecisionOs = relativeAssetPath
    && !relativeAssetPath.startsWith('..')
    && !isAbsolute(relativeAssetPath);
  if (!isInsideDecisionOs || !isAllowedAsset(assetPath, relativeAssetPath) || !existsSync(assetPath)) {
    input.response.statusCode = 404;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, missing: decodedUrl }));
    return true;
  }

  input.response.setHeader('content-type', contentTypeFor(assetPath));
  if (/^thread-files\/[^/]+\/.+/.test(relativeAssetPath.split('\\').join('/'))) {
    input.response.setHeader('content-disposition', contentDisposition(assetPath));
  }
  input.response.setHeader('cache-control', 'no-store');
  input.response.end(readFileSync(assetPath));
  return true;
}
