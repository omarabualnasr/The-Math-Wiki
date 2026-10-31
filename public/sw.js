/* Static-first service worker for GitHub Pages project sites. */
const CACHE_VERSION = 'math-wiki-pwa-v3';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

function appBase() {
  return new URL(self.registration.scope);
}

async function cacheAppShell(targetUrl) {
  const base = appBase();
  const shell = await caches.open(SHELL_CACHE);
  const candidates = [
    new URL('manifest.webmanifest', base).href,
    new URL('pwa-icon.svg', base).href,
    new URL('pwa-192.png', base).href,
    new URL('pwa-512.png', base).href,
  ];
  await Promise.allSettled(candidates.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await shell.put(url, response.clone());
  }));

  // Keep the previous cached entry page until every required new app bundle
  // asset has been fetched successfully. This preserves the last-known-good
  // offline version when a deployment is incomplete or storage is exhausted.
  const indexUrl = new URL('index.html', base).href;
  const indexResponse = await fetch(indexUrl, { cache: 'reload' }).catch(() => null);
  if (!indexResponse?.ok) return { ok: false, error: 'The application entry page could not be fetched.', targetUrl };
  const markup = await indexResponse.clone().text();
  const assetPaths = [...markup.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map((match) => match[1]);
  const assetUrls = [...new Set(assetPaths.map((assetPath) => new URL(assetPath, indexUrl).href).filter((url) => new URL(url).origin === self.location.origin))];
  const scriptUrls = assetUrls.filter((url) => /\.js(?:\?|$)/i.test(url));
  const styleUrls = assetUrls.filter((url) => /\.css(?:\?|$)/i.test(url));
  if (scriptUrls.length === 0) return { ok: false, error: 'The application entry page did not reference a local JavaScript bundle.', targetUrl };

  const assetCache = await caches.open(ASSET_CACHE);
  const assetResults = await Promise.allSettled(assetUrls.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`Could not cache ${url}`);
    await assetCache.put(url, response.clone());
    return url;
  }));
  const successfulAssets = assetResults.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const allScriptsCached = scriptUrls.every((url) => successfulAssets.includes(url));
  const allStylesCached = styleUrls.every((url) => successfulAssets.includes(url));
  if (!allScriptsCached || !allStylesCached) {
    return { ok: false, error: 'The application scripts or styles could not all be cached. The previous offline version was kept.', targetUrl };
  }

  await shell.put(indexUrl, indexResponse.clone());
  const currentAssets = new Set(assetUrls);
  await Promise.all((await assetCache.keys()).filter((request) => !currentAssets.has(request.url)).map((request) => assetCache.delete(request)));
  return { ok: true, cached: 1 + successfulAssets.length, targetUrl };
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const result = await cacheAppShell();
    if (!result.ok) throw new Error(result.error || 'Could not cache the application shell.');
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const currentCaches = [SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('math-wiki-pwa-') && !currentCaches.includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'CACHE_APP') {
    event.waitUntil(cacheAppShell(typeof message.url === 'string' ? message.url : undefined).then((result) => {
      event.ports?.[0]?.postMessage(result);
    }).catch((error) => event.ports?.[0]?.postMessage({ ok: false, error: error?.message || 'Offline caching failed.' })));
  }
  if (message.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // Do not replace the cached entry page on a normal navigation. The
        // update-safe CACHE_APP flow only promotes a new index after every
        // referenced JavaScript and CSS bundle has been cached successfully.
        return response;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(request))
          || (await cache.match(new URL('index.html', appBase()).href))
          || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.includes('/api/')) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
