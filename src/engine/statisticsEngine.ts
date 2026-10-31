export type StatisticsSummary = {
  count: number; sum: number; mean: number; median: number; modes: number[];
  minimum: number; maximum: number; range: number;
  populationVariance: number; populationStandardDeviation: number;
  sampleVariance: number | null; sampleStandardDeviation: number | null;
};

export function parseNumberList(source: string): number[] {
  const values = source.trim().split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new Error('Enter one or more finite numbers separated by commas or spaces.');
  return values;
}

export function summarizeStatistics(values: number[]): StatisticsSummary {
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new Error('Statistics require a non-empty list of finite numbers.');
  const sorted = values.slice().sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mean = sum / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const frequencies = new Map<number, number>();
  values.forEach((value) => frequencies.set(value, (frequencies.get(value) || 0) + 1));
  const maxFrequency = Math.max(...frequencies.values());
  const modes = maxFrequency <= 1 ? [] : [...frequencies].filter(([, frequency]) => frequency === maxFrequency).map(([value]) => value).sort((a, b) => a - b);
  const squaredDeviation = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  const populationVariance = squaredDeviation / count;
  const sampleVariance = count > 1 ? squaredDeviation / (count - 1) : null;
  return {
    count, sum, mean, median, modes, minimum: sorted[0], maximum: sorted[count - 1], range: sorted[count - 1] - sorted[0],
    populationVariance, populationStandardDeviation: Math.sqrt(populationVariance),
    sampleVariance, sampleStandardDeviation: sampleVariance === null ? null : Math.sqrt(sampleVariance),
  };
}

export function combinations(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n > 170) throw new Error('Use whole numbers with 0 ≤ r ≤ n ≤ 170.');
  const k = Math.min(r, n - r);
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = result * (n - k + index) / index;
  return result;
}

export function permutations(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n > 170) throw new Error('Use whole numbers with 0 ≤ r ≤ n ≤ 170.');
  let result = 1;
  for (let value = n - r + 1; value <= n; value += 1) result *= value;
  return result;
}

export function binomialProbability(n: number, k: number, probability: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n || n > 10000 || probability < 0 || probability > 1 || !Number.isFinite(probability)) throw new Error('Use 0 ≤ k ≤ n and a probability between 0 and 1.');
  if (probability === 0) return k === 0 ? 1 : 0;
  if (probability === 1) return k === n ? 1 : 0;
  const logCombination = Array.from({ length: k }, (_, index) => Math.log(n - index) - Math.log(index + 1)).reduce((sum, value) => sum + value, 0);
  return Math.exp(logCombination + k * Math.log(probability) + (n - k) * Math.log1p(-probability));
}

export function linearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number; correlation: number; rSquared: number } {
  if (xValues.length !== yValues.length || xValues.length < 2 || xValues.some((value) => !Number.isFinite(value)) || yValues.some((value) => !Number.isFinite(value))) throw new Error('Regression requires at least two paired finite x and y values.');
  const meanX = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const meanY = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  const numerator = xValues.reduce((sum, value, index) => sum + (value - meanX) * (yValues[index] - meanY), 0);
  const denominatorX = xValues.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const denominatorY = yValues.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  if (denominatorX === 0 || denominatorY === 0) throw new Error('Regression requires variation in both x and y values.');
  const slope = numerator / denominatorX;
  const intercept = meanY - slope * meanX;
  const correlation = numerator / Math.sqrt(denominatorX * denominatorY);
  return { slope, intercept, correlation, rSquared: correlation ** 2 };
}
