import { safeStorageGet, safeStorageSetJson } from './safeStorage';

export type WorkspaceListKind = 'collection' | 'reading-list';
export type WorkspaceSessionKind = 'graph' | 'geometry' | 'calculator';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface WorkspaceList {
  id: string;
  kind: WorkspaceListKind;
  name: string;
  description: string;
  articleIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSession {
  id: string;
  kind: WorkspaceSessionKind;
  name: string;
  payload: { [key: string]: JsonValue };
  createdAt: string;
  updatedAt: string;
}

export interface PersonalWorkspaceState {
  version: 1;
  /** Last successful snapshot time, used to reconcile IndexedDB and fallback storage. */
  updatedAt?: string;
  lists: WorkspaceList[];
  sessions: WorkspaceSession[];
  offlineArticleIds: string[];
}

const DB_NAME = 'math-wiki-personal-workspace';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
export const WORKSPACE_FALLBACK_KEY = 'math-wiki:personal-workspace:v1';
const EMPTY_STATE: PersonalWorkspaceState = { version: 1, lists: [], sessions: [], offlineArticleIds: [] };
const SESSION_KINDS = new Set<WorkspaceSessionKind>(['graph', 'geometry', 'calculator']);
const LIST_KINDS = new Set<WorkspaceListKind>(['collection', 'reading-list']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 12) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 20000 && value.every((item) => isJsonValue(item, depth + 1));
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 5000 && entries.every(([key, item]) => key.length <= 240 && isJsonValue(item, depth + 1));
}

function isList(value: unknown): value is WorkspaceList {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 && LIST_KINDS.has(value.kind as WorkspaceListKind)
    && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 100
    && typeof value.description === 'string' && value.description.length <= 1000
    && Array.isArray(value.articleIds) && value.articleIds.length <= 10000 && value.articleIds.every((id) => typeof id === 'string')
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt));
}

function isSession(value: unknown): value is WorkspaceSession {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 && SESSION_KINDS.has(value.kind as WorkspaceSessionKind)
    && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 100
    && isRecord(value.payload) && isJsonValue(value.payload)
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt));
}

export function isPersonalWorkspaceState(value: unknown): value is PersonalWorkspaceState {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.lists) || !Array.isArray(value.sessions) || !Array.isArray(value.offlineArticleIds)) return false;
  if (value.updatedAt !== undefined && (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)))) return false;
  if (value.lists.length > 500 || value.sessions.length > 1000 || value.offlineArticleIds.length > 20000) return false;
  if (!value.lists.every(isList) || !value.sessions.every(isSession) || !value.offlineArticleIds.every((id) => typeof id === 'string' && id.length > 0)) return false;
  const ids = [...value.lists.map((item) => item.id), ...value.sessions.map((item) => item.id)];
  return new Set(ids).size === ids.length;
}

function makeId(prefix: string): string {
  return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

function readFallback(): PersonalWorkspaceState {
  const raw = safeStorageGet(WORKSPACE_FALLBACK_KEY);
  if (raw === null) return EMPTY_STATE;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Saved personal workspace fallback is not valid JSON and was left untouched.'); }
  if (!isPersonalWorkspaceState(parsed)) throw new Error('Saved personal workspace fallback failed validation and was left untouched.');
  return parsed;
}
function writeFallback(state: PersonalWorkspaceState): boolean { return safeStorageSetJson(WORKSPACE_FALLBACK_KEY, state); }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable.')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open personal workspace storage.'));
    request.onblocked = () => reject(new Error('Personal workspace storage is blocked by another browser tab.'));
  });
}

async function readDatabase(): Promise<PersonalWorkspaceState | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('main');
      request.onsuccess = () => {
        if (request.result == null) resolve(null);
        else if (isPersonalWorkspaceState(request.result)) resolve(request.result);
        else reject(new Error('Saved personal workspace data failed validation and was left untouched.'));
      };
      request.onerror = () => reject(request.error || new Error('Could not read the personal workspace.'));
    });
  } finally { database.close(); }
}

async function writeDatabase(state: PersonalWorkspaceState): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(state, 'main');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save the personal workspace.'));
      transaction.onabort = () => reject(transaction.error || new Error('Personal workspace save was aborted.'));
    });
  } finally { database.close(); }
}

function snapshotTime(state: PersonalWorkspaceState): number {
  return state.updatedAt ? Date.parse(state.updatedAt) : 0;
}

/** Select the newest valid copy when IndexedDB and the local fallback diverge. */
export function selectNewestPersonalWorkspace(
  databaseState: PersonalWorkspaceState | null,
  fallbackState: PersonalWorkspaceState,
): PersonalWorkspaceState {
  if (!databaseState) return fallbackState;
  return snapshotTime(fallbackState) > snapshotTime(databaseState) ? fallbackState : databaseState;
}

export async function loadPersonalWorkspace(): Promise<PersonalWorkspaceState> {
  let databaseState: PersonalWorkspaceState | null = null;
  let databaseReadable = true;
  try {
    databaseState = await readDatabase();
  } catch (error) {
    // A malformed IndexedDB record must not be silently replaced by an empty fallback.
    if (error instanceof Error && error.message.includes('failed validation')) throw error;
    databaseReadable = false;
  }

  const fallback = readFallback();
  const selected = selectNewestPersonalWorkspace(databaseState, fallback);
  const normalized = selected.updatedAt ? selected : { ...selected, updatedAt: new Date().toISOString() };

  // Keep both stores synchronized. If IndexedDB is unavailable, the timestamped
  // fallback remains newer and will win when IndexedDB becomes available again.
  writeFallback(normalized);
  if (databaseReadable && (!databaseState || snapshotTime(normalized) > snapshotTime(databaseState))) {
    try { await writeDatabase(normalized); } catch { /* local fallback remains available */ }
  }
  return normalized;
}

export async function savePersonalWorkspace(state: PersonalWorkspaceState): Promise<void> {
  if (!isPersonalWorkspaceState(state)) throw new Error('Personal workspace data failed validation and was not saved.');
  const snapshot = { ...state, updatedAt: new Date().toISOString() };
  const fallbackSaved = writeFallback(snapshot);
  let databaseSaved = false;
  try { await writeDatabase(snapshot); databaseSaved = true; } catch { /* fall back to local storage below */ }
  if (!fallbackSaved && !databaseSaved) throw new Error('Personal workspace could not be saved. Check browser storage availability and quota.');
}

export async function createWorkspaceList(kind: WorkspaceListKind, name: string, description = ''): Promise<WorkspaceList> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) throw new Error('Enter a list name between 1 and 100 characters.');
  const state = await loadPersonalWorkspace();
  const now = new Date().toISOString();
  const list: WorkspaceList = { id: makeId(kind), kind, name: cleanName, description: description.trim().slice(0, 1000), articleIds: [], createdAt: now, updatedAt: now };
  state.lists.unshift(list);
  await savePersonalWorkspace(state);
  return list;
}

export async function updateWorkspaceList(listId: string, update: Partial<Pick<WorkspaceList, 'name' | 'description' | 'articleIds'>>): Promise<void> {
  const state = await loadPersonalWorkspace();
  const list = state.lists.find((item) => item.id === listId);
  if (!list) throw new Error('This collection or reading list no longer exists.');
  if (update.name !== undefined) {
    const name = update.name.trim();
    if (!name || name.length > 100) throw new Error('List names must contain between 1 and 100 characters.');
    list.name = name;
  }
  if (update.description !== undefined) list.description = update.description.trim().slice(0, 1000);
  if (update.articleIds !== undefined) list.articleIds = [...new Set(update.articleIds.filter((id) => typeof id === 'string'))].slice(0, 10000);
  list.updatedAt = new Date().toISOString();
  await savePersonalWorkspace(state);
}

export async function deleteWorkspaceList(listId: string): Promise<void> {
  const state = await loadPersonalWorkspace();
  state.lists = state.lists.filter((item) => item.id !== listId);
  await savePersonalWorkspace(state);
}

export async function saveWorkspaceSession(kind: WorkspaceSessionKind, name: string, payload: { [key: string]: JsonValue }): Promise<WorkspaceSession> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) throw new Error('Enter a session name between 1 and 100 characters.');
  if (!isJsonValue(payload)) throw new Error('This session contains values that cannot be saved.');
  const state = await loadPersonalWorkspace();
  const now = new Date().toISOString();
  const session: WorkspaceSession = { id: makeId(kind), kind, name: cleanName, payload, createdAt: now, updatedAt: now };
  state.sessions.unshift(session);
  state.sessions = state.sessions.slice(0, 1000);
  await savePersonalWorkspace(state);
  return session;
}

export async function deleteWorkspaceSession(sessionId: string): Promise<void> {
  const state = await loadPersonalWorkspace();
  state.sessions = state.sessions.filter((item) => item.id !== sessionId);
  await savePersonalWorkspace(state);
}

export async function setArticleOffline(articleId: string, offline: boolean): Promise<void> {
  const state = await loadPersonalWorkspace();
  state.offlineArticleIds = offline
    ? [...new Set([...state.offlineArticleIds, articleId])].slice(0, 20000)
    : state.offlineArticleIds.filter((id) => id !== articleId);
  await savePersonalWorkspace(state);
}

export async function replacePersonalWorkspace(state: PersonalWorkspaceState): Promise<void> {
  if (!isPersonalWorkspaceState(state)) throw new Error('Backup workspace data failed validation.');
  await savePersonalWorkspace(state);
}
