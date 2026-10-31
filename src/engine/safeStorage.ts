/** Best-effort browser storage helpers. The app remains usable when storage is
 * blocked by privacy settings, quota limits, or an embedded-browser policy. */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function safeStorageGet(key: string, fallback: string | null = null): string | null {
  try {
    if (typeof window === 'undefined') return fallback;
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Parse JSON without allowing malformed or unexpected persisted values through. */
export function safeStorageGetJson<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  try {
    const raw = safeStorageGet(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function safeStorageSetJson(key: string, value: unknown): boolean {
  try {
    return safeStorageSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/** A real write/read/remove probe; no persistent application data is changed. */
export function probeLocalStorage(): boolean {
  const key = `math-wiki:storage-probe:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(key, 'ok');
    const passed = window.localStorage.getItem(key) === 'ok';
    window.localStorage.removeItem(key);
    return passed;
  } catch {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      // Storage is blocked; there is nothing more the app can safely do.
    }
    return false;
  }
}

export interface BrowserStorageDiagnostics {
  localStorageAvailable: boolean;
  originUsage?: number;
  originQuota?: number;
}

/** StorageManager estimates apply to the whole site origin, not only this app. */
export async function inspectBrowserStorage(): Promise<BrowserStorageDiagnostics> {
  const diagnostics: BrowserStorageDiagnostics = { localStorageAvailable: probeLocalStorage() };
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === 'number' && Number.isFinite(estimate.usage)) diagnostics.originUsage = estimate.usage;
      if (typeof estimate.quota === 'number' && Number.isFinite(estimate.quota)) diagnostics.originQuota = estimate.quota;
    }
  } catch {
    // Quota estimates are optional and may be unavailable in private contexts.
  }
  return diagnostics;
}
