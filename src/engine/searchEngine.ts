import type { MathArticle, ArticleBlock } from '../types/article';
import type { MathBranch } from '../data/branches';
import type { MathSymbol } from '../data/symbols';

export type SearchDocumentKind = 'article' | 'block' | 'branch' | 'topic' | 'symbol' | 'action';

export interface SearchDocument {
  id: string;
  kind: SearchDocumentKind;
  title: string;
  detail: string;
  to: string;
  body: string;
  aliases: string[];
  branchId?: string;
  branchTitle?: string;
  level?: string;
  difficulty?: string;
  status?: string;
  blockType?: ArticleBlock['type'];
  tags: string[];
  /** Pre-normalized fields used for ranking. */
  normalizedTitle: string;
  normalizedAliases: string[];
  normalizedBody: string;
  normalizedAll: string;
}

export interface SearchFilters {
  branch?: string;
  level?: string;
  difficulty?: string;
  type?: string;
}

export interface ParsedSearchQuery {
  raw: string;
  text: string;
  terms: string[];
  phrases: string[];
  filters: SearchFilters;
}

export interface SearchResult extends SearchDocument {
  score: number;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  parsed: ParsedSearchQuery;
  suggestions: string[];
  total: number;
}

export interface SearchActionInput {
  id: string;
  title: string;
  detail: string;
  to: string;
}

export const RECENT_SEARCHES_KEY = 'math-wiki:search:recent:v1';
const RECENT_SEARCH_LIMIT = 8;

function normalizeSearchText(value: string): string {
  return value
    .replace(/\\([a-zA-Z]+)/g, ' $1 ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[{}()[\],;:=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !['id', 'src', 'url', 'assetName'].includes(key))
      .flatMap(([, item]) => collectStrings(item, depth + 1));
  }
  return [];
}

function makeDocument(input: Omit<SearchDocument, 'normalizedTitle' | 'normalizedAliases' | 'normalizedBody' | 'normalizedAll'>): SearchDocument {
  const normalizedTitle = normalizeSearchText(input.title);
  const normalizedAliases = input.aliases.map(normalizeSearchText);
  const normalizedBody = normalizeSearchText(input.body);
  const normalizedAll = normalizeSearchText([
    input.title, input.detail, input.body, ...input.aliases,
    input.branchId || '', input.branchTitle || '', input.level || '', input.difficulty || '',
    input.status || '', input.blockType || '', ...input.tags,
  ].join(' '));
  return { ...input, normalizedTitle, normalizedAliases, normalizedBody, normalizedAll };
}

function blockSearchType(block: ArticleBlock): string[] {
  const tags = ['block', block.type];
  if (block.type === 'latex') tags.push('formula', 'equation');
  if (['theorem', 'lemma', 'corollary', 'proposition', 'axiom'].includes(block.type)) tags.push('statement');
  if (block.type === 'example') tags.push('worked-example');
  return tags;
}

export function buildSearchIndex(
  articles: MathArticle[],
  branches: MathBranch[],
  symbols: MathSymbol[],
  actions: SearchActionInput[] = [],
): SearchDocument[] {
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const documents: SearchDocument[] = [];

  for (const branch of branches) {
    documents.push(makeDocument({
      id: `branch-${branch.id}`, kind: 'branch', title: branch.title,
      detail: 'Mathematics branch', to: `/branches/${branch.id}`,
      body: branch.description, aliases: [], branchId: branch.id, branchTitle: branch.title,
      tags: ['branch', 'discipline'],
    }));
    for (const topic of branch.topics) {
      documents.push(makeDocument({
        id: `topic-${branch.id}-${topic.id}`, kind: 'topic', title: topic.title,
        detail: `Topic · ${branch.title}`, to: `/branches/${branch.id}/${topic.id}`,
        body: branch.description,
        aliases: [], branchId: branch.id, branchTitle: branch.title,
        tags: ['topic', 'under development'],
      }));
    }
  }

  for (const article of articles) {
    const branch = branchById.get(article.branch);
    const branchTitle = branch?.title || article.branch;
    const fullText = article.blocks.map((block) => collectStrings(block).join(' ')).join('\n');
    documents.push(makeDocument({
      id: `article-${article.id}`, kind: 'article', title: article.title,
      detail: `${article.level} · ${article.difficulty} · ${branchTitle}`,
      to: `/articles/${article.slug}`, body: `${article.summary}\n${fullText}`,
      aliases: article.aliases, branchId: article.branch, branchTitle,
      level: article.level, difficulty: article.difficulty, status: article.status,
      tags: ['article', 'page', article.status],
    }));

    for (const block of article.blocks) {
      const blockBody = collectStrings(block).join('\n');
      const heading = block.heading?.trim() || article.title;
      documents.push(makeDocument({
        id: `block-${article.id}-${block.id}`, kind: 'block', title: heading,
        detail: `${block.type === 'latex' ? 'Formula' : block.type.replace(/-/g, ' ')} · ${article.title}`,
        to: `/articles/${article.slug}?block=${encodeURIComponent(block.id)}`,
        body: blockBody, aliases: [article.title, ...article.aliases],
        branchId: article.branch, branchTitle, level: article.level,
        difficulty: article.difficulty, status: article.status, blockType: block.type,
        tags: blockSearchType(block),
      }));
    }
  }

  for (const symbol of symbols) {
    documents.push(makeDocument({
      id: `symbol-${symbol.id}`, kind: 'symbol', title: `${symbol.symbol} · ${symbol.name}`,
      detail: `Mathematical symbol · ${symbol.category}`,
      to: `/symbols?q=${encodeURIComponent(symbol.name)}`,
      body: `${symbol.description}\n${symbol.latex}\n${symbol.unicode}`,
      aliases: symbol.aliases || [], tags: ['symbol', 'notation', symbol.category],
    }));
  }

  for (const action of actions) {
    documents.push(makeDocument({
      id: action.id, kind: 'action', title: action.title, detail: action.detail,
      to: action.to, body: action.detail, aliases: [], tags: ['action', 'command'],
    }));
  }

  return documents;
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const filters: SearchFilters = {};
  const filterPattern = /(?:^|\s)(branch|level|difficulty|type):(?:"([^"]+)"|'([^']+)'|([^\s]+))/gi;
  const textWithoutFilters = raw.replace(filterPattern, (_match, key: string, doubleQuoted: string, singleQuoted: string, plain: string) => {
    const value = (doubleQuoted || singleQuoted || plain || '').trim();
    if (value) filters[key.toLowerCase() as keyof SearchFilters] = value;
    return ' ';
  }).trim();

  const phrases: string[] = [];
  const text = textWithoutFilters.replace(/"([^"]+)"|'([^']+)'/g, (_match, doubleQuoted: string, singleQuoted: string) => {
    const phrase = (doubleQuoted || singleQuoted || '').trim();
    if (phrase) phrases.push(normalizeSearchText(phrase));
    return ' ';
  }).trim();
  const terms = [...new Set(tokenize(text))];
  return { raw, text, terms, phrases, filters };
}

function normalizeFilterValue(value: string): string {
  return normalizeSearchText(value).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesFilters(document: SearchDocument, filters: SearchFilters): boolean {
  if (filters.branch) {
    const wanted = normalizeFilterValue(filters.branch);
    const actual = normalizeFilterValue(`${document.branchId || ''} ${document.branchTitle || ''}`);
    if (!actual.includes(wanted)) return false;
  }
  if (filters.level && !normalizeFilterValue(document.level || '').includes(normalizeFilterValue(filters.level))) return false;
  if (filters.difficulty && !normalizeFilterValue(document.difficulty || '').includes(normalizeFilterValue(filters.difficulty))) return false;
  if (filters.type) {
    const wanted = normalizeFilterValue(filters.type);
    const actual = [document.kind, document.blockType || '', ...document.tags].map(normalizeFilterValue);
    if (!actual.some((value) => value === wanted || value.includes(wanted))) return false;
  }
  return true;
}

function scoreDocument(document: SearchDocument, parsed: ParsedSearchQuery): number {
  const { terms, phrases } = parsed;
  if (!terms.length && !phrases.length) return Object.values(parsed.filters).some(Boolean) ? 1 : 0;
  const title = document.normalizedTitle;
  const aliases = document.normalizedAliases.join(' ');
  const body = document.normalizedBody;
  const all = document.normalizedAll;
  if (!terms.every((term) => all.includes(term))) return 0;
  if (!phrases.every((phrase) => all.includes(phrase))) return 0;

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += title === term ? 28 : 18;
    else if (aliases.includes(term)) score += 13;
    else if (body.includes(term)) score += 4;
    else score += 2;
  }
  for (const phrase of phrases) {
    if (title.includes(phrase)) score += 35;
    else if (aliases.includes(phrase)) score += 24;
    else if (body.includes(phrase)) score += 12;
  }
  // Prefer direct block hits over an article-wide full-text match so users land
  // on the exact definition, formula, theorem or exercise they searched for.
  if (document.kind === 'block') score += 4;
  if (document.status === 'published') score += 1;
  return score;
}

function makeSnippet(body: string, terms: string[], maxLength = 150): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const lower = clean.toLocaleLowerCase();
  let earliest = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index >= 0 && (earliest < 0 || index < earliest)) earliest = index;
  }
  if (earliest < 0) return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
  const start = Math.max(0, earliest - Math.floor(maxLength * 0.28));
  const end = Math.min(clean.length, start + maxLength);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function getSearchSuggestions(index: SearchDocument[], query: string, limit = 5): string[] {
  const parsed = parseSearchQuery(query);
  if (!parsed.terms.length) return [];
  const vocabulary = new Set<string>();
  const titleCandidates = new Set<string>();
  for (const document of index) {
    for (const token of tokenize(document.title)) if (token.length > 2) vocabulary.add(token);
    if (document.title) titleCandidates.add(document.title);
    for (const alias of document.aliases) {
      titleCandidates.add(alias);
      for (const token of tokenize(alias)) if (token.length > 2) vocabulary.add(token);
    }
  }
  const corrections = parsed.terms.map((term) => {
    if (term.length < 4 || vocabulary.has(term)) return term;
    const maxDistance = term.length >= 8 ? 2 : 1;
    return [...vocabulary]
      .map((candidate) => ({ candidate, distance: editDistance(term, candidate) }))
      .filter((item) => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))[0]?.candidate || term;
  });
  const corrected = corrections.some((term, index) => term !== parsed.terms[index])
    ? corrections.join(' ')
    : '';
  const startsWith = [...titleCandidates]
    .filter((title) => parsed.terms.some((term) => normalizeSearchText(title).startsWith(term)))
    .slice(0, limit);
  return [...new Set([corrected, ...startsWith].filter(Boolean))].slice(0, limit);
}

export function searchDocuments(index: SearchDocument[], rawQuery: string, limit = 24): SearchResponse {
  const parsed = parseSearchQuery(rawQuery);
  const results = index
    .filter((document) => matchesFilters(document, parsed.filters))
    .map((document) => ({ document, score: scoreDocument(document, parsed) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .map(({ document, score }) => ({ ...document, score, snippet: makeSnippet(document.body, [...parsed.terms, ...parsed.phrases]) }));
  return {
    results: results.slice(0, limit), parsed,
    suggestions: results.length ? [] : getSearchSuggestions(index, rawQuery),
    total: results.length,
  };
}

export function isRecentSearchList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 100 && value.every((item) => typeof item === 'string' && item.length <= 240);
}

export function saveRecentSearch(current: string[], query: string): string[] {
  const normalized = query.trim().replace(/\s+/g, ' ').slice(0, 240);
  if (!normalized) return current;
  return [normalized, ...current.filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())].slice(0, RECENT_SEARCH_LIMIT);
}
