import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-workspace-'));
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  failValue = null;
  setItem(key, value) { if (this.failValue !== null && String(value) === this.failValue) { this.failValue = null; throw new Error('QuotaExceededError'); } this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}

try {
  const localCompiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const command = existsSync(localCompiler) ? process.execPath : 'tsc';
  const prefix = existsSync(localCompiler) ? [localCompiler] : [];
  execFileSync(command, [
    ...prefix, 'src/engine/safeStorage.ts', 'src/engine/polynomialEngine.ts', 'src/engine/learningEngine.ts',
    'src/engine/learningStorage.ts', 'src/engine/personalWorkspaceStorage.ts', 'src/engine/zipArchive.ts',
    'src/engine/workspaceBackup.ts', '--target', 'ES2020', '--module', 'commonjs', '--strict', '--skipLibCheck',
    '--lib', 'ES2020,DOM', '--outDir', temp,
  ], { cwd: root, stdio: 'pipe' });

  const require = createRequire(import.meta.url);
  const workspace = require(path.join(temp, 'engine/personalWorkspaceStorage.js'));
  const learningStorage = require(path.join(temp, 'engine/learningStorage.js'));
  const backup = require(path.join(temp, 'engine/workspaceBackup.js'));
  const zip = require(path.join(temp, 'engine/zipArchive.js'));
  const localStorage = new MemoryStorage();
  globalThis.window = { localStorage, dispatchEvent() { return true; } };

  assert.equal(workspace.isPersonalWorkspaceState({ version: 1, lists: [], sessions: [], offlineArticleIds: [] }), true);
  localStorage.setItem('math-wiki:personal-workspace:v1', '{broken');
  await assert.rejects(() => workspace.loadPersonalWorkspace(), /fallback is not valid JSON/, 'Malformed fallback data must be reported rather than silently replaced.');
  assert.equal(localStorage.getItem('math-wiki:personal-workspace:v1'), '{broken', 'Malformed fallback data must remain untouched for recovery.');
  localStorage.removeItem('math-wiki:personal-workspace:v1');
  localStorage.setItem('math-wiki:learning-state:v1', '{broken');
  await assert.rejects(() => learningStorage.loadLearningState(), /fallback is not valid JSON/, 'Malformed learning fallback data must be reported rather than silently replaced.');
  assert.equal(localStorage.getItem('math-wiki:learning-state:v1'), '{broken', 'Malformed learning fallback data must remain untouched for recovery.');
  localStorage.removeItem('math-wiki:learning-state:v1');

  assert.equal(workspace.isPersonalWorkspaceState({ version: 1, updatedAt: 'not-a-date', lists: [], sessions: [], offlineArticleIds: [] }), false, 'Invalid synchronization timestamps must be rejected.');
  const olderWorkspace = { version: 1, updatedAt: '2026-10-01T00:00:00.000Z', lists: [], sessions: [], offlineArticleIds: [] };
  const newerWorkspace = { ...olderWorkspace, updatedAt: '2026-10-02T00:00:00.000Z', lists: [{ id: 'latest', kind: 'collection', name: 'Latest', description: '', articleIds: [], createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' }] };
  assert.equal(workspace.selectNewestPersonalWorkspace(olderWorkspace, newerWorkspace).lists[0].id, 'latest', 'Newer local fallback data must win over a stale IndexedDB snapshot.');
  assert.equal(workspace.selectNewestPersonalWorkspace(newerWorkspace, olderWorkspace).lists[0].id, 'latest', 'Newer IndexedDB data must win over stale fallback data.');
  const olderLearning = { version: 1, updatedAt: '2026-10-01T00:00:00.000Z', attempts: [], flashcards: [] };
  const newerLearning = { ...olderLearning, updatedAt: '2026-10-02T00:00:00.000Z' };
  assert.equal(learningStorage.selectNewestLearningState(olderLearning, newerLearning).updatedAt, newerLearning.updatedAt, 'Newer learning fallback data must win over a stale IndexedDB snapshot.');
  assert.equal(learningStorage.selectNewestLearningState(newerLearning, olderLearning).updatedAt, newerLearning.updatedAt, 'Newer learning IndexedDB data must win over stale fallback data.');

  assert.equal(workspace.isPersonalWorkspaceState({ version: 1, lists: [], sessions: [{ id: 'x', kind: 'graph', name: 'bad', payload: { x: undefined }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }], offlineArticleIds: [] }), false, 'Undefined values must not pass JSON payload validation.');

  const collection = await workspace.createWorkspaceList('collection', 'Calculus references', 'Important calculus pages');
  const readingList = await workspace.createWorkspaceList('reading-list', 'Study next');
  await workspace.updateWorkspaceList(collection.id, { articleIds: ['sum', 'derivative', 'integral'] });
  await workspace.updateWorkspaceList(readingList.id, { articleIds: ['sum'] });
  const graphSession = await workspace.saveWorkspaceSession('graph', 'Parabola comparison', { mode: 'cartesian', expression: 'x^2', functions: [{ id: 'f1', expression: 'x^2' }], xMin: -5, xMax: 5 });
  const geometrySession = await workspace.saveWorkspaceSession('geometry', 'Triangle construction', { objects: [{ id: 'p1', kind: 'Point', points: [{ x: 0, y: 0 }] }] });
  const calculatorSession = await workspace.saveWorkspaceSession('calculator', 'Exact arithmetic', { expression: 'sqrt(2)', answer: '1.4142', angleMode: 'rad', history: [] });
  assert.equal((await workspace.loadPersonalWorkspace()).sessions.length, 3);
  await workspace.setArticleOffline('sum', true);
  assert.deepEqual((await workspace.loadPersonalWorkspace()).offlineArticleIds, ['sum']);

  localStorage.setItem('math-wiki:settings:theme:v1', 'dark');
  localStorage.setItem('math-wiki:articles:v1', JSON.stringify([{ id: 'draft-1', title: 'Local draft' }]));
  localStorage.setItem('math-wiki:bookmarks:v1', JSON.stringify(['sum']));

  const blob = await backup.createWorkspaceBackupBlob();
  assert.ok(blob.size > 100, 'Backup ZIP should contain a manifest.');
  const file = new File([await blob.arrayBuffer()], 'workspace-backup.zip', { type: 'application/zip' });
  const preview = await backup.inspectWorkspaceBackup(file);
  assert.equal(preview.counts.articles, 1);
  assert.equal(preview.counts.bookmarks, 1);
  assert.equal(preview.counts.workspace, 7);
  assert.equal(preview.bundle.workspaceState.sessions.find((item) => item.id === graphSession.id)?.name, 'Parabola comparison');
  assert.ok(preview.bundle.workspaceState.sessions.some((item) => item.id === geometrySession.id));
  assert.ok(preview.bundle.workspaceState.sessions.some((item) => item.id === calculatorSession.id));

  // Restore only selected categories: unrelated current article data must remain intact.
  localStorage.setItem('math-wiki:settings:theme:v1', 'light');
  localStorage.setItem('math-wiki:articles:v1', JSON.stringify([{ id: 'current-draft' }]));
  await backup.restoreWorkspaceBackup(preview, ['settings', 'workspace']);
  assert.equal(localStorage.getItem('math-wiki:settings:theme:v1'), 'dark');
  assert.deepEqual(JSON.parse(localStorage.getItem('math-wiki:articles:v1')), [{ id: 'current-draft' }]);
  assert.equal((await workspace.loadPersonalWorkspace()).lists.length, 2);

  await backup.restoreWorkspaceBackup(preview, ['articles']);
  assert.deepEqual(JSON.parse(localStorage.getItem('math-wiki:articles:v1')), [{ id: 'draft-1', title: 'Local draft' }]);

  // A quota error during a category restore must restore the prior values.
  localStorage.setItem('math-wiki:articles:v1', JSON.stringify([{ id: 'current-before-failed-restore' }]));
  localStorage.failValue = JSON.stringify([{ id: 'draft-1', title: 'Local draft' }]);
  await assert.rejects(() => backup.restoreWorkspaceBackup(preview, ['articles']), /Restore could not be completed/);
  assert.deepEqual(JSON.parse(localStorage.getItem('math-wiki:articles:v1')), [{ id: 'current-before-failed-restore' }], 'A failed restore must roll back the existing category data.');

  const corrupted = new Uint8Array(await blob.arrayBuffer());
  const filenameLength = new DataView(corrupted.buffer).getUint16(26, true);
  corrupted[30 + filenameLength + 4] ^= 0xff;
  assert.throws(() => zip.extractStoredZipArchive(corrupted.buffer), /integrity check/, 'ZIP entry CRC must be checked.');
  const unsafeZip = zip.createZipArchive([{ name: '../outside.json', data: new TextEncoder().encode('{}') }]);
  const unsafeBuffer = await unsafeZip.arrayBuffer();
  assert.throws(() => zip.extractStoredZipArchive(unsafeBuffer), /unsafe/, 'Unsafe archive paths must be rejected.');

  assert.equal(backup.classifyBackupKey('math-wiki:articles:v1'), 'articles');
  assert.equal(backup.classifyBackupKey('math-wiki:drawings:v2'), 'drawings');
  assert.equal(backup.classifyBackupKey('math-wiki:settings:theme:v1'), 'settings');
  console.log('Personal workspace contracts passed: validated collections, reading lists, tool sessions, offline pins, ZIP backup integrity, selective restore rollback and path safety.');
} finally {
  delete globalThis.window;
  await rm(temp, { recursive: true, force: true });
}
