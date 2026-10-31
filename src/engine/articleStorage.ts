import { sampleArticles } from '../data/articles';
import { slugify } from '../data/branches';
import { ARTICLE_DIFFICULTIES, ARTICLE_LEVELS } from '../types/article';
import type { ArticleBlock, MathArticle } from '../types/article';
import { safeStorageGet, safeStorageSet } from './safeStorage';

const STORAGE_KEY = 'math-wiki:articles:v1';

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isArticleBlock(value: unknown): value is ArticleBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  if (typeof block.id !== 'string' || (block.heading !== undefined && typeof block.heading !== 'string')) return false;
  switch (block.type) {
    case 'text':
    case 'definition':
      return typeof block.content === 'string';
    case 'latex':
      return typeof block.latex === 'string' && typeof block.display === 'boolean'
        && (block.explanation === undefined || typeof block.explanation === 'string');
    case 'image':
      return typeof block.src === 'string' && typeof block.alt === 'string'
        && (block.caption === undefined || typeof block.caption === 'string');
    case 'video':
      return typeof block.url === 'string' && (block.caption === undefined || typeof block.caption === 'string');
    case 'graph':
      return typeof block.expression === 'string' && typeof block.xMin === 'number'
        && typeof block.xMax === 'number' && (block.caption === undefined || typeof block.caption === 'string');
    case 'example':
      return typeof block.question === 'string' && isStringArray(block.steps) && typeof block.answer === 'string';
    case 'table':
      return isStringArray(block.headers) && Array.isArray(block.rows)
        && block.rows.every((row) => isStringArray(row));
    case 'exercise':
      return typeof block.question === 'string'
        && (block.hint === undefined || typeof block.hint === 'string')
        && (block.answer === undefined || typeof block.answer === 'string');
    default:
      return false;
  }
}

function isArticle(value: unknown): value is MathArticle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === 1
    && typeof candidate.id === 'string'
    && typeof candidate.slug === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.summary === 'string'
    && typeof candidate.branch === 'string'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && ARTICLE_LEVELS.includes(candidate.level as MathArticle['level'])
    && ARTICLE_DIFFICULTIES.includes(candidate.difficulty as MathArticle['difficulty'])
    && ['draft', 'ready', 'published'].includes(String(candidate.status))
    && isStringArray(candidate.aliases)
    && isStringArray(candidate.relatedTopics)
    && Array.isArray(candidate.blocks)
    && candidate.blocks.every(isArticleBlock);
}


export function getLocalArticles(): MathArticle[] {
  try {
    const parsed: unknown = JSON.parse(safeStorageGet(STORAGE_KEY, '[]') || '[]');
    return Array.isArray(parsed) ? parsed.filter(isArticle) : [];
  } catch {
    return [];
  }
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
  const current = getLocalArticles().filter((item) => item.id !== article.id);
  const updated = { ...article, status: article.status === 'published' ? 'draft' as const : article.status, updatedAt: new Date().toISOString() };
  if (!safeStorageSet(STORAGE_KEY, JSON.stringify([...current, updated]))) {
    throw new Error('Browser storage is unavailable or full. Export your work and check storage permissions.');
  }
}

export function deleteLocalArticle(id: string): void {
  const remaining = getLocalArticles().filter((article) => article.id !== id);
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
  const publishable = { ...article, status: 'published' as const, updatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(publishable, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${article.slug || 'article'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseImportedArticle(value: unknown): MathArticle {
  if (!isArticle(value)) throw new Error('This file is not a valid Mathematics Wiki article (schema version 1).');
  return { ...value, status: 'draft' };
}
