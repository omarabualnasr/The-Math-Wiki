import type { ArticleBlock, MathArticle } from '../types/article';
import { getArticleReferenceIssues } from './articleReferences';
import { validateArticle } from './articleValidation';

export interface PublishingIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

function hasMeaningfulContent(block: ArticleBlock): boolean {
  switch (block.type) {
    case 'text':
    case 'definition':
    case 'proof':
    case 'callout': return Boolean(block.content.trim());
    case 'latex': return Boolean(block.latex.trim());
    case 'image': return Boolean(block.src.trim());
    case 'video': return Boolean(block.url.trim());
    case 'graph': return Boolean(block.expression.trim());
    case 'example': return Boolean(block.question.trim() || block.steps.some((step) => step.trim()) || block.answer.trim());
    case 'table': return block.headers.some((header) => header.trim()) || block.rows.some((row) => row.some((cell) => cell.trim()));
    case 'exercise': return Boolean(block.question.trim());
    case 'theorem':
    case 'lemma':
    case 'corollary':
    case 'proposition':
    case 'axiom': return Boolean(block.statement.trim());
    case 'comparison': return Boolean(block.leftContent.trim() || block.rightContent.trim());
    case 'steps': return block.steps.some((step) => step.trim());
    case 'disclosure': return Boolean(block.summary.trim() || block.content.trim());
    case 'citation': return Boolean(block.citation.trim());
    case 'resource': return Boolean(block.label.trim() && block.url.trim());
    case 'reference': return Boolean(block.targetLabel.trim());
    case 'parameter': return Boolean(block.expression.trim() && block.parameter.trim());
  }
}

function isSafeLink(value: string): boolean {
  const url = value.trim();
  if (!url) return false;
  if (/^(\/|\.\.?\/|#)/.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Publication preflight is stricter than draft validation and reports actionable warnings. */
export function getArticlePublishingIssues(article: MathArticle): PublishingIssue[] {
  const issues: PublishingIssue[] = [];
  const validation = validateArticle(article);
  validation.issues.forEach((issue) => issues.push({ severity: 'error', path: issue.path, message: issue.message }));

  if (!article.title.trim()) issues.push({ severity: 'error', path: 'Title', message: 'Add an article title.' });
  if (!article.summary.trim()) issues.push({ severity: 'warning', path: 'Summary', message: 'A short summary helps readers and search results.' });
  if (!article.blocks.length) issues.push({ severity: 'error', path: 'Content', message: 'Add at least one content block.' });

  article.blocks.forEach((block, index) => {
    if (!hasMeaningfulContent(block)) issues.push({ severity: 'error', path: `Block ${index + 1}`, message: `${block.type} block is empty.` });
    if (block.type === 'image' && !block.alt.trim()) issues.push({ severity: 'warning', path: `Block ${index + 1}`, message: 'Add alternative text to this image.' });
    if (block.type === 'resource' && !isSafeLink(block.url)) issues.push({ severity: 'error', path: `Block ${index + 1}`, message: 'Resource URL must be HTTP(S) or a relative path.' });
    if (block.type === 'citation' && block.url && !isSafeLink(block.url)) issues.push({ severity: 'error', path: `Block ${index + 1}`, message: 'Citation URL must be HTTP(S) or a relative path.' });
    if (block.type === 'video' && block.url && !isSafeLink(block.url)) issues.push({ severity: 'warning', path: `Block ${index + 1}`, message: 'Check that this video URL is valid and supported.' });
    if (block.type === 'parameter' && block.parameter.trim() === 'x') issues.push({ severity: 'warning', path: `Block ${index + 1}`, message: 'The parameter name x may conflict with the graph variable.' });
  });

  getArticleReferenceIssues(article.blocks).forEach((message) => issues.push({ severity: 'error', path: 'References', message }));
  return issues;
}

export function canMarkArticleReady(article: MathArticle): boolean {
  return !getArticlePublishingIssues(article).some((issue) => issue.severity === 'error');
}
