type SurfaceStylesheet = { id: string; href: string };
type SurfaceScript = { id: string; src: string };

export async function loadSurfaceStylesheets(stylesheets: SurfaceStylesheet[]): Promise<void> {
  await Promise.all(stylesheets.map(({ id, href }) => new Promise<void>((resolveLoad, rejectLoad) => {
    const existing = document.querySelector<HTMLLinkElement>(`#${id}`);
    if (existing?.sheet) {
      resolveLoad();
      return;
    }
    const link = existing ?? document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', () => resolveLoad(), { once: true });
    link.addEventListener('error', () => rejectLoad(new Error(`Unable to load stylesheet: ${href}`)), { once: true });
    if (!existing) document.head.append(link);
  })));
}

export async function loadSurfaceScripts(scripts: SurfaceScript[]): Promise<void> {
  for (const { id, src } of scripts) {
    const existing = document.querySelector<HTMLScriptElement>(`#${id}`);
    if (existing?.dataset.loaded === 'true') continue;
    await new Promise<void>((resolveLoad, rejectLoad) => {
      const script = existing ?? document.createElement('script');
      script.id = id;
      script.src = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolveLoad();
      }, { once: true });
      script.addEventListener('error', () => rejectLoad(new Error(`Unable to load script: ${src}`)), { once: true });
      if (!existing) document.head.append(script);
    });
  }
}
