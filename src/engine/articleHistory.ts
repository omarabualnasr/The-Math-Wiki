import type { MathArticle } from '../types/article';
import { isArticle } from './articleValidation';
import { safeStorageGet, safeStorageSet } from './safeStorage';

export interface ArticleRevision {
  id: string;
  savedAt: string;
  title: string;
  article: MathArticle;
}

const MAX_REVISIONS = 12;
const MAX_REVISION_BYTES = 300_000;

function historyKey(articleId: string): string {
  return `math-wiki:article-history:v1:${encodeURIComponent(articleId)}`;
}

function isRevision(value: unknown): value is ArticleRevision {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.savedAt === 'string'
    && typeof item.title === 'string'
    && isArticle(item.article);
}

export function getArticleRevisions(articleId: string): ArticleRevision[] {
  try {
    const raw = safeStorageGet(historyKey(articleId));
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isRevision) : [];
  } catch {
    return [];
  }
}

/** Best-effort history: oversized snapshots are skipped rather than exhausting browser storage. */
export function saveArticleRevision(article: MathArticle): boolean {
  try {
    const serialized = JSON.stringify(article);
    if (new Blob([serialized]).size > MAX_REVISION_BYTES) return false;
    const current = getArticleRevisions(article.id);
    const latest = current[0];
    if (latest && JSON.stringify(latest.article) === serialized) return true;
    const revision: ArticleRevision = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `revision-${Date.now()}`,
      savedAt: new Date().toISOString(),
      title: article.title || 'Untitled article',
      article: JSON.parse(serialized) as MathArticle,
    };
    const next = [revision, ...current].slice(0, MAX_REVISIONS);
    return safeStorageSet(historyKey(article.id), JSON.stringify(next));
  } catch {
    return false;
  }
}

export function restoreArticleRevision(articleId: string, revisionId: string): MathArticle | undefined {
  const revision = getArticleRevisions(articleId).find((item) => item.id === revisionId);
  if (!revision || !isArticle(revision.article)) return undefined;
  return { ...revision.article, status: 'draft', updatedAt: new Date().toISOString() };
}
