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
const pkg = JSON.parse(await read('package.json'));
assert.match(main, /HashRouter/, 'GitHub Pages app must use HashRouter for refresh-safe deep links');
assert.match(vite, /base:\s*['"]\.\/['"]/, 'Vite must emit relative asset paths for project pages');
assert.match(workflow, /actions\/deploy-pages@v4/, 'GitHub Pages deployment action must be configured');
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

console.log(`Release smoke checks passed: ${branchIds.length} branches, ${topicCount} topic entries, ${pageFiles.length} published article JSON file(s).`);
console.log('Deployment routing, article IDs, block IDs, guarded settings storage, Soon labels and package scripts verified.');
