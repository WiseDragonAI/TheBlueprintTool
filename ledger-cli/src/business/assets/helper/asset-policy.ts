import { extname } from 'node:path';

export const defaultManagedAssetRoots = [
  '.decision-os/cards',
  '.decision-os/card-images',
  '.decision-os/thread-images',
  '.decision-os/captures',
  '.decision-os/ui-research/verification',
  '.decision-os/ui-research/demos/generated',
];

export const riskyManagedAssetRoots: Record<string, string> = {
  'ui-mockups': '.decision-os/ui-mockups',
};

const managedAssetExtensions = new Set([
  '.css',
  '.gif',
  '.html',
  '.jpeg',
  '.jpg',
  '.js',
  '.mjs',
  '.mov',
  '.mp4',
  '.png',
  '.svg',
  '.webm',
  '.webp',
]);

export function isManagedMediaPath(path: string): boolean {
  return managedAssetExtensions.has(extname(path).toLowerCase());
}

export function managedAssetRoots(includeRisky: string[] = []): string[] {
  const riskyRoots = includeRisky.flatMap((entry) => {
    if (entry === 'all') return Object.values(riskyManagedAssetRoots);
    const root = riskyManagedAssetRoots[entry];
    return root ? [root] : [];
  });
  return Array.from(new Set([...defaultManagedAssetRoots, ...riskyRoots]));
}
