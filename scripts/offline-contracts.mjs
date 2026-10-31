import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const [manifestText, worker, pwa, main, index, app, workspacePage, articlePage, playground, graphTool, geometryTool, calculatorTool, backup, workspaceStorage, articleCatalog] = await Promise.all([
  read('public/manifest.webmanifest'), read('public/sw.js'), read('src/engine/pwa.ts'), read('src/main.tsx'), read('index.html'),
  read('src/app/App.tsx'), read('src/features/workspace/PersonalWorkspacePage.tsx'), read('src/features/articles/ArticlePage.tsx'),
  read('src/features/playground/MathPlaygroundPage.tsx'), read('src/features/playground/GraphTool.tsx'), read('src/features/playground/GeometryTool.tsx'),
  read('src/features/playground/CalculatorTool.tsx'), read('src/engine/workspaceBackup.ts'), read('src/engine/personalWorkspaceStorage.ts'),
  read('src/data/articles.ts'),
]);
const manifest = JSON.parse(manifestText);
assert.equal(manifest.display, 'standalone', 'The application manifest should request standalone display.');
assert.ok(manifest.start_url.includes('#/'), 'The app start URL must open the HashRouter root.');
assert.ok(manifest.scope === './' || manifest.scope.endsWith('/'), 'The app manifest scope must be relative to the deployed project site.');
for (const icon of manifest.icons) {
  const assetPath = path.join(root, 'public', icon.src.replace(/^\.\//, ''));
  const buffer = await readFile(assetPath);
  assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a', `${icon.src} must be a PNG.`);
  assert.equal(buffer.readUInt32BE(16), Number.parseInt(icon.sizes.split('x')[0], 10), `${icon.src} width must match manifest.`);
  assert.equal(buffer.readUInt32BE(20), Number.parseInt(icon.sizes.split('x')[1], 10), `${icon.src} height must match manifest.`);
}
new vm.Script(worker, { filename: 'public/sw.js' });
assert.match(worker, /CACHE_VERSION = 'math-wiki-pwa-v3'/, 'The service worker cache version must advance for the updated offline strategy.');
assert.match(worker, /ASSET_CACHE/, 'The service worker must use a separate app-bundle cache.');
assert.match(worker, /currentAssets/, 'Old hashed application bundles must be pruned without deleting runtime media.');
assert.match(worker, /previous offline version was kept/, 'A failed update must preserve the previous offline version.');
assert.ok(worker.indexOf('await shell.put(indexUrl, indexResponse.clone())') > worker.indexOf('if (!allScriptsCached || !allStylesCached)'), 'The cached entry page must only be replaced after every new bundle asset is available.');
assert.match(worker, /if \(!result\.ok\) throw/, 'A failed first install must not activate a worker with an incomplete app cache.');
assert.match(worker, /request\.mode === 'navigate'/, 'Offline navigation fallback must be present.');
const navigationHandler = worker.slice(worker.indexOf("if (request.mode === 'navigate')"), worker.indexOf("if (url.pathname.includes('/api/')"));
assert.doesNotMatch(navigationHandler, /cache\.put\(new URL\('index\.html'/, 'Normal navigation must not replace the last-known-good offline entry before the update-safe cache flow validates its bundles.');
assert.match(worker, /url\.origin !== self\.location\.origin/, 'Third-party resources must not be cached as if they were first-party offline content.');
assert.match(worker, /cache\.match\(new URL\('index\.html'/, 'Failed navigations must fall back to the cached app entry.');
assert.match(worker, /key\.startsWith\('math-wiki-pwa-'\)/, 'Activation may only delete caches owned by this application.');
assert.match(pwa, /navigator\.serviceWorker\.register/, 'The app must register its service worker.');
assert.match(pwa, /beforeinstallprompt/, 'Install prompt support must be implemented where browsers expose it.');
assert.match(main, /registerAppServiceWorker\(\)/, 'The service worker must register when the app starts.');
assert.match(index, /rel="manifest" href="\.\/manifest\.webmanifest"/, 'The HTML entry must reference the web app manifest.');
assert.match(app, /path="\/workspace" element=\{<PersonalWorkspacePage \/>\}/, 'Personal Workspace route must be registered.');
assert.match(workspacePage, /Collections & reading lists/, 'Personal collections and reading lists must be available.');
assert.match(workspacePage, /Download backup ZIP/, 'The workspace must export a full backup.');
assert.match(workspacePage, /Restore from backup/, 'The workspace must restore validated backups.');
assert.match(workspacePage, /Prepare offline/, 'The workspace must offer offline preparation.');
assert.doesNotMatch(articlePage, /Save offline/, 'Article pages must not display a Save offline action.');
assert.match(workspaceStorage, /setArticleOffline/, 'The personal workspace must retain the offline article pin storage API.');
assert.match(articleCatalog, /import\.meta\.glob<MathArticle>\('\.\/pages\/\*\.json', \{ eager: true/, 'Published article JSON must be bundled eagerly for the offline catalogue.');

assert.match(playground, /restoreSessionId/, 'The playground must support opening saved tool sessions.');
for (const [name, source] of [['graph', graphTool], ['geometry', geometryTool], ['calculator', calculatorTool]]) {
  assert.match(source, /saveWorkspaceSession/, `${name} sessions must be saveable.`);
  assert.match(source, /restoreSessionId/, `${name} sessions must be restorable.`);
}
assert.match(backup, /restoreWorkspaceBackup/, 'Selective backup restoration must exist.');
assert.match(backup, /extractStoredZipArchive/, 'Backup archives must be validated before restoration.');
assert.match(workspaceStorage, /isPersonalWorkspaceState/, 'Personal workspace records must be validated.');
const packageJson = JSON.parse(await read('package.json'));
assert.equal(packageJson.scripts?.['test:offline'], 'node scripts/offline-contracts.mjs', 'Offline/PWA contract test must be available as an npm script.');
const workflow = await read('.github/workflows/deploy.yml');
assert.match(workflow, /npm run test:offline/, 'GitHub Actions must run the offline/PWA contracts before building.');
const swStat = await stat(path.join(root, 'public/sw.js'));
assert.ok(swStat.size < 32 * 1024, 'Service worker should remain small and self-contained.');
console.log('Offline/PWA contracts passed: install manifest, app icons, service-worker syntax, GitHub Pages scope, update-safe cache strategy, offline navigation fallback, article pins, saved tool sessions and selective ZIP backup/restore.');
