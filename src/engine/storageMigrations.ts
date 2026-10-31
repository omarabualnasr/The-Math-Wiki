import { safeStorageGet } from './safeStorage';

const STORAGE_SCHEMA_KEY = 'math-wiki:storage-schema-version';
export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

interface KeyMigration {
  from: string;
  to: string;
}

/** Legacy keys are copied, never removed, so older app builds remain recoverable. */
const LEGACY_KEY_MIGRATIONS: KeyMigration[] = [
  { from: 'mw-theme', to: 'math-wiki:settings:theme:v1' },
  { from: 'mw-reading-width', to: 'math-wiki:settings:reading-width:v1' },
  { from: 'mw-font-family', to: 'math-wiki:settings:font-family:v1' },
  { from: 'mw-font-size', to: 'math-wiki:settings:font-size:v1' },
  { from: 'mw-high-contrast', to: 'math-wiki:settings:high-contrast:v1' },
  { from: 'mw-focus-guide', to: 'math-wiki:settings:focus-guide:v1' },
  { from: 'mw:calculator-history:v1', to: 'math-wiki:calculator-history:v1' },
  { from: 'mw:calculator-angle-mode', to: 'math-wiki:calculator-angle-mode:v1' },
  { from: 'mw:geometry-constructions:v1', to: 'math-wiki:geometry-constructions:v1' },
];

export interface StorageMigrationResult {
  fromVersion: number;
  toVersion: number;
  copiedKeys: string[];
  completed: boolean;
}

/** Pure migration runner, accepting a Storage-like object for deterministic tests. */
export function applyStorageMigrations(storage: Pick<Storage, 'getItem' | 'setItem'>): StorageMigrationResult {
  const rawVersion = storage.getItem(STORAGE_SCHEMA_KEY);
  const parsedVersion = rawVersion === null ? 0 : Number(rawVersion);
  const fromVersion = Number.isInteger(parsedVersion) && parsedVersion >= 0 ? parsedVersion : 0;
  const copiedKeys: string[] = [];

  if (fromVersion >= CURRENT_STORAGE_SCHEMA_VERSION) {
    return { fromVersion, toVersion: fromVersion, copiedKeys, completed: true };
  }

  try {
    if (fromVersion < 1) {
      for (const migration of LEGACY_KEY_MIGRATIONS) {
        const existingTarget = storage.getItem(migration.to);
        const legacyValue = storage.getItem(migration.from);
        if (existingTarget === null && legacyValue !== null) {
          storage.setItem(migration.to, legacyValue);
          copiedKeys.push(migration.to);
        }
      }
    }
    storage.setItem(STORAGE_SCHEMA_KEY, String(CURRENT_STORAGE_SCHEMA_VERSION));
    return { fromVersion, toVersion: CURRENT_STORAGE_SCHEMA_VERSION, copiedKeys, completed: true };
  } catch {
    // Do not advance the schema marker after a partial migration. Retrying is safe
    // because existing destination values are never overwritten.
    return { fromVersion, toVersion: fromVersion, copiedKeys, completed: false };
  }
}

export function runStorageMigrations(): StorageMigrationResult | null {
  try {
    if (typeof window === 'undefined') return null;
    return applyStorageMigrations(window.localStorage);
  } catch {
    return null;
  }
}

/** Convenience wrapper for reading the version from the active browser store. */
export function getStorageSchemaVersion(): number {
  const raw = safeStorageGet(STORAGE_SCHEMA_KEY, '0');
  const version = Number(raw);
  return Number.isInteger(version) && version >= 0 ? version : 0;
}
