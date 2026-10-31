export type NumericMatrix = number[][];

function assertMatrix(matrix: NumericMatrix, name = 'Matrix'): void {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0]) || matrix[0].length === 0) throw new Error(`${name} must contain at least one row and one column.`);
  const width = matrix[0].length;
  if (matrix.some((row) => !Array.isArray(row) || row.length !== width || row.some((value) => !Number.isFinite(value)))) throw new Error(`${name} must be rectangular and contain only finite numbers.`);
}

export function parseMatrix(source: string): NumericMatrix {
  const rows = source.trim().split(/\s*;\s*|\r?\n/).filter(Boolean).map((row) => row.trim().split(/[\s,]+/).filter(Boolean).map(Number));
  assertMatrix(rows);
  return rows;
}

export function formatMatrix(matrix: NumericMatrix, precision = 8): string {
  assertMatrix(matrix);
  return matrix.map((row) => `[ ${row.map((value) => Number(value.toPrecision(precision)).toString()).join(', ')} ]`).join('\n');
}

export function transposeMatrix(matrix: NumericMatrix): NumericMatrix {
  assertMatrix(matrix);
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

export function addMatrices(left: NumericMatrix, right: NumericMatrix): NumericMatrix {
  assertMatrix(left, 'Matrix A'); assertMatrix(right, 'Matrix B');
  if (left.length !== right.length || left[0].length !== right[0].length) throw new Error('Matrix addition requires matrices of the same dimensions.');
  return left.map((row, r) => row.map((value, c) => value + right[r][c]));
}

export function multiplyMatrices(left: NumericMatrix, right: NumericMatrix): NumericMatrix {
  assertMatrix(left, 'Matrix A'); assertMatrix(right, 'Matrix B');
  if (left[0].length !== right.length) throw new Error('Matrix A columns must equal Matrix B rows.');
  return left.map((row) => right[0].map((_, column) => row.reduce((sum, value, index) => sum + value * right[index][column], 0)));
}

export function determinant(matrix: NumericMatrix): number {
  assertMatrix(matrix);
  if (matrix.length !== matrix[0].length) throw new Error('Determinant requires a square matrix.');
  const work = matrix.map((row) => row.slice());
  let result = 1;
  for (let column = 0; column < work.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < work.length; row += 1) if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    if (Math.abs(work[pivot][column]) < 1e-12) return 0;
    if (pivot !== column) { [work[pivot], work[column]] = [work[column], work[pivot]]; result *= -1; }
    const pivotValue = work[column][column];
    result *= pivotValue;
    for (let row = column + 1; row < work.length; row += 1) {
      const factor = work[row][column] / pivotValue;
      for (let c = column + 1; c < work.length; c += 1) work[row][c] -= factor * work[column][c];
    }
  }
  return result;
}

export function reducedRowEchelon(matrix: NumericMatrix): NumericMatrix {
  assertMatrix(matrix);
  const work = matrix.map((row) => row.slice());
  const rows = work.length;
  const columns = work[0].length;
  let lead = 0;
  for (let row = 0; row < rows && lead < columns; row += 1) {
    let pivot = row;
    while (pivot < rows && Math.abs(work[pivot][lead]) < 1e-12) pivot += 1;
    if (pivot === rows) { lead += 1; row -= 1; continue; }
    [work[pivot], work[row]] = [work[row], work[pivot]];
    const divisor = work[row][lead];
    work[row] = work[row].map((value) => value / divisor);
    for (let other = 0; other < rows; other += 1) {
      if (other === row) continue;
      const factor = work[other][lead];
      if (Math.abs(factor) < 1e-12) continue;
      work[other] = work[other].map((value, index) => value - factor * work[row][index]);
    }
    lead += 1;
  }
  return work.map((row) => row.map((value) => Math.abs(value) < 1e-12 ? 0 : value));
}

export function matrixRank(matrix: NumericMatrix): number {
  return reducedRowEchelon(matrix).filter((row) => row.some((value) => Math.abs(value) > 1e-10)).length;
}

export function inverseMatrix(matrix: NumericMatrix): NumericMatrix {
  assertMatrix(matrix);
  if (matrix.length !== matrix[0].length) throw new Error('Inverse requires a square matrix.');
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...row.map((_, column) => Number(index === column))]);
  const reduced = reducedRowEchelon(augmented);
  for (let row = 0; row < size; row += 1) {
    if (reduced[row].slice(0, size).some((value, column) => Math.abs(value - Number(row === column)) > 1e-8)) throw new Error('This matrix is singular and has no inverse.');
  }
  return reduced.map((row) => row.slice(size));
}

export function solveLinearSystem(coefficients: NumericMatrix, constants: number[]): { solution: number[]; rank: number } {
  assertMatrix(coefficients, 'Coefficient matrix');
  if (coefficients.length !== constants.length || constants.some((value) => !Number.isFinite(value))) throw new Error('The number of constants must match the number of equations.');
  const augmented = coefficients.map((row, index) => [...row, constants[index]]);
  const reduced = reducedRowEchelon(augmented);
  const variableCount = coefficients[0].length;
  for (const row of reduced) {
    const allZero = row.slice(0, variableCount).every((value) => Math.abs(value) < 1e-10);
    if (allZero && Math.abs(row[variableCount]) > 1e-10) throw new Error('The system is inconsistent; no solution exists.');
  }
  const rank = matrixRank(coefficients);
  if (rank < variableCount) throw new Error('The system does not have a unique solution. It has free variables or infinitely many solutions.');
  const solution = Array.from({ length: variableCount }, () => Number.NaN);
  reduced.forEach((row) => {
    const pivot = row.slice(0, variableCount).findIndex((value) => Math.abs(value) > 1e-9);
    if (pivot >= 0) solution[pivot] = row[variableCount];
  });
  return { solution, rank };
}
