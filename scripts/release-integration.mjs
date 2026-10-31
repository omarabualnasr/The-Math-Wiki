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

const [symbolsPage, tablesTool, calculatorTool, playgroundPage, graphTool, drawingLayer, readAloud, graphBlock, mathEngine, sumArticle] = await Promise.all([
  read('src/features/symbols/MathSymbolsPage.tsx'), read('src/features/playground/TablesTool.tsx'),
  read('src/features/playground/CalculatorTool.tsx'), read('src/features/playground/MathPlaygroundPage.tsx'),
  read('src/features/playground/GraphTool.tsx'), read('src/features/articles/DrawingLayer.tsx'),
  read('src/features/articles/ReadAloud.tsx'), read('src/features/articles/GraphBlock.tsx'),
  read('src/engine/mathEngine.ts'), read('src/data/pages/sum.json'),
]);

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
for (const route of ['/branches', '/articles/:slug', '/editor/new', '/playground', '/symbols', '/bookmarks', '/workspace', '/learning', '/settings']) {
  assert.ok(app.includes(`path="${route}"`), `Missing application route ${route}.`);
}
assert.doesNotMatch(app, /path="\/my-pages"|About the Creator/, 'Removed library pages must not be routed.');
assert.match(app, /sidebar-search/, 'The global search field must be in the side panel.');
assert.match(app, /sidebar-create-button/, 'Page creation must be accessible from the side panel.');
assert.match(app, /sidebar-settings-link/, 'Settings must be anchored at the bottom of the side panel.');
assert.doesNotMatch(articlePage, /to=\"\/learning\"/, 'Article actions must not link to the Learning Center while it is marked Soon.');
assert.doesNotMatch(articlePage, /onContextMenu=.*preventDefault/, 'Native browser text-selection context menus must remain available.');
assert.doesNotMatch(articlePage, /Save offline|to=\"\/learning\"|article-reader-note-count/, 'Article pages must not show offline or Soon Learning Center actions or extra annotation microcopy.');
assert.match(app, /FIRST ARTICLE[\s\S]*Explore SUM[\s\S]*Read the Article/, 'Home must show the compact first-article callout.');
assert.doesNotMatch(app, /A growing reference|21 of 21 branches|21 branches|Local data storage|Browser storage estimate|Local save access|Color mode/, 'Removed dashboard counts, storage diagnostics and duplicate mode controls must stay absent.');
assert.match(app, /Content width[\s\S]*?Soon/, 'Content width must remain visibly marked Soon.');
assert.doesNotMatch(symbolsPage, /symbols-summary-row|121|catalogued symbols|PNG \+ LaTeX/, 'Symbol statistics cards must remain removed.');
assert.doesNotMatch(tablesTool, /Scrollable table|Copy as tab-separated values|Multiplication table · 12 × 12/, 'Table footer microcopy must remain removed.');
assert.doesNotMatch(calculatorTool, /Supports parentheses|Enter to calculate/, 'Calculator footer instructions must remain removed.');
assert.doesNotMatch(playgroundPage, /Five workspaces|Calculations and constructions run in your browser|Personal history and geometry are stored on this device/, 'Playground summary cards and footer microcopy must remain removed.');
assert.match(playgroundPage, /label: 'Geometry and shapes',[\s\S]*?soon: true/, 'Geometry and shapes must remain visibly marked Soon.');
assert.match(playgroundPage, /label: 'Math engine',[\s\S]*?soon: true/, 'Math engine must remain visibly marked Soon.');
assert.doesNotMatch(calculatorTool, /Save session/, 'The calculator must not expose a Save session action.');
assert.doesNotMatch(graphTool, /Save graph/, 'The graphing workspace must not expose a Save graph action.');
for (const label of ['Polar', 'Parametric', 'Implicit', '3D Surface', 'Visualizations']) {
  const modeLine = graphTool.split('\n').find((line) => line.includes(`label: '${label}'`)) || '';
  assert.match(modeLine, /soon: true/, `${label} graph mode must be marked Soon.`);
}
assert.doesNotMatch(graphTool, /graph-notes-panel|Graphing Tools/, 'The graphing tools side panel must remain removed.');
assert.match(graphTool, /item\.soon && <span className="soon-pill">Soon<\/span>/, 'Disabled graph modes must display a Soon badge.');
assert.match(graphTool, /disabled=\{Boolean\(item\.soon\)\}/, 'Soon graph modes must not be clickable.');
assert.match(mathEngine, /parse\(source\)\.toTex\(\)/, 'Graph expressions must use mathematical TeX formatting for named functions.');
assert.match(graphTool, /expressionToLatex\(item\.expression\)/, 'Function labels must use mathematical expression formatting.');
assert.doesNotMatch(graphBlock, /INTERACTIVE GRAPH|Move the slider to see how the sum/, 'The sample graph must not show a graph heading or explanatory caption.');
assert.doesNotMatch(sumArticle, /Move the slider to see how the sum of the first n positive integers grows\.|Interactive graph/i, 'The Sum article graph copy must remain removed.');
assert.match(readAloud, /read-aloud-soon[\s\S]*?Soon/, 'Read Aloud must be marked Soon.');
assert.match(readAloud, /disabled aria-disabled="true"/, 'Read Aloud controls must be disabled.');
assert.match(articlePage, /Split view[\s\S]*?Soon/, 'Split View must remain visibly marked Soon.');
assert.match(articlePage, /Create quiz[\s\S]*?Soon[\s\S]*?Worksheet[\s\S]*?Soon[\s\S]*?Timed exam[\s\S]*?Soon/, 'Quiz, worksheet and timed exam actions must be marked Soon.');
assert.match(drawingLayer, /Finish annotating/, 'The annotation toolbar must retain its Finish annotating action.');
assert.doesNotMatch(drawingLayer, /aria-label="Close annotation toolbar"|<X size=/, 'The annotation toolbar must not display a close X button.');
assert.match(drawingLayer, /Delete drawings only/, 'Users must be able to delete drawings without deleting text highlights.');
assert.match(drawingLayer, /Delete everything/, 'Users must be able to delete drawings, highlights and notes together.');
assert.match(drawingLayer, /onClearTextAnnotations\(\)/, 'Delete-all action must clear text highlights and notes.');
assert.match(playgroundPage, /label: 'Geometry and shapes',[\s\S]*?soon: true/, 'Geometry and shapes must remain visibly marked Soon.');
assert.match(playgroundPage, /label: 'Math engine',[\s\S]*?soon: true/, 'Math engine must remain visibly marked Soon.');
assert.doesNotMatch(calculatorTool, /Save session/, 'The calculator must not expose a Save session action.');
assert.doesNotMatch(graphTool, /Save graph/, 'The graphing workspace must not expose a Save graph action.');
for (const label of ['Polar', 'Parametric', 'Implicit', '3D Surface', 'Visualizations']) {
  assert.ok(graphTool.includes(`label: '${label}'`) && graphTool.includes(`label: '${label}', description:`), `${label} graph mode must exist.`);
  const modeLine = graphTool.split('\n').find((line) => line.includes(`label: '${label}'`)) || '';
  assert.match(modeLine, /soon: true/, `${label} graph mode must be marked Soon.`);
}
assert.doesNotMatch(graphTool, /graph-notes-panel|Graphing Tools/, 'The graphing tools side panel must remain removed.');
assert.match(graphTool, /item\.soon && <span className="soon-pill">Soon<\/span>/, 'Disabled graph modes must display a Soon badge.');
assert.match(graphTool, /disabled=\{Boolean\(item\.soon\)\}/, 'Soon graph modes must not be clickable.');
assert.match(mathEngine, /parse\(source\)\.toTex\(\)/, 'Graph expressions must use mathematical TeX formatting for named functions.');
assert.match(graphTool, /expressionToLatex\(item\.expression\)/, 'Function labels must use mathematical expression formatting.');
assert.doesNotMatch(graphBlock, /INTERACTIVE GRAPH|Move the slider to see how the sum/, 'The sample graph must not show a graph heading or explanatory caption.');
assert.doesNotMatch(sumArticle, /Move the slider to see how the sum of the first n positive integers grows\.|Interactive graph/i, 'The Sum article graph copy must remain removed.');
assert.match(readAloud, /read-aloud-soon[\s\S]*?Soon/, 'Read Aloud must be marked Soon.');
assert.match(readAloud, /disabled aria-disabled="true"/, 'Read Aloud controls must be disabled.');
assert.match(articlePage, /Split view[\s\S]*?Soon/, 'Split View must remain visibly marked Soon.');
assert.match(articlePage, /Create quiz[\s\S]*?Soon[\s\S]*?Worksheet[\s\S]*?Soon[\s\S]*?Timed exam[\s\S]*?Soon/, 'Quiz, worksheet and timed exam actions must be marked Soon.');
assert.match(drawingLayer, /Finish annotating/, 'The annotation toolbar must retain its Finish annotating action.');
assert.doesNotMatch(drawingLayer, /aria-label="Close annotation toolbar"|<X size=/, 'The annotation toolbar must not display a close X button.');
assert.match(drawingLayer, /Delete drawings only/, 'Users must be able to delete drawings without deleting text highlights.');
assert.match(drawingLayer, /Delete everything/, 'Users must be able to delete drawings, highlights and notes together.');
assert.match(drawingLayer, /onClearTextAnnotations\(\)/, 'Delete-all action must clear text highlights and notes.');
assert.match(app, /Math Wiki Mission[\s\S]*?Soon/, 'Math Wiki Mission must remain visible as a disabled Soon item.');
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
assert.match(globalCss, /\.nav-disabled[^}]*pointer-events:\s*none/, 'Soon navigation items must not be interactive.');
assert.match(readme, /Pass 7|offline|backup/i, 'Release documentation must describe the personal workspace and offline capabilities.');
assert.match(readme, /Pass 8|release/i, 'Release documentation must include current QA guidance.');

console.log(`Release integration checks passed: ${new Set(blockTypes).size} article block types, ${contractScripts.length} CI contract suites, routed application modules, guarded data recovery, safe PWA cache promotion, responsive and reduced-motion support.`);
