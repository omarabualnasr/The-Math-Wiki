import type { Flashcard, LearningAttempt } from './learningEngine';
import { safeStorageGet, safeStorageSetJson } from './safeStorage';

export interface LearningState {
  version: 1;
  /** Last successful snapshot time, used to reconcile IndexedDB and fallback storage. */
  updatedAt?: string;
  attempts: LearningAttempt[];
  flashcards: Flashcard[];
}

const DB_NAME = 'math-wiki-learning';
const DB_VERSION = 1;
const STORE_NAME = 'learning-state';
const FALLBACK_KEY = 'math-wiki:learning-state:v1';
const EMPTY_STATE: LearningState = { version: 1, attempts: [], flashcards: [] };

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isQuestionResult(value: unknown): boolean {
  return isRecord(value) && typeof value.questionId === 'string' && typeof value.prompt === 'string'
    && typeof value.expectedAnswer === 'string' && typeof value.userAnswer === 'string'
    && typeof value.correct === 'boolean' && typeof value.topic === 'string';
}
function isAttempt(value: unknown): value is LearningAttempt {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.articleId === 'string' && typeof value.articleTitle === 'string'
    && (value.mode === 'quiz' || value.mode === 'exam') && typeof value.score === 'number' && Number.isFinite(value.score)
    && typeof value.total === 'number' && Number.isFinite(value.total) && value.total >= 0 && value.score >= 0 && value.score <= value.total
    && typeof value.percent === 'number' && Number.isFinite(value.percent) && value.percent >= 0 && value.percent <= 100
    && typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))
    && (value.difficulty === 'Easy' || value.difficulty === 'Medium' || value.difficulty === 'Hard')
    && Array.isArray(value.results) && value.results.length === value.total && value.results.every(isQuestionResult);
}
function isFlashcard(value: unknown): value is Flashcard {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.articleId === 'string' && typeof value.articleTitle === 'string'
    && typeof value.front === 'string' && typeof value.back === 'string' && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.dueAt === 'string' && Number.isFinite(Date.parse(value.dueAt))
    && typeof value.intervalDays === 'number' && Number.isFinite(value.intervalDays) && value.intervalDays >= 0
    && typeof value.easeFactor === 'number' && Number.isFinite(value.easeFactor) && value.easeFactor >= 1.3 && value.easeFactor <= 3.2
    && typeof value.repetitions === 'number' && Number.isInteger(value.repetitions) && value.repetitions >= 0
    && typeof value.reviewCount === 'number' && Number.isInteger(value.reviewCount) && value.reviewCount >= 0;
}
export function isLearningState(value: unknown): value is LearningState {
  return isRecord(value) && value.version === 1
    && (value.updatedAt === undefined || (typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))))
    && Array.isArray(value.attempts) && value.attempts.every(isAttempt)
    && Array.isArray(value.flashcards) && value.flashcards.every(isFlashcard);
}

function readFallback(): LearningState {
  const raw = safeStorageGet(FALLBACK_KEY);
  if (raw === null) return EMPTY_STATE;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Saved learning fallback is not valid JSON and was left untouched.'); }
  if (!isLearningState(parsed)) throw new Error('Saved learning fallback failed validation and was left untouched.');
  return parsed;
}
function writeFallback(state: LearningState): boolean { return safeStorageSetJson(FALLBACK_KEY, state); }

function openLearningDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable.')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open learning storage.'));
    request.onblocked = () => reject(new Error('Learning storage upgrade is blocked by another tab.'));
  });
}

async function readFromDatabase(): Promise<LearningState | null> {
  const database = await openLearningDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get('main');
      request.onsuccess = () => {
        if (request.result === undefined || request.result === null) resolve(null);
        else if (isLearningState(request.result)) resolve(request.result);
        else reject(new Error('Saved learning data failed validation and was left untouched.'));
      };
      request.onerror = () => reject(request.error || new Error('Could not read learning data.'));
    });
  } finally { database.close(); }
}

async function writeToDatabase(state: LearningState): Promise<void> {
  const database = await openLearningDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(state, 'main');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save learning data.'));
      transaction.onabort = () => reject(transaction.error || new Error('Learning data save was cancelled.'));
    });
  } finally { database.close(); }
}

function snapshotTime(state: LearningState): number {
  return state.updatedAt ? Date.parse(state.updatedAt) : 0;
}

/** Select the newest valid copy when IndexedDB and the local fallback diverge. */
export function selectNewestLearningState(databaseState: LearningState | null, fallbackState: LearningState): LearningState {
  if (!databaseState) return fallbackState;
  return snapshotTime(fallbackState) > snapshotTime(databaseState) ? fallbackState : databaseState;
}

export async function loadLearningState(): Promise<LearningState> {
  let databaseState: LearningState | null = null;
  let databaseReadable = true;
  try {
    databaseState = await readFromDatabase();
  } catch (error) {
    // Do not hide malformed persisted data behind an empty fallback state.
    if (error instanceof Error && error.message.includes('failed validation')) throw error;
    databaseReadable = false;
  }

  const fallback = readFallback();
  const selected = selectNewestLearningState(databaseState, fallback);
  const normalized = selected.updatedAt ? selected : { ...selected, updatedAt: new Date().toISOString() };
  writeFallback(normalized);
  if (databaseReadable && (!databaseState || snapshotTime(normalized) > snapshotTime(databaseState))) {
    try { await writeToDatabase(normalized); } catch { /* local fallback remains available */ }
  }
  return normalized;
}

export async function saveLearningState(state: LearningState): Promise<void> {
  if (!isLearningState(state)) throw new Error('Learning data failed validation and was not saved.');
  const snapshot = { ...state, updatedAt: new Date().toISOString() };
  const fallbackSaved = writeFallback(snapshot);
  let databaseSaved = false;
  try { await writeToDatabase(snapshot); databaseSaved = true; } catch { /* fall back to local storage below */ }
  if (!fallbackSaved && !databaseSaved) throw new Error('Learning data could not be saved. Check browser storage availability and quota.');
}

export async function recordLearningAttempt(attempt: LearningAttempt): Promise<void> {
  const state = await loadLearningState();
  state.attempts = [attempt, ...state.attempts.filter((item) => item.id !== attempt.id)].slice(0, 1000);
  await saveLearningState(state);
}

export async function upsertFlashcards(cards: Flashcard[]): Promise<number> {
  const state = await loadLearningState();
  const map = new Map(state.flashcards.map((card) => [card.id, card]));
  cards.forEach((card) => {
    const existing = map.get(card.id);
    map.set(card.id, existing ? { ...existing, articleTitle: card.articleTitle, front: card.front, back: card.back } : card);
  });
  state.flashcards = [...map.values()].slice(-5000);
  await saveLearningState(state);
  return state.flashcards.length;
}

export async function saveReviewedFlashcard(updated: Flashcard): Promise<void> {
  const state = await loadLearningState();
  const index = state.flashcards.findIndex((card) => card.id === updated.id);
  if (index < 0) throw new Error('This flashcard is no longer available.');
  state.flashcards[index] = updated;
  await saveLearningState(state);
}

export async function removeFlashcard(id: string): Promise<void> {
  const state = await loadLearningState();
  state.flashcards = state.flashcards.filter((card) => card.id !== id);
  await saveLearningState(state);
}
