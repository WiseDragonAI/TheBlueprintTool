export function routeTab(path: string): string {
  const tab = path.split('/').filter(Boolean)[0];
  return ['surface', 'specs', 'runtime'].includes(tab) ? tab : 'surface';
}
