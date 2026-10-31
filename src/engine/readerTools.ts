import type { ArticleBlock, MathArticle } from '../types/article';
import { safeStorageGetJson, safeStorageSet } from './safeStorage';

const BOOKMARKS_KEY = 'math-wiki:bookmarks:v1';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

export function getBookmarks(): string[] {
  return [...new Set(safeStorageGetJson(BOOKMARKS_KEY, [] as string[], isStringArray))];
}

export function isBookmarked(articleId: string): boolean {
  return getBookmarks().includes(articleId);
}

export function toggleBookmark(articleId: string): boolean {
  const current = getBookmarks();
  const exists = current.includes(articleId);
  const next = exists ? current.filter((id) => id !== articleId) : [...current, articleId];
  if (!safeStorageSet(BOOKMARKS_KEY, JSON.stringify(next))) {
    throw new Error('Bookmarks could not be saved. Browser storage may be unavailable or full.');
  }
  window.dispatchEvent(new CustomEvent('math-wiki:bookmarks-changed'));
  return !exists;
}

export function articleBlockToText(block: ArticleBlock): string {
  const title = block.heading ? `${block.heading}\n` : '';
  switch (block.type) {
    case 'text':
    case 'definition':
      return `${title}${block.content}`;
    case 'latex':
      return `${title}${block.explanation ? `${block.explanation}\n` : ''}${block.latex}`;
    case 'image':
      return `${title}${block.alt}${block.caption ? `\n${block.caption}` : ''}`;
    case 'video':
      return `${title}${block.caption ? `${block.caption}\n` : ''}${block.url}`;
    case 'graph':
      return `${title}${block.caption ? `${block.caption}\n` : ''}y = ${block.expression}`;
    case 'example':
      return `${title}Question: ${block.question}\n${block.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\nAnswer: ${block.answer}`;
    case 'table':
      return `${title}${block.headers.join('\t')}\n${block.rows.map((row) => row.join('\t')).join('\n')}`;
    case 'exercise':
      return `${title}${block.question}${block.hint ? `\nHint: ${block.hint}` : ''}${block.answer ? `\nAnswer: ${block.answer}` : ''}`;
    case 'theorem':
    case 'lemma':
    case 'corollary':
    case 'proposition':
    case 'axiom':
      return `${title}${block.type.toUpperCase()}: ${block.statement}${block.attribution ? `\n${block.attribution}` : ''}`;
    case 'proof':
      return `${title}Proof${block.targetLabel ? ` of ${block.targetLabel}` : ''}\n${block.content}${block.conclusion ? `\n${block.conclusion}` : ''}`;
    case 'callout':
      return `${title}${block.variant.toUpperCase()}: ${block.content}`;
    case 'comparison':
      return `${title}${block.leftTitle}\n${block.leftContent}\n\n${block.rightTitle}\n${block.rightContent}`;
    case 'steps':
      return `${title}${block.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
    case 'disclosure':
      return `${title}${block.summary}\n${block.content}`;
    case 'citation':
      return `${title}${block.citation}${block.author ? `\n${block.author}` : ''}${block.year ? ` (${block.year})` : ''}${block.url ? `\n${block.url}` : ''}`;
    case 'resource':
      return `${title}${block.label}${block.description ? `\n${block.description}` : ''}\n${block.url}`;
    case 'reference':
      return `${title}${block.prefix || ''}${block.targetLabel}${block.suffix || ''}`;
    case 'parameter':
      return `${title}${block.expression}\n${block.parameter}: ${block.min} to ${block.max} (step ${block.step}, initial ${block.initial})`;
  }
}

export function articleToText(article: MathArticle): string {
  const metadata = [
    article.title,
    `Level: ${article.level}`,
    `Difficulty: ${article.difficulty}`,
    article.aliases.length ? `Also known as: ${article.aliases.join(', ')}` : '',
    article.summary,
  ].filter(Boolean);
  return `${metadata.join('\n')}\n\n${article.blocks.map(articleBlockToText).join('\n\n')}`;
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
}

export async function shareArticle(article: MathArticle): Promise<'shared' | 'copied'> {
  const url = window.location.href;
  if (navigator.share) {
    await navigator.share({ title: article.title, text: article.summary || `Read ${article.title}`, url });
    return 'shared';
  }
  await copyText(url);
  return 'copied';
}
