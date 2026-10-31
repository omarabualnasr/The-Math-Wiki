import type { ArticleBlock, MathArticle } from '../types/article';

function createId(prefix: string): string {
  const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${token}`;
}

/**
 * Creates a fully independent local draft from a repository-published article.
 * The source article and its block IDs remain untouched. A unique slug is
 * selected against the current article catalogue before the copy is returned.
 */
export function createArticleFork(source: MathArticle, existingSlugs: Iterable<string>): MathArticle {
  const usedSlugs = new Set(Array.from(existingSlugs, (slug) => slug.toLowerCase()));
  const baseSlug = `${source.slug}-copy`.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'article-copy';
  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(slug.toLowerCase())) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const now = new Date().toISOString();
  const blocks = JSON.parse(JSON.stringify(source.blocks)) as ArticleBlock[];
  const forkedBlocks = blocks.map((block) => ({ ...block, id: createId('block') } as ArticleBlock));

  return {
    ...source,
    id: createId('article'),
    slug,
    title: `${source.title} (Copy)`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    blocks: forkedBlocks,
  };
}
