import { loadLearningState, saveLearningState, isLearningState, type LearningState } from './learningStorage';
import { loadPersonalWorkspace, replacePersonalWorkspace, isPersonalWorkspaceState, type PersonalWorkspaceState } from './personalWorkspaceStorage';
import { createZipArchive, extractStoredZipArchive } from './zipArchive';

export const BACKUP_CATEGORIES = [
  'articles', 'bookmarks', 'annotations', 'drawings', 'learning', 'calculator',
  'geometry', 'workspace', 'settings', 'search', 'article-history', 'other',
] as const;
export type BackupCategory = typeof BACKUP_CATEGORIES[number];

interface BackupEntry { category: BackupCategory; key: string; value: string }
interface WorkspaceBackupBundle {
  format: 'math-wiki-personal-workspace-backup';
  version: 1;
  createdAt: string;
  entries: BackupEntry[];
  learningState: LearningState;
  workspaceState: PersonalWorkspaceState;
}

export interface WorkspaceBackupPreview {
  createdAt: string;
  counts: Record<BackupCategory, number>;
  totalEntries: number;
  fileName: string;
  bundle: WorkspaceBackupBundle;
}

const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const BACKUP_FILE_NAME = 'workspace-backup.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function classifyBackupKey(key: string): BackupCategory {
  if (key === 'math-wiki:articles:v1') return 'articles';
  if (key.includes('bookmarks')) return 'bookmarks';
  if (key.includes('annotations')) return 'annotations';
  if (key.includes('drawings')) return 'drawings';
  if (key.includes('learning')) return 'learning';
  if (key.includes('calculator')) return 'calculator';
  if (key.includes('geometry')) return 'geometry';
  if (key.includes('personal-workspace')) return 'workspace';
  if (key.includes(':settings:')) return 'settings';
  if (key.includes(':search:')) return 'search';
  if (key.includes('article-history')) return 'article-history';
  return 'other';
}

function emptyCounts(): Record<BackupCategory, number> {
  return Object.fromEntries(BACKUP_CATEGORIES.map((category) => [category, 0])) as Record<BackupCategory, number>;
}

function validateBackupBundle(value: unknown): WorkspaceBackupBundle {
  if (!isRecord(value) || value.format !== 'math-wiki-personal-workspace-backup' || value.version !== 1
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || !Array.isArray(value.entries) || value.entries.length > 20000
    || !isLearningState(value.learningState) || !isPersonalWorkspaceState(value.workspaceState)) {
    throw new Error('This file is not a valid Mathematics Wiki backup.');
  }
  const seen = new Set<string>();
  const entries: BackupEntry[] = [];
  for (const item of value.entries) {
    if (!isRecord(item) || typeof item.key !== 'string' || !item.key.startsWith('math-wiki:')
      || item.key.includes('storage-probe') || typeof item.value !== 'string' || item.value.length > MAX_BACKUP_BYTES
      || !BACKUP_CATEGORIES.includes(item.category as BackupCategory) || classifyBackupKey(item.key) !== item.category
      || seen.has(item.key)) throw new Error('The backup contains an invalid or duplicate storage entry.');
    seen.add(item.key);
    entries.push({ category: item.category as BackupCategory, key: item.key, value: item.value });
  }
  return {
    format: 'math-wiki-personal-workspace-backup', version: 1, createdAt: value.createdAt,
    entries, learningState: value.learningState, workspaceState: value.workspaceState,
  };
}

function readLocalEntries(): BackupEntry[] {
  if (typeof window === 'undefined') return [];
  const entries: BackupEntry[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith('math-wiki:') || key.includes('storage-probe')) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) entries.push({ category: classifyBackupKey(key), key, value });
    }
  } catch { throw new Error('Browser storage is restricted. Allow local storage before creating a complete backup.'); }
  return entries;
}

export async function createWorkspaceBackupBlob(): Promise<Blob> {
  const bundle: WorkspaceBackupBundle = {
    format: 'math-wiki-personal-workspace-backup', version: 1, createdAt: new Date().toISOString(),
    entries: readLocalEntries(), learningState: await loadLearningState(), workspaceState: await loadPersonalWorkspace(),
  };
  const json = new TextEncoder().encode(JSON.stringify(bundle));
  if (json.byteLength > MAX_BACKUP_BYTES) throw new Error('The backup is larger than 80 MB. Export fewer large drafts or images first.');
  return createZipArchive([{ name: BACKUP_FILE_NAME, data: json }]);
}

export async function inspectWorkspaceBackup(file: File): Promise<WorkspaceBackupPreview> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('This backup is larger than the allowed 80 MB.');
  const entries = extractStoredZipArchive(await file.arrayBuffer(), { maxBytes: MAX_BACKUP_BYTES, maxEntries: 100 });
  const manifest = entries.find((entry) => entry.name === BACKUP_FILE_NAME);
  if (!manifest) throw new Error('The ZIP does not contain a Mathematics Wiki backup manifest.');
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifest.data)); }
  catch { throw new Error('The backup manifest is not valid JSON.'); }
  const bundle = validateBackupBundle(parsed);
  const counts = emptyCounts();
  bundle.entries.forEach((entry) => { counts[entry.category] += 1; });
  counts.learning += bundle.learningState.attempts.length + bundle.learningState.flashcards.length;
  counts.workspace += bundle.workspaceState.lists.length + bundle.workspaceState.sessions.length + bundle.workspaceState.offlineArticleIds.length;
  return { createdAt: bundle.createdAt, counts, totalEntries: bundle.entries.length, fileName: file.name, bundle };
}

export async function restoreWorkspaceBackup(preview: WorkspaceBackupPreview, selected: BackupCategory[]): Promise<void> {
  const bundle = validateBackupBundle(preview.bundle);
  const chosen = new Set(selected);
  if (!chosen.size) throw new Error('Select at least one data category to restore.');
  if (typeof window === 'undefined') throw new Error('Backup restoration requires a browser.');

  const previousLearning = chosen.has('learning') ? await loadLearningState() : null;
  const previousWorkspace = chosen.has('workspace') ? await loadPersonalWorkspace() : null;
  const before: Array<{ key: string; value: string }> = [];
  const affectedKeys = new Set<string>();
  const incoming = bundle.entries.filter((entry) => chosen.has(entry.category));
  incoming.forEach((entry) => affectedKeys.add(entry.key));

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith('math-wiki:') || key.includes('storage-probe')) continue;
      if (chosen.has(classifyBackupKey(key))) {
        const value = window.localStorage.getItem(key);
        if (value !== null) before.push({ key, value });
        affectedKeys.add(key);
      }
    }

    const incomingKeys = new Set(incoming.map((entry) => entry.key));
    [...affectedKeys].filter((key) => !incomingKeys.has(key)).forEach((key) => window.localStorage.removeItem(key));
    incoming.forEach((entry) => window.localStorage.setItem(entry.key, entry.value));

    if (chosen.has('learning')) await saveLearningState(bundle.learningState);
    if (chosen.has('workspace')) await replacePersonalWorkspace(bundle.workspaceState);
  } catch {
    // Roll back both existing and newly introduced keys. This matters when a
    // quota error occurs midway through restoring a category with new keys.
    try {
      affectedKeys.forEach((key) => window.localStorage.removeItem(key));
      before.forEach((entry) => window.localStorage.setItem(entry.key, entry.value));
    } catch { /* The browser may also prevent rollback writes when storage is full/restricted. */ }
    try { if (previousLearning) await saveLearningState(previousLearning); } catch { /* Best-effort IndexedDB rollback. */ }
    try { if (previousWorkspace) await replacePersonalWorkspace(previousWorkspace); } catch { /* Best-effort IndexedDB rollback. */ }
    throw new Error('Restore could not be completed. Existing values were restored where possible; check browser storage availability and quota before trying again.');
  }

  window.dispatchEvent(new CustomEvent('math-wiki:workspace-restored', { detail: { categories: [...chosen] } }));
}

export function downloadBackupBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mathematics-wiki-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
