import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-contracts-'));
const sample = JSON.parse(await readFile(path.join(root, 'src/data/pages/sum.json'), 'utf8'));

try {
  const localCompiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const compilerCommand = existsSync(localCompiler) ? process.execPath : 'tsc';
  const compilerArgs = existsSync(localCompiler) ? [localCompiler] : [];
  execFileSync(compilerCommand, [
    ...compilerArgs,
    'src/types/article.ts',
    'src/engine/safeStorage.ts',
    'src/engine/storageMigrations.ts',
    'src/engine/articleValidation.ts',
    '--target', 'ES2020',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--strict',
    '--skipLibCheck',
    '--outDir', temp,
  ], { cwd: root, stdio: 'pipe' });

  const require = createRequire(import.meta.url);
  const { validateArticle } = require(path.join(temp, 'engine/articleValidation.js'));
  const { applyStorageMigrations, CURRENT_STORAGE_SCHEMA_VERSION } = require(path.join(temp, 'engine/storageMigrations.js'));

  const valid = validateArticle(sample);
  assert.equal(valid.valid, true, `Sum article should validate: ${JSON.stringify(valid.issues)}`);

  const invalidRange = structuredClone(sample);
  const graph = invalidRange.blocks.find((block) => block.type === 'graph');
  graph.xMin = 10;
  graph.xMax = 10;
  assert.equal(validateArticle(invalidRange).valid, false, 'Graph ranges must be strictly increasing.');

  const duplicateBlockIds = structuredClone(sample);
  duplicateBlockIds.blocks[1].id = duplicateBlockIds.blocks[0].id;
  assert.equal(validateArticle(duplicateBlockIds).valid, false, 'Article block IDs must be unique.');

  const malformedTable = structuredClone(sample);
  malformedTable.blocks.push({ id: 'invalid-table', type: 'table', headers: ['A', 'B'], rows: [['only one']] });
  assert.equal(validateArticle(malformedTable).valid, false, 'Table rows must match header width.');

  const futureSchema = structuredClone(sample);
  futureSchema.schemaVersion = 999;
  assert.equal(validateArticle(futureSchema).valid, false, 'Unknown article schema versions must be rejected.');

  class MemoryStorage {
    values = new Map();
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
  }

  const storage = new MemoryStorage();
  storage.setItem('mw-theme', 'dark');
  storage.setItem('mw:calculator-history:v1', '[{"expression":"1+1"}]');
  storage.setItem('math-wiki:settings:theme:v1', 'light');
  const migration = applyStorageMigrations(storage);
  assert.equal(migration.completed, true, 'Migration should complete.');
  assert.equal(migration.toVersion, CURRENT_STORAGE_SCHEMA_VERSION);
  assert.equal(storage.getItem('math-wiki:settings:theme:v1'), 'light', 'Existing destination settings must not be overwritten.');
  assert.equal(storage.getItem('math-wiki:calculator-history:v1'), '[{"expression":"1+1"}]', 'Legacy calculator history should be copied.');
  assert.equal(storage.getItem('mw-theme'), 'dark', 'Legacy source keys must be preserved.');
  const secondRun = applyStorageMigrations(storage);
  assert.equal(secondRun.copiedKeys.length, 0, 'Migration must be idempotent.');

  class FailingStorage extends MemoryStorage {
    setItem(key, value) {
      if (key === 'math-wiki:settings:theme:v1') throw new Error('quota');
      super.setItem(key, value);
    }
  }
  const failing = new FailingStorage();
  failing.setItem('mw-theme', 'dark');
  const failedMigration = applyStorageMigrations(failing);
  assert.equal(failedMigration.completed, false, 'Failed migration must be reported.');
  assert.equal(failing.getItem('math-wiki:storage-schema-version'), null, 'Schema marker must not advance after partial migration.');

  console.log('Storage contracts passed: article validation, graph ranges, unique block IDs, table structure, schema rejection, non-destructive migration and retry safety.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
