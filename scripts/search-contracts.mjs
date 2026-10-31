import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-search-'));
try {
  const localCompiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const command = existsSync(localCompiler) ? process.execPath : 'tsc';
  const prefix = existsSync(localCompiler) ? [localCompiler] : [];
  execFileSync(command, [...prefix, 'src/engine/searchEngine.ts', '--target', 'ES2020', '--module', 'commonjs', '--strict', '--skipLibCheck', '--outDir', temp], { cwd: root, stdio: 'pipe' });
  const require = createRequire(import.meta.url);
  const search = require(path.join(temp, 'engine/searchEngine.js'));

  const branches = [{
    id: 'algebra', title: 'Algebra', description: 'Symbols, equations and mathematical structures.',
    topics: [{ id: 'linear-algebra', title: 'Linear Algebra' }, { id: 'group-theory', title: 'Group Theory' }],
  }, {
    id: 'calculus', title: 'Calculus', description: 'Limits, derivatives and integrals.',
    topics: [{ id: 'differential-calculus', title: 'Differential Calculus' }],
  }];
  const article = {
    schemaVersion: 1, id: 'sample-algebra', slug: 'sample-algebra', title: 'Algebraic Properties',
    level: 'University', difficulty: 'Easy', aliases: ['Algebra rules'], summary: 'Associative and distributive properties.',
    branch: 'algebra', status: 'published', relatedTopics: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    blocks: [
      { id: 'definition', type: 'definition', heading: 'Associative property', content: 'The associative property states that grouping does not change the sum.' },
      { id: 'formula', type: 'latex', heading: 'Summation formula', latex: '\\sum_{i=1}^{n} i', display: true, explanation: 'Add the terms from one to n.' },
      { id: 'theorem', type: 'theorem', heading: 'Distributive law', statement: 'Multiplication distributes over addition.' },
      { id: 'exercise', type: 'exercise', question: 'Expand the expression.', answer: 'x squared plus five x plus six.' },
    ],
  };
  const symbols = [
    { id: 'summation', symbol: '∑', name: 'Summation', category: 'Calculus', latex: '\\sum', description: 'Adds a sequence of terms.', unicode: 'U+2211', aliases: ['sigma notation'] },
    { id: 'partial-derivative', symbol: '∂', name: 'Partial derivative', category: 'Calculus', latex: '\\partial', description: 'A derivative with respect to one variable.', unicode: 'U+2202' },
  ];
  const actions = [{ id: 'action-playground', title: 'Math Playground', detail: 'Open mathematical tools', to: '/playground' }];
  const index = search.buildSearchIndex([article], branches, symbols, actions);

  assert.equal(index.length, 2 + 3 + 5 + 2 + 1, 'Index must include branches, topics, articles, every block, symbols and actions.');
  const phrase = search.searchDocuments(index, '"associative property"');
  assert.ok(phrase.results.some((item) => item.id === 'block-sample-algebra-definition'), 'Quoted phrase should find exact article block.');
  assert.ok(phrase.results.some((item) => item.id === 'article-sample-algebra'), 'Article-level full-text document should be searchable.');
  assert.ok(phrase.results[0].snippet.toLowerCase().includes('associative'), 'Results should include a contextual snippet.');
  assert.equal(phrase.results[0].id, 'block-sample-algebra-definition', 'Direct block hits should rank ahead of article-wide full-text matches.');

  const latex = search.searchDocuments(index, '\\sum_{i=1}^{n}');
  assert.ok(latex.results.some((item) => item.id === 'block-sample-algebra-formula'), 'LaTeX commands and subscripts should be searchable.');
  const symbol = search.searchDocuments(index, '∑');
  assert.ok(symbol.results.some((item) => item.kind === 'symbol'), 'Unicode mathematical symbols should be searchable.');

  const formulaFilter = search.searchDocuments(index, 'branch:algebra type:formula');
  assert.ok(formulaFilter.results.length > 0, 'Branch and content-type filters should work together.');
  assert.ok(formulaFilter.results.every((item) => item.kind === 'block' && item.blockType === 'latex'), 'type:formula must return equation blocks only.');
  const metadataFilters = search.searchDocuments(index, 'level:university difficulty:easy');
  assert.ok(metadataFilters.results.some((item) => item.id === 'article-sample-algebra'), 'Level and difficulty filters should match article metadata.');
  const theorem = search.searchDocuments(index, 'type:theorem branch:algebra');
  assert.ok(theorem.results.some((item) => item.blockType === 'theorem'), 'Theorem type filter should find theorem blocks.');
  const topic = search.searchDocuments(index, 'type:topic branch:calculus');
  assert.ok(topic.results.some((item) => item.title === 'Differential Calculus'), 'Topic filter should find topics within a branch.');
  const action = search.searchDocuments(index, 'playground');
  assert.ok(action.results.some((item) => item.kind === 'action'), 'Command actions should be indexed alongside content.');

  const parsed = search.parseSearchQuery('branch:"Probability and Statistics" type:formula "definite integral"');
  assert.equal(parsed.filters.branch, 'Probability and Statistics');
  assert.equal(parsed.filters.type, 'formula');
  assert.deepEqual(parsed.phrases, ['definite integral']);

  const suggestions = search.getSearchSuggestions(index, 'derivitive');
  assert.ok(suggestions.some((item) => item.toLowerCase().includes('derivative')), 'Misspelled queries should receive spelling suggestions.');
  assert.deepEqual(search.saveRecentSearch(['algebra', 'calculus'], '  Algebra  '), ['Algebra', 'calculus'], 'Recent searches should normalize and deduplicate queries.');
  assert.deepEqual(search.saveRecentSearch([], ''), [], 'Blank searches should not be saved.');
  assert.equal(search.isRecentSearchList(['algebra', 'calculus']), true);
  assert.equal(search.isRecentSearchList(['valid', 12]), false);

  console.log('Advanced search contracts passed: index coverage, article/block search, LaTeX, symbols, filters, exact phrases, snippets, actions, suggestions and recent searches.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
