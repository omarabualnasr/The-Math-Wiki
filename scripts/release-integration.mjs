import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const [packageText, workflow, app, main, articleTypes, renderer, validator, pwa, serviceWorker, workspace, learning, articlePage, workspacePage, learningPage, globalCss, readme] = await Promise.all([
  read('package.json'), read('.github/workflows/deploy.yml'), read('src/app/App.tsx'), read('src/main.tsx'),
  read('src/types/article.ts'), read('src/features/articles/BlockRenderer.tsx'), read('src/engine/articleValidation.ts'),
  read('src/engine/pwa.ts'), read('public/sw.js'), read('src/engine/personalWorkspaceStorage.ts'),
  read('src/engine/learningStorage.ts'), read('src/features/articles/ArticlePage.tsx'),
  read('src/features/workspace/PersonalWorkspacePage.tsx'), read('src/features/learning/LearningCenterPage.tsx'),
  read('src/styles/global.css'), read('README.md'),
]);
const pkg = JSON.parse(packageText);

// Every declared article block must be validated and rendered.
const blockUnion = articleTypes.match(/export type ArticleBlock =([\s\S]*?);/);
assert.ok(blockUnion, 'ArticleBlock discriminated union must exist.');
const interfaceNames = [...blockUnion[1].matchAll(/\b([A-Z][A-Za-z]+Block)\b/g)].map((match) => match[1]);
assert.ok(interfaceNames.length >= 15, 'The article model should retain the extended block library.');
const blockTypes = [...articleTypes.matchAll(/type:\s*'([a-z]+)'/g)].map((match) => match[1]);
for (const type of new Set(blockTypes)) {
  assert.match(validator, new RegExp(`case '${type}'`), `Article validation must validate ${type} blocks.`);
  if (['theorem', 'lemma', 'corollary', 'proposition', 'axiom'].includes(type)) {
    assert.match(renderer, /isStatementBlock\(block\)/, `Statement block ${type} must use the shared statement renderer.`);
  } else {
    assert.match(renderer, new RegExp(`block\\.type === '${type}'`), `Article block ${type} must have a renderer.`);
  }
}

// All major page routes remain wired to the application shell.
for (const route of ['/branches', '/articles/:slug', '/editor/new', '/my-pages', '/playground', '/symbols', '/bookmarks', '/workspace', '/learning', '/settings']) {
  assert.ok(app.includes(`path="${route}"`), `Missing application route ${route}.`);
}
assert.match(main, /<HashRouter>/, 'GitHub Pages navigation must use HashRouter.');
assert.match(main, /registerAppServiceWorker\(\)/, 'The PWA service worker must register at startup.');
assert.match(main, /<ErrorBoundary>/, 'The app entry must retain its recovery boundary.');

// Personal storage must reconcile snapshots and preserve malformed records for recovery.
assert.match(workspace, /selectNewestPersonalWorkspace/, 'Workspace snapshots must reconcile stale IndexedDB and fallback data.');
assert.match(learning, /selectNewestLearningState/, 'Learning snapshots must reconcile stale IndexedDB and fallback data.');
assert.match(workspace, /failed validation and was left untouched/, 'Invalid workspace fallback data must not be silently replaced.');
assert.match(learning, /failed validation and was left untouched/, 'Invalid learning fallback data must not be silently replaced.');
assert.match(workspacePage, /Your saved workspace needs attention/, 'The workspace must show data-recovery errors explicitly.');
assert.match(learningPage, /Your saved learning data needs attention/, 'The learning dashboard must show data-recovery errors explicitly.');

// PWA updates must not replace a last-known-good index during ordinary navigation.
const navigationHandler = serviceWorker.slice(serviceWorker.indexOf("if (request.mode === 'navigate')"), serviceWorker.indexOf("if (url.pathname.includes('/api/')"));
assert.doesNotMatch(navigationHandler, /cache\.put\(new URL\('index\.html'/, 'Navigation must not replace the validated offline entry page.');
assert.match(pwa, /navigator\.serviceWorker\.register/, 'Service worker registration must remain implemented.');

// Every npm contract suite must be run in CI.
const contractScripts = Object.keys(pkg.scripts || {}).filter((key) => key.startsWith('test:'));
assert.ok(contractScripts.length >= 9, 'All current project test suites should remain registered.');
for (const script of contractScripts) assert.ok(workflow.includes(`npm run ${script}`), `GitHub Actions must run ${script}.`);
assert.match(workflow, /npm run build/, 'GitHub Actions must build the production application.');
assert.match(workflow, /actions\/deploy-pages@v4/, 'GitHub Actions must deploy the built Pages artifact.');
assert.match(pkg.engines?.node || '', />=20/, 'The project must declare a supported Node runtime.');

// Keep the expression surface constrained and maintain responsive layouts.
const sourceFiles = [
  'src/engine/mathEngine.ts', 'src/engine/polynomialEngine.ts', 'src/engine/advancedMathEngine.ts',
  'src/engine/graphEngine.ts', 'src/engine/geometryEngine.ts', 'src/engine/searchEngine.ts',
];
for (const file of sourceFiles) {
  const content = await read(file);
  assert.doesNotMatch(content, /\beval\s*\(|\bnew\s+Function\s*\(/, `${file} must not execute arbitrary JavaScript expressions.`);
}
assert.match(globalCss, /@media\s*\(/, 'Responsive breakpoints must remain present.');
assert.match(globalCss, /prefers-reduced-motion/, 'Reduced-motion preferences must remain supported.');
assert.match(readme, /Pass 7|offline|backup/i, 'Release documentation must describe the personal workspace and offline capabilities.');
assert.match(readme, /Pass 8|release/i, 'Release documentation must include current QA guidance.');

console.log(`Release integration checks passed: ${new Set(blockTypes).size} article block types, ${contractScripts.length} CI contract suites, routed application modules, guarded data recovery, safe PWA cache promotion, responsive and reduced-motion support.`);
