export interface InstallPromptChoice { outcome: 'accepted' | 'dismissed' | 'unavailable' }

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let pendingInstall: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pendingInstall = event as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    pendingInstall = null;
    installListeners.forEach((listener) => listener());
  });
}

export function subscribeInstallAvailability(listener: () => void): () => void {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
}

export function canPromptInstall(): boolean { return pendingInstall !== null; }

export async function promptAppInstall(): Promise<InstallPromptChoice> {
  if (!pendingInstall) return { outcome: 'unavailable' };
  const prompt = pendingInstall;
  pendingInstall = null;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installListeners.forEach((listener) => listener());
    return { outcome: choice.outcome };
  } catch {
    installListeners.forEach((listener) => listener());
    return { outcome: 'unavailable' };
  }
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return null;
  try {
    const scriptUrl = new URL('sw.js', document.baseURI);
    return await navigator.serviceWorker.register(scriptUrl, { scope: './', updateViaCache: 'none' });
  } catch {
    return null;
  }
}

export async function cacheApplicationForOffline(targetUrl = window.location.href): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return { ok: false, error: 'Offline support is not available in this browser.' };
  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
    if (!worker) return { ok: false, error: 'The offline worker is not active yet. Reload once while online and try again.' };
    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve({ ok: false, error: 'Offline caching took too long. Check your connection and try again.' }), 15000);
      channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean; error?: string }>) => {
        window.clearTimeout(timeout);
        resolve({ ok: event.data?.ok === true, error: event.data?.error });
        channel.port1.close();
      };
      worker.postMessage({ type: 'CACHE_APP', url: targetUrl }, [channel.port2]);
    });
  } catch {
    return { ok: false, error: 'The application could not prepare offline storage.' };
  }
}
