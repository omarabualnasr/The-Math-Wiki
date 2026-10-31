import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const branchesSource = await read('src/data/branches.ts');
const branchMatches = [...branchesSource.matchAll(/id:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'/g)];
const branchIds = branchMatches.map((match) => match[1]);
assert.equal(branchIds.length, 21, `Expected 21 top-level mathematics branches; found ${branchIds.length}`);
assert.equal(new Set(branchIds).size, branchIds.length, 'Top-level branch IDs must be unique');

const topicGroups = [...branchesSource.matchAll(/topics:\s*\[([\s\S]*?)\]\.map\(topic\)/g)];
assert.equal(topicGroups.length, branchIds.length, 'Every branch must declare a topic list');
let topicCount = 0;
for (const group of topicGroups) {
  const titles = [...group[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const ids = titles.map((title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  assert.ok(ids.every(Boolean), 'Every topic must have a non-empty slug');
  assert.equal(new Set(ids).size, ids.length, 'Topic slugs must be unique within each branch');
  topicCount += titles.length;
}

const pageDir = path.join(root, 'src/data/pages');
const pageFiles = (await readdir(pageDir)).filter((name) => name.endsWith('.json'));
assert.ok(pageFiles.includes('sum.json'), 'The complete Sum sample article must exist');
const articleIds = new Set();
for (const file of pageFiles) {
  const article = JSON.parse(await readFile(path.join(pageDir, file), 'utf8'));
  assert.equal(article.schemaVersion, 1, `${file}: schemaVersion must be 1`);
  for (const key of ['id', 'slug', 'title', 'level', 'difficulty', 'branch', 'blocks']) assert.ok(article[key] !== undefined, `${file}: missing ${key}`);
  assert.ok(Array.isArray(article.blocks), `${file}: blocks must be an array`);
  assert.ok(!articleIds.has(article.id), `${file}: duplicate article ID ${article.id}`);
  articleIds.add(article.id);
  const blockIds = article.blocks.map((block) => block.id);
  assert.ok(blockIds.every((id) => typeof id === 'string' && id.length > 0), `${file}: every block needs an ID`);
  assert.equal(new Set(blockIds).size, blockIds.length, `${file}: block IDs must be unique`);
}

const main = await read('src/main.tsx');
const vite = await read('vite.config.ts');
const workflow = await read('.github/workflows/deploy.yml');
const app = await read('src/app/App.tsx');
const articlePage = await read('src/features/articles/ArticlePage.tsx');
const playground = await read('src/features/playground/MathPlaygroundPage.tsx');
const mathEngineTool = await read('src/features/playground/MathEngineTool.tsx');
const graphTool = await read('src/features/playground/GraphTool.tsx');
const geometryTool = await read('src/features/playground/GeometryTool.tsx');
const graphEngine = await read('src/engine/graphEngine.ts');
const geometryEngine = await read('src/engine/geometryEngine.ts');
const advancedMathEngine = await read('src/engine/advancedMathEngine.ts');
const matrixEngine = await read('src/engine/matrixEngine.ts');
const statisticsEngine = await read('src/engine/statisticsEngine.ts');
const storage = await read('src/engine/safeStorage.ts');
const migrations = await read('src/engine/storageMigrations.ts');
const validation = await read('src/engine/articleValidation.ts');
const mainEntry = await read('src/main.tsx');
const editor = await read('src/features/articles/ArticleEditor.tsx');
const articleTypes = await read('src/types/article.ts');
const references = await read('src/engine/articleReferences.ts');
const publishing = await read('src/engine/articlePublishing.ts');
const forking = await read('src/engine/articleForking.ts');
const pkg = JSON.parse(await read('package.json'));
assert.match(main, /HashRouter/, 'GitHub Pages app must use HashRouter for refresh-safe deep links');
assert.match(vite, /base:\s*['"]\.\/['"]/, 'Vite must emit relative asset paths for project pages');
assert.match(workflow, /actions\/deploy-pages@v4/, 'GitHub Pages deployment action must be configured');
assert.match(workflow, /npm run test:contracts/, 'Deployment workflow must run storage/data contract tests.');
for (const script of ['test:authoring', 'test:math-engine', 'test:graph-tools', 'test:learning', 'test:search', 'test:workspace', 'test:offline', 'test:integration']) {
  assert.match(workflow, new RegExp(`npm run ${script.replace(':', ':')}`), `Deployment workflow must run ${script}.`);
}
assert.match(workflow, /npm run build/, 'Deployment workflow must build the application');
assert.match(app, /safeStorageGet/, 'App preferences must use guarded browser storage');
assert.match(articlePage, /Mind Linker[\s\S]*?Soon/, 'Mind Linker must be present and marked Soon');
assert.match(articlePage, /Compare Mode[\s\S]*?Soon/, 'Compare Mode must be present and marked Soon');
assert.match(articlePage, /Video[\s\S]*?Soon[\s\S]*?Book[\s\S]*?Soon/, 'Video and Book reading modes must be present and marked Soon');
assert.match(app, /Account[\s\S]*?Soon/, 'Account must be visible and marked Soon');
assert.match(app, /Enable Sound Effects[\s\S]*?Soon/, 'Sound effects must be visible and marked Soon');
assert.match(app, /English[\s\S]*?More languages to come later/, 'The interface must be marked as English-first');
for (const label of ['Math Toolkit for Programming', 'Math to Code', 'Math Design on Figma', 'Graphs and Equations to Embed Outside']) {
  assert.ok(playground.includes(label), `${label} must be visible in the playground and marked Soon`);
}
assert.equal(pkg.scripts?.build, 'tsc -b && vite build', 'Build script must type-check before bundling');
for (const version of Object.values(pkg.dependencies || {}).concat(Object.values(pkg.devDependencies || {}))) {
  assert.ok(typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version), `Dependencies must be pinned to exact versions: ${version}`);
}
assert.ok(pkg.scripts?.['test:smoke'], 'Release smoke-test script must be configured');
assert.equal(pkg.scripts?.['test:contracts'], 'node scripts/storage-contracts.mjs', 'Storage contract tests must be configured.');
assert.equal(pkg.scripts?.['test:authoring'], 'node scripts/authoring-contracts.mjs', 'Article authoring contracts must be configured.');
assert.match(articleTypes, /interface StatementBlock/, 'Structured mathematical statement blocks must be supported.');
assert.match(articleTypes, /interface ProofBlock/, 'Proof blocks must be supported.');
assert.match(articleTypes, /interface ParameterBlock/, 'Interactive parameter blocks must be supported.');
assert.match(editor, /Article templates/, 'Article templates must be available in the editor.');
assert.match(editor, /Revision history/, 'Article revision history must be available.');
assert.match(editor, /Publishing preflight/, 'Publishing preflight must be available.');
assert.match(editor, /createArticleFork/, 'Published articles must be copied into independent editable drafts.');
assert.match(articlePage, /Create editable copy/, 'Published article reader must offer an editable copy instead of overwriting repository content.');
assert.match(app, /article\.status === 'published'/, 'Branch pages must list published content, not local drafts.');
assert.match(forking, /createArticleFork/, 'The article fork helper must exist.');
assert.match(references, /buildArticleReferenceIndex/, 'Article equation and theorem reference indexing must exist.');
assert.match(publishing, /getArticlePublishingIssues/, 'Article publishing validation must exist.');
assert.match(storage, /safeStorageGetJson/, 'Shared guarded JSON storage helper must exist.');
assert.match(migrations, /LEGACY_KEY_MIGRATIONS/, 'Legacy storage key migrations must be defined.');
assert.match(mainEntry, /runStorageMigrations\(\)/, 'Storage migrations must run before the application renders.');
assert.match(validation, /Duplicate block ID/, 'Article validation must detect duplicate block IDs.');
assert.match(validation, /Graph maximum x must be greater than minimum x/, 'Graph ranges must be validated.');
assert.match(editor, /Article validation:/, 'Editor must display article validation feedback.');

const learningPage = await read('src/features/learning/LearningCenterPage.tsx');
const learningEngine = await read('src/engine/learningEngine.ts');
const learningStorage = await read('src/engine/learningStorage.ts');
const searchEngine = await read('src/engine/searchEngine.ts');
const searchContracts = await read('scripts/search-contracts.mjs');
assert.match(app, /path="\/learning" element={<LearningCenterPage \/>}/, 'The Learning Center route must be registered.');
assert.match(app, /label: 'Learning Center'/, 'The Learning Center must appear in navigation.');
assert.match(learningEngine, /generateQuestionSet/, 'The learning engine must build question sets.');
assert.match(learningEngine, /scheduleFlashcardReview/, 'Spaced repetition scheduling must be available.');
assert.match(learningStorage, /indexedDB/, 'Learning data must use IndexedDB when available.');
assert.match(learningPage, /Common mistakes/, 'The Learning Center must include mistake review.');
assert.ok(pkg.scripts?.['test:learning'], 'Learning contracts must be configured.');
assert.ok(pkg.scripts?.['test:search'], 'Advanced search contracts must be configured.');
assert.match(workflow, /npm run test:search/, 'Deployment workflow must run the advanced search contracts.');
assert.match(app, /buildSearchIndex/, 'The command bar must use the shared search index.');
assert.match(app, /searchDocuments/, 'The command bar must use ranked search results.');
assert.match(app, /Recent searches/, 'Recent searches must be available in the command palette.');
assert.match(app, /branch:algebra[\s\S]*level:university[\s\S]*difficulty:easy[\s\S]*type:formula/, 'The command palette must surface the supported search operators.');
assert.match(searchEngine, /parseSearchQuery/, 'Search operators and quoted phrases must be parsed by the search engine.');
assert.match(searchEngine, /getSearchSuggestions/, 'Search suggestions must be implemented.');
assert.match(searchEngine, /blockSearchType/, 'Search documents must index article block types.');
assert.match(searchContracts, /LaTeX commands and subscripts should be searchable/, 'Search contracts must cover mathematical notation.');

console.log(`Release smoke checks passed: ${branchIds.length} branches, ${topicCount} topic entries, ${pageFiles.length} published article JSON file(s).`);
console.log('Deployment routing, article IDs, block IDs, guarded settings storage, Soon labels and package scripts verified.');
