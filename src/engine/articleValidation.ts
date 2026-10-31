import { ARTICLE_DIFFICULTIES, ARTICLE_LEVELS } from '../types/article';
import type { ArticleBlock, MathArticle } from '../types/article';

export interface ArticleValidationIssue {
  path: string;
  message: string;
}

export interface ArticleValidationResult {
  valid: boolean;
  issues: ArticleValidationIssue[];
  article?: MathArticle;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

function isValidReferenceLabel(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9:_-]{0,79}$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isValidTimestamp(value: unknown): value is string {
  return isString(value) && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function blockIssues(value: unknown, path: string): ArticleValidationIssue[] {
  const issues: ArticleValidationIssue[] = [];
  if (!isRecord(value)) return [{ path, message: 'Block must be an object.' }];
  if (!isString(value.id) || !value.id.trim()) issues.push({ path: `${path}.id`, message: 'Every block needs a non-empty ID.' });
  if (!isOptionalString(value.heading)) issues.push({ path: `${path}.heading`, message: 'Heading must be text.' });

  const requireString = (key: string) => {
    if (!isString(value[key])) issues.push({ path: `${path}.${key}`, message: `${key} must be text.` });
  };
  const optionalString = (key: string) => {
    if (!isOptionalString(value[key])) issues.push({ path: `${path}.${key}`, message: `${key} must be text when provided.` });
  };
  const requireStringArray = (key: string) => {
    if (!isStringArray(value[key])) issues.push({ path: `${path}.${key}`, message: `${key} must be a list of text values.` });
  };

  switch (value.type) {
    case 'text':
    case 'definition':
      requireString('content');
      break;
    case 'latex':
      requireString('latex');
      if (typeof value.display !== 'boolean') issues.push({ path: `${path}.display`, message: 'Display must be true or false.' });
      optionalString('explanation');
      optionalString('label');
      if (isString(value.label) && value.label.trim() && !isValidReferenceLabel(value.label)) issues.push({ path: `${path}.label`, message: 'Reference labels must start with a letter and contain only letters, numbers, colons, underscores or hyphens.' });
      if (value.numbered !== undefined && typeof value.numbered !== 'boolean') issues.push({ path: `${path}.numbered`, message: 'Numbered must be true or false.' });
      break;
    case 'image':
      requireString('src');
      requireString('alt');
      optionalString('caption');
      optionalString('assetName');
      break;
    case 'video':
      requireString('url');
      optionalString('caption');
      break;
    case 'graph':
      requireString('expression');
      if (typeof value.xMin !== 'number' || !Number.isFinite(value.xMin)) issues.push({ path: `${path}.xMin`, message: 'Minimum x must be a finite number.' });
      if (typeof value.xMax !== 'number' || !Number.isFinite(value.xMax)) issues.push({ path: `${path}.xMax`, message: 'Maximum x must be a finite number.' });
      if (typeof value.xMin === 'number' && Number.isFinite(value.xMin) && typeof value.xMax === 'number' && Number.isFinite(value.xMax) && value.xMax <= value.xMin) {
        issues.push({ path, message: 'Graph maximum x must be greater than minimum x.' });
      }
      optionalString('xLabel');
      optionalString('yLabel');
      optionalString('caption');
      if (value.inspectValue !== undefined && (typeof value.inspectValue !== 'number' || !Number.isFinite(value.inspectValue))) {
        issues.push({ path: `${path}.inspectValue`, message: 'Inspection value must be a finite number.' });
      }
      break;
    case 'example':
      requireString('question');
      requireStringArray('steps');
      requireString('answer');
      break;
    case 'table': {
      const headers = value.headers;
      const validHeaders = isStringArray(headers);
      if (!validHeaders) issues.push({ path: `${path}.headers`, message: 'Headers must be a list of text values.' });
      else if (headers.length === 0) issues.push({ path: `${path}.headers`, message: 'A table needs at least one column.' });
      if (!Array.isArray(value.rows) || !value.rows.every(isStringArray)) {
        issues.push({ path: `${path}.rows`, message: 'Rows must be a list of text rows.' });
      } else if (validHeaders && value.rows.some((row) => row.length !== headers.length)) {
        issues.push({ path: `${path}.rows`, message: 'Every table row must have the same number of cells as the header.' });
      }
      break;
    }
    case 'exercise':
      requireString('question');
      optionalString('hint');
      optionalString('answer');
      break;
    case 'theorem':
    case 'lemma':
    case 'corollary':
    case 'proposition':
    case 'axiom':
      requireString('statement');
      optionalString('label');
      if (isString(value.label) && value.label.trim() && !isValidReferenceLabel(value.label)) issues.push({ path: `${path}.label`, message: 'Reference labels must start with a letter and contain only letters, numbers, colons, underscores or hyphens.' });
      optionalString('attribution');
      break;
    case 'proof':
      requireString('content');
      optionalString('targetLabel');
      if (isString(value.targetLabel) && value.targetLabel.trim() && !isValidReferenceLabel(value.targetLabel)) issues.push({ path: `${path}.targetLabel`, message: 'Reference labels must start with a letter and contain only letters, numbers, colons, underscores or hyphens.' });
      optionalString('conclusion');
      break;
    case 'callout':
      requireString('content');
      if (!['note', 'important', 'warning', 'tip'].includes(String(value.variant))) {
        issues.push({ path: `${path}.variant`, message: 'Choose a supported callout style.' });
      }
      break;
    case 'comparison':
      requireString('leftTitle');
      requireString('leftContent');
      requireString('rightTitle');
      requireString('rightContent');
      break;
    case 'steps':
      requireStringArray('steps');
      if (Array.isArray(value.steps) && value.steps.length === 0) issues.push({ path: `${path}.steps`, message: 'Add at least one step.' });
      break;
    case 'disclosure':
      requireString('summary');
      requireString('content');
      if (value.initiallyOpen !== undefined && typeof value.initiallyOpen !== 'boolean') issues.push({ path: `${path}.initiallyOpen`, message: 'Initially open must be true or false.' });
      break;
    case 'citation':
      requireString('citation');
      optionalString('url');
      optionalString('author');
      optionalString('year');
      break;
    case 'resource':
      requireString('label');
      requireString('url');
      optionalString('description');
      if (!['web', 'pdf', 'download'].includes(String(value.resourceType))) issues.push({ path: `${path}.resourceType`, message: 'Choose web, PDF or download.' });
      break;
    case 'reference':
      requireString('targetLabel');
      if (isString(value.targetLabel) && value.targetLabel.trim() && !isValidReferenceLabel(value.targetLabel)) issues.push({ path: `${path}.targetLabel`, message: 'Reference labels must start with a letter and contain only letters, numbers, colons, underscores or hyphens.' });
      optionalString('prefix');
      optionalString('suffix');
      break;
    case 'parameter':
      requireString('expression');
      requireString('parameter');
      if (isString(value.parameter) && !/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(value.parameter)) issues.push({ path: `${path}.parameter`, message: 'Parameter name must be a simple variable name.' });
      if (isString(value.parameter) && ['pi', 'e', 'tau', 'ans', 'sin', 'cos', 'tan', 'sqrt', 'log', 'exp'].includes(value.parameter)) issues.push({ path: `${path}.parameter`, message: 'Choose a parameter name that is not a built-in constant or function.' });
      for (const key of ['min', 'max', 'step', 'initial']) {
        if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) issues.push({ path: `${path}.${key}`, message: `${key} must be a finite number.` });
      }
      if (typeof value.min === 'number' && typeof value.max === 'number' && value.max <= value.min) issues.push({ path, message: 'Parameter maximum must be greater than its minimum.' });
      if (typeof value.step === 'number' && value.step <= 0) issues.push({ path: `${path}.step`, message: 'Parameter step must be greater than zero.' });
      if (typeof value.initial === 'number' && typeof value.min === 'number' && typeof value.max === 'number' && (value.initial < value.min || value.initial > value.max)) issues.push({ path: `${path}.initial`, message: 'Initial value must be within the minimum and maximum.' });
      optionalString('caption');
      break;
    default:
      issues.push({ path: `${path}.type`, message: 'This block type is not supported by this article schema.' });
  }
  return issues;
}

export function validateArticle(value: unknown): ArticleValidationResult {
  const issues: ArticleValidationIssue[] = [];
  if (!isRecord(value)) return { valid: false, issues: [{ path: '$', message: 'Article must be a JSON object.' }] };
  const candidate = value;

  if (candidate.schemaVersion !== 1) issues.push({ path: '$.schemaVersion', message: 'Only article schema version 1 is currently supported.' });
  for (const key of ['id', 'slug', 'title', 'branch'] as const) {
    if (!isString(candidate[key]) || !candidate[key].trim()) issues.push({ path: `$.${key}`, message: `${key} must be non-empty text.` });
  }
  // Summaries are recommended for publication but optional for in-progress drafts.
  if (!isString(candidate.summary)) issues.push({ path: '$.summary', message: 'Summary must be text.' });
  if (isString(candidate.id) && candidate.id.length > 160) issues.push({ path: '$.id', message: 'Article ID is too long.' });
  if (isString(candidate.title) && candidate.title.length > 300) issues.push({ path: '$.title', message: 'Article title is too long.' });
  if (isString(candidate.slug) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug)) {
    issues.push({ path: '$.slug', message: 'Slug must contain lowercase letters, numbers and single hyphens.' });
  }
  if (!ARTICLE_LEVELS.includes(candidate.level as MathArticle['level'])) issues.push({ path: '$.level', message: 'Choose a supported article level.' });
  if (!ARTICLE_DIFFICULTIES.includes(candidate.difficulty as MathArticle['difficulty'])) issues.push({ path: '$.difficulty', message: 'Choose a supported difficulty.' });
  if (!['draft', 'ready', 'published'].includes(String(candidate.status))) issues.push({ path: '$.status', message: 'Article status is not supported.' });
  if (!isStringArray(candidate.aliases)) issues.push({ path: '$.aliases', message: 'Aliases must be a list of text values.' });
  if (!isStringArray(candidate.relatedTopics)) issues.push({ path: '$.relatedTopics', message: 'Related topics must be a list of text values.' });
  if (!isValidTimestamp(candidate.createdAt)) issues.push({ path: '$.createdAt', message: 'Creation date must be a valid date string.' });
  if (!isValidTimestamp(candidate.updatedAt)) issues.push({ path: '$.updatedAt', message: 'Updated date must be a valid date string.' });

  if (!Array.isArray(candidate.blocks)) {
    issues.push({ path: '$.blocks', message: 'Blocks must be a list.' });
  } else {
    const blockIds = new Set<string>();
    candidate.blocks.forEach((block, index) => {
      const path = `$.blocks[${index}]`;
      issues.push(...blockIssues(block, path));
      if (isRecord(block) && isString(block.id)) {
        if (blockIds.has(block.id)) issues.push({ path: `${path}.id`, message: `Duplicate block ID: ${block.id}.` });
        blockIds.add(block.id);
      }
    });
  }

  const valid = issues.length === 0;
  return valid ? { valid, issues, article: candidate as unknown as MathArticle } : { valid, issues };
}

export function isArticle(value: unknown): value is MathArticle {
  return validateArticle(value).valid;
}

export function isArticleBlock(value: unknown): value is ArticleBlock {
  return blockIssues(value, '$.block').length === 0;
}
