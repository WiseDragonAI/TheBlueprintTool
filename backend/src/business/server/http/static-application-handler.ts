/**
 * WHAT: Serves frontend modules, shared schemas, application routes, and legacy ledger redirects.
 * WHY: Static delivery and compatibility routing are the final ordered HTTP fallback, not server composition.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isAbsolute, relative, resolve } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import { contentTypeFor } from '../helper/content-type-for.js';
import { decodeRouteSegment } from './route-segment.js';

export function serveStaticApplication(input: {
  frontendRoot: string;
  projectScope: { scopedPath: string } | null;
  projects: readonly DecisionOsProject[];
  request: IncomingMessage;
  requestPath: string;
  response: ServerResponse;
  url: string;
}): void {
  const isFrontendModuleRoute = input.url.startsWith('/assets/') || input.url.startsWith('/src/');
  const isSharedModuleRoute = input.url.startsWith('/shared/');
  const isStaticModuleRoute = isFrontendModuleRoute || isSharedModuleRoute;
  const routeTabId = input.url.split('/').filter(Boolean)[0] ?? '';

  if (!input.projectScope
    && input.request.method === 'GET'
    && routeTabId
    && !['projects', 'projects-canvas', 'ledgers', 'pipelines', 'skills', 'status', 'settings', 'control-room', 'done'].includes(routeTabId)) {
    const matches = input.projects.filter((project) => project.ledgers.some((ledger) => ledger.id === routeTabId));
    if (matches.length === 1) {
      const fallbackProject = matches[0]!;
      const routeParts = input.requestPath.split('/').filter(Boolean).map(decodeRouteSegment);
      let destination = `/p/${encodeURIComponent(fallbackProject.id)}/ledgers/${encodeURIComponent(routeParts[0]!)}`;
      if (routeParts[1] === 'zone' && routeParts[2]) {
        destination += `/zones/${encodeURIComponent(routeParts[2])}`;
      }
      if (routeParts[3] === 'card' && routeParts[4]) {
        destination += `/cards/${encodeURIComponent(routeParts[4])}`;
      }
      input.response.statusCode = 302;
      input.response.setHeader('location', destination);
      input.response.end();
      return;
    }
    if (matches.length > 1) {
      input.response.statusCode = 409;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: 'Ambiguous legacy ledger URL. Use a project-scoped URL.',
        projectIds: matches.map((project) => project.id),
      }));
      return;
    }
  }

  const isGlobalAppRoute = input.requestPath === '/'
    || input.requestPath === '/projects'
    || input.requestPath === '/projects-canvas'
    || /^\/projects\/[^/]+$/.test(input.requestPath)
    || input.requestPath === '/ledgers'
    || input.requestPath === '/done'
    || input.requestPath === '/pipelines'
    || input.requestPath === '/skills'
    || /^\/skills\/[^/]+(?:\/edit)?$/.test(input.requestPath)
    || input.requestPath === '/status'
    || input.requestPath === '/settings';
  const isScopedAppRoute = Boolean(input.projectScope?.scopedPath.startsWith('/ledgers'));
  const isAppRoute = isGlobalAppRoute || isScopedAppRoute;
  const staticModuleRoot = isSharedModuleRoute
    ? resolve(input.frontendRoot, '..', 'shared')
    : input.frontendRoot;
  const staticModuleRequest = isSharedModuleRoute
    ? input.url.slice('/shared/'.length)
    : input.url.slice(1);
  const requestedPath = isStaticModuleRoute
    ? resolve(staticModuleRoot, staticModuleRequest)
    : resolve(input.frontendRoot, 'index.html');
  const relativeStaticModulePath = relative(staticModuleRoot, requestedPath);
  const isSafeStaticModulePath = !isStaticModuleRoute
    || Boolean(relativeStaticModulePath
      && !relativeStaticModulePath.startsWith('..')
      && !isAbsolute(relativeStaticModulePath));
  const assetPath = existsSync(requestedPath) ? requestedPath : requestedPath.replace(/\.js$/, '.ts');

  if ((isAppRoute || isStaticModuleRoute) && isSafeStaticModulePath && existsSync(assetPath)) {
    input.response.setHeader('content-type', contentTypeFor(assetPath));
    input.response.setHeader('cache-control', 'no-store');
    const source = readFileSync(assetPath, 'utf8');
    input.response.end(assetPath.endsWith('.ts')
      ? transpileModule(source, {
        compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 },
      }).outputText
      : source);
    return;
  }

  input.response.setHeader('content-type', 'application/json');
  input.response.end(JSON.stringify({ ok: true, method: input.request.method, url: input.url }));
}
