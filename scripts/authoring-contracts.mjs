import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-authoring-'));

try {
  const sample = JSON.parse(await readFile(path.join(root, 'src/data/pages/sum.json'), 'utf8'));
  execFileSync('tsc', [
    'src/types/article.ts',
    'src/engine/articleValidation.ts',
    'src/engine/articleReferences.ts',
    'src/engine/articlePublishing.ts',
    'src/engine/articleForking.ts',
    '--target', 'ES2020',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--strict',
    '--skipLibCheck',
    '--outDir', temp,
  ], { cwd: root, stdio: 'pipe' });

  const require = createRequire(import.meta.url);
  const { validateArticle } = require(path.join(temp, 'engine/articleValidation.js'));
  const { buildArticleReferenceIndex, getArticleReferenceIssues } = require(path.join(temp, 'engine/articleReferences.js'));
  const { getArticlePublishingIssues, canMarkArticleReady } = require(path.join(temp, 'engine/articlePublishing.js'));
  const { createArticleFork } = require(path.join(temp, 'engine/articleForking.js'));

  assert.equal(validateArticle(sample).valid, true, 'Published Sum sample must remain valid.');

  const sourceIds = sample.blocks.map((block) => block.id);
  const fork = createArticleFork(sample, [sample.slug, `${sample.slug}-copy`]);
  assert.equal(fork.status, 'draft', 'An editable copy must always begin as a local draft.');
  assert.equal(fork.slug, `${sample.slug}-copy-2`, 'An editable copy must choose a unique slug.');
  assert.notEqual(fork.id, sample.id, 'An editable copy must have a new article ID.');
  assert.ok(fork.blocks.every((block, index) => block.id !== sourceIds[index]), 'An editable copy must receive independent block IDs.');
  assert.equal(sample.blocks.map((block) => block.id).join('|'), sourceIds.join('|'), 'Creating an editable copy must not mutate its source article.');
  assert.equal(validateArticle(fork).valid, true, 'An editable copy must remain a valid article.');

  const blankSummaryDraft = structuredClone(sample);
  blankSummaryDraft.id = 'draft-without-summary';
  blankSummaryDraft.slug = 'draft-without-summary';
  blankSummaryDraft.title = 'Draft without summary';
  blankSummaryDraft.status = 'draft';
  blankSummaryDraft.summary = '';
  assert.equal(validateArticle(blankSummaryDraft).valid, true, 'An empty summary must be allowed while drafting.');
  assert.ok(getArticlePublishingIssues(blankSummaryDraft).some((issue) => issue.severity === 'warning' && issue.path === 'Summary'), 'A missing summary should be a publication warning.');

  const academicArticle = structuredClone(sample);
  academicArticle.id = 'authoring-contracts';
  academicArticle.slug = 'authoring-contracts';
  academicArticle.title = 'Authoring contracts';
  academicArticle.blocks = [
    { id: 'equation-one', type: 'latex', heading: 'Pythagorean identity', latex: 'a^2+b^2=c^2', display: true, numbered: true, label: 'eq:pythagorean' },
    { id: 'theorem-one', type: 'theorem', heading: 'Pythagorean theorem', statement: 'For a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.', label: 'thm:pythagorean' },
    { id: 'proof-one', type: 'proof', heading: 'Proof', content: 'A proof is supplied here.', targetLabel: 'thm:pythagorean' },
    { id: 'reference-one', type: 'reference', heading: 'Equation reference', targetLabel: 'eq:pythagorean', prefix: 'See ', suffix: '.' },
    { id: 'parameter-one', type: 'parameter', heading: 'Interactive parameter', expression: 'a^2 + 1', parameter: 'a', min: -5, max: 5, step: 0.1, initial: 1 },
  ];
  assert.equal(validateArticle(academicArticle).valid, true, 'All new authoring block types must pass validation.');

  const references = buildArticleReferenceIndex(academicArticle.blocks);
  assert.equal(Object.getPrototypeOf(references.byLabel), null, 'Reference label lookups must not inherit object properties.');
  assert.equal(references.byLabel['eq:pythagorean']?.display, 'Equation 1', 'Numbered equations must receive stable article-local numbering.');
  assert.equal(references.byLabel['thm:pythagorean']?.display, 'Theorem 1', 'Theorems must receive stable article-local numbering.');
  assert.equal(references.byBlockId['theorem-one']?.id, 'theorem-one', 'Numbered statement blocks must be addressable by block ID.');
  assert.deepEqual(getArticleReferenceIssues(academicArticle.blocks), [], 'Valid proof and cross-reference targets must resolve.');
  assert.equal(canMarkArticleReady(academicArticle), true, 'A structurally valid and referenced article may be marked ready.');

  const duplicateLabels = structuredClone(academicArticle.blocks);
  duplicateLabels.push({ id: 'duplicate-equation', type: 'latex', latex: 'x=1', display: true, numbered: true, label: 'eq:pythagorean' });
  assert.ok(getArticleReferenceIssues(duplicateLabels).some((issue) => issue.includes('used more than once')), 'Duplicate labels must be reported.');

  const danglingReference = structuredClone(academicArticle);
  danglingReference.blocks.find((block) => block.type === 'proof').targetLabel = 'thm:missing';
  assert.ok(getArticlePublishingIssues(danglingReference).some((issue) => issue.severity === 'error' && issue.path === 'References'), 'Dangling proof references must block publication.');

  const invalidParameter = structuredClone(academicArticle);
  invalidParameter.blocks.find((block) => block.type === 'parameter').parameter = 'sin';
  assert.equal(validateArticle(invalidParameter).valid, false, 'A parameter cannot shadow a built-in mathematical function.');

  const invalidLabel = structuredClone(academicArticle);
  invalidLabel.blocks[0].label = '__proto__';
  assert.equal(validateArticle(invalidLabel).valid, false, 'Reference labels must not permit unsafe object property names.');
  const paddedLabel = structuredClone(academicArticle);
  paddedLabel.blocks[0].label = ' eq:pythagorean ';
  assert.equal(validateArticle(paddedLabel).valid, false, 'Reference labels must not contain leading or trailing whitespace.');

  const unnumberedEquation = structuredClone(academicArticle);
  unnumberedEquation.blocks[0].numbered = false;
  const unnumberedReferences = buildArticleReferenceIndex(unnumberedEquation.blocks);
  assert.equal(unnumberedReferences.byLabel['eq:pythagorean']?.display, 'Equation', 'Named unnumbered equations must remain referenceable.');
  assert.equal(unnumberedReferences.byBlockId['equation-one'], undefined, 'Unnumbered equations must not display an automatic number.');

  const invalidResource = structuredClone(academicArticle);
  invalidResource.blocks.push({ id: 'unsafe-resource', type: 'resource', label: 'Unsafe link', url: 'javascript:alert(1)', resourceType: 'web' });
  assert.ok(getArticlePublishingIssues(invalidResource).some((issue) => issue.severity === 'error' && issue.message.includes('Resource URL')), 'Unsafe resource URLs must block publication.');

  console.log('Authoring contracts passed: article forking, optional draft summary, academic blocks, equation numbering, theorem numbering, proof and cross-reference resolution, duplicate/dangling labels, parameter validation and safe publishing links.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
