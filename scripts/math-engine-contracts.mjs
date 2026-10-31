import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-engine-'));
try {
  const localCompiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const command = existsSync(localCompiler) ? process.execPath : 'tsc';
  const prefix = existsSync(localCompiler) ? [localCompiler] : [];
  execFileSync(command, [...prefix,
    'src/engine/polynomialEngine.ts',
    'src/engine/matrixEngine.ts',
    'src/engine/statisticsEngine.ts',
    '--target', 'ES2020', '--module', 'commonjs', '--strict', '--skipLibCheck', '--outDir', temp,
  ], { cwd: root, stdio: 'pipe' });
  const require = createRequire(import.meta.url);
  const polynomial = require(path.join(temp, 'polynomialEngine.js'));
  const matrices = require(path.join(temp, 'matrixEngine.js'));
  const statistics = require(path.join(temp, 'statisticsEngine.js'));

  assert.deepEqual(polynomial.parsePolynomial('2*x + 3*x + 4'), [4, 5]);
  assert.deepEqual(polynomial.parsePolynomial('1e3*x + .5'), [0.5, 1000]);
  assert.equal(polynomial.formatPolynomial(polynomial.parsePolynomial('(x + 2)*(x + 3)')), 'x^2 + 5*x + 6');
  assert.equal(polynomial.formatPolynomial(polynomial.differentiatePolynomial(polynomial.parsePolynomial('x^3 + 2*x^2 + 4*x'))), '3*x^2 + 4*x + 4');
  assert.equal(polynomial.formatPolynomial(polynomial.integratePolynomial(polynomial.parsePolynomial('2*x + 4'))), 'x^2 + 4*x');
  const factorization = polynomial.factorPolynomialOverRationals(polynomial.parsePolynomial('x^2 - 5*x + 6'));
  assert.equal(factorization.complete, true);
  assert.equal(factorization.factors.join(' * '), '(x - 2) * (x - 3)');
  const negativeLeadingFactors = polynomial.factorPolynomialOverRationals(polynomial.parsePolynomial('-x^2 + 5*x - 6'));
  assert.equal(negativeLeadingFactors.factors.join(' * '), '-1 * (x - 2) * (x - 3)', 'Exponentiation must bind more tightly than unary minus.');
  const partialWithScale = polynomial.factorPolynomialOverRationals(polynomial.parsePolynomial('-2*x^3 + 4*x'));
  assert.equal(partialWithScale.factors.join(' * '), 'x * (-2*x^2 + 4)', 'A partial factorization must preserve its remaining leading coefficient exactly.');
  const partialFactorization = polynomial.factorPolynomialOverRationals(polynomial.parsePolynomial('x^2 - 2'));
  assert.equal(partialFactorization.complete, false);
  assert.match(partialFactorization.message, /No rational linear factor/);
  assert.deepEqual(polynomial.solvePolynomialRealRoots([6, -5, 1]), [2, 3]);
  assert.ok(polynomial.solvePolynomialRealRoots([-6, 11, -6, 1]).every((root, index) => Math.abs(root - (index + 1)) < 1e-7));
  assert.ok(Math.abs(polynomial.solvePolynomialRealRoots([1, -2, 1])[0] - 1) < 1e-8, 'Repeated real roots should be retained once.');
  assert.deepEqual(polynomial.solvePolynomialRealRoots([1, 0, 1]), [], 'Non-real roots must not be reported as real.');
  assert.equal(polynomial.solvePolynomialEquation('x + 2', '0').roots[0], -2);
  assert.equal(polynomial.solvePolynomialEquation('x', 'x').classification, 'identity');
  assert.equal(polynomial.solvePolynomialEquation('x + 1', 'x').classification, 'contradiction');
  assert.throws(() => polynomial.parsePolynomial('sin(x)'), /Only the variable/);
  assert.throws(() => polynomial.parsePolynomial('x^13'), /0 to 12/);

  assert.equal(matrices.determinant([[1, 2], [3, 4]]), -2);
  assert.equal(matrices.formatMatrix(matrices.inverseMatrix([[1, 2], [3, 4]])).split('\n')[0], '[ -2, 1 ]');
  assert.deepEqual(matrices.transposeMatrix([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
  assert.deepEqual(matrices.multiplyMatrices([[1, 2]], [[3], [4]]), [[11]]);
  assert.deepEqual(matrices.solveLinearSystem([[1, 2], [3, 4]], [5, 11]).solution, [1, 2]);
  assert.throws(() => matrices.inverseMatrix([[1, 2], [2, 4]]), /singular/);
  assert.throws(() => matrices.multiplyMatrices([[1, 2]], [[1, 2]]), /columns/);

  const summary = statistics.summarizeStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(summary.mean, 5);
  assert.equal(summary.median, 4.5);
  assert.deepEqual(summary.modes, [4]);
  assert.equal(summary.populationStandardDeviation, 2);
  assert.equal(statistics.combinations(10, 3), 120);
  assert.equal(statistics.permutations(10, 3), 720);
  assert.ok(Math.abs(statistics.binomialProbability(10, 3, 0.5) - 0.1171875) < 1e-12);
  const regression = statistics.linearRegression([1, 2, 3], [3, 5, 7]);
  assert.ok(Math.abs(regression.slope - 2) < 1e-12);
  assert.ok(Math.abs(regression.intercept - 1) < 1e-12);

  const playground = await readFile(path.join(root, 'src/features/playground/MathPlaygroundPage.tsx'), 'utf8');
  const newTool = await readFile(path.join(root, 'src/features/playground/MathEngineTool.tsx'), 'utf8');
  const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(playground, /MathEngineTool/);
  assert.match(newTool, /Factor polynomial/);
for (const label of ['Algebra', 'Calculus', 'Matrices', 'Statistics']) assert.ok(newTool.includes(`label: '${label}'`), `${label} workspace should be present.`);
  assert.match(workflow, /npm run test:math-engine/);

  console.log('Mathematics engine contracts passed: polynomial parsing/expansion/roots, matrix operations and systems, descriptive statistics, combinatorics, binomial probability and regression.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
