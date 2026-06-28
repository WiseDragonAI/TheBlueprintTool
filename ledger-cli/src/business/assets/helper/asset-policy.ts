import { extname } from 'node:path';

export const defaultManagedAssetRoots = [
  '.blueprinttool/card-images',
  '.blueprinttool/thread-images',
  '.blueprinttool/captures',
  '.blueprinttool/ui-research/verification',
  '.blueprinttool/ui-research/demos/generated',
];

export const riskyManagedAssetRoots: Record<string, string> = {
  'ui-mockups': '.blueprinttool/ui-mockups',
};

const mediaExtensions = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp4',
  '.png',
  '.svg',
  '.webm',
  '.webp',
]);

export function isManagedMediaPath(path: string): boolean {
  return mediaExtensions.has(extname(path).toLowerCase());
}

export function managedAssetRoots(includeRisky: string[] = []): string[] {
  const riskyRoots = includeRisky.flatMap((entry) => {
    if (entry === 'all') return Object.values(riskyManagedAssetRoots);
    const root = riskyManagedAssetRoots[entry];
    return root ? [root] : [];
  });
  return Array.from(new Set([...defaultManagedAssetRoots, ...riskyRoots]));
}
