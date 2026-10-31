import { sampleArticles } from '../data/articles';
import { slugify } from '../data/branches';
import type { MathArticle } from '../types/article';
import { isArticle, validateArticle } from './articleValidation';
import { safeStorageGetJson, safeStorageSet } from './safeStorage';

const STORAGE_KEY = 'math-wiki:articles:v1';

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function getLocalArticleRecords(): unknown[] {
  return safeStorageGetJson(STORAGE_KEY, [] as unknown[], isUnknownArray);
}

export function getLocalArticles(): MathArticle[] {
  return getLocalArticleRecords().filter(isArticle);
}

export function getLocalArticleDiagnostics(): { total: number; valid: number; invalid: number } {
  const records = getLocalArticleRecords();
  const valid = records.filter(isArticle).length;
  return { total: records.length, valid, invalid: records.length - valid };
}

export function getAllArticles(): MathArticle[] {
  const local = getLocalArticles();
  const overrides = new Map<string, MathArticle>(local.map((article): [string, MathArticle] => [article.id, article]));
  const published = sampleArticles.map((article) => overrides.get(article.id) || article);
  const localOnly = local.filter((article) => !sampleArticles.some((sample) => sample.id === article.id));
  return [...published, ...localOnly];
}

export function getArticleBySlug(slug: string): MathArticle | undefined {
  return getAllArticles().find((article) => article.slug === slug || article.id === slug);
}

export function getArticleById(id: string): MathArticle | undefined {
  return getAllArticles().find((article) => article.id === id);
}

export function saveLocalArticle(article: MathArticle): void {
  const validation = validateArticle(article);
  if (!validation.valid) {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue ? `${firstIssue.path}: ${firstIssue.message}` : 'This article is not valid.');
  }

  const existingArticle = getAllArticles().find((item) => item.slug === article.slug && item.id !== article.id);
  if (existingArticle) throw new Error(`The URL slug “${article.slug}” is already used by “${existingArticle.title}”. Choose a different slug.`);
  const existingLocal = getLocalArticles().some((item) => item.id === article.id);
  if (sampleArticles.some((item) => item.id === article.id) && !existingLocal) {
    throw new Error('This ID belongs to a published sample article. Create a new article instead of replacing published content.');
  }

  // Keep unrelated malformed legacy records intact. They are reported through
  // getLocalArticleDiagnostics instead of being silently discarded on save.
  const current = getLocalArticleRecords().filter((record) => {
    if (!record || typeof record !== 'object' || !('id' in record)) return true;
    return (record as { id?: unknown }).id !== article.id;
  });
  const updated = { ...article, status: article.status === 'published' ? 'draft' as const : article.status, updatedAt: new Date().toISOString() };
  if (!safeStorageSet(STORAGE_KEY, JSON.stringify([...current, updated]))) {
    throw new Error('Browser storage is unavailable or full. Export your work and check storage permissions.');
  }
}

export function deleteLocalArticle(id: string): void {
  const remaining = getLocalArticleRecords().filter((record) => {
    if (!record || typeof record !== 'object' || !('id' in record)) return true;
    return (record as { id?: unknown }).id !== id;
  });
  if (!safeStorageSet(STORAGE_KEY, JSON.stringify(remaining))) {
    throw new Error('This draft could not be deleted because browser storage is unavailable.');
  }
}

export function createEmptyArticle(title = 'Untitled article'): MathArticle {
  const now = new Date().toISOString();
  const slug = slugify(title) || 'untitled-article';
  return {
    schemaVersion: 1,
    id: `${slug}-${Math.random().toString(36).slice(2, 7)}`,
    slug,
    title,
    level: 'Foundations',
    difficulty: 'Beginner',
    aliases: [],
    summary: '',
    branch: 'arithmetic',
    status: 'draft',
    relatedTopics: [],
    createdAt: now,
    updatedAt: now,
    blocks: [{ id: makeId(), type: 'text', heading: 'Introduction', content: '' }],
  };
}

export function exportArticleJson(article: MathArticle): void {
  const validation = validateArticle(article);
  if (!validation.valid) {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue ? `Cannot export ${firstIssue.path}: ${firstIssue.message}` : 'This article is not valid.');
  }
  const publishable = { ...article, status: 'published' as const, updatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(publishable, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${article.slug || 'article'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Delay revocation so browsers have time to begin the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseImportedArticle(value: unknown): MathArticle {
  const validation = validateArticle(value);
  if (!validation.valid || !validation.article) {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue ? `Invalid article at ${firstIssue.path}: ${firstIssue.message}` : 'This file is not a valid Mathematics Wiki article.');
  }
  return { ...validation.article, status: 'draft' };
}
