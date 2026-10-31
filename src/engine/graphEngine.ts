export type GraphPoint = { x: number; y: number };
export type GraphRange = { min: number; max: number };
export type ExpressionEvaluator = (expression: string, scope: Record<string, number>) => number;
export type SampledCurve = { points: GraphPoint[]; expression: string };
export type ImplicitSegment = { start: GraphPoint; end: GraphPoint };
export type FunctionExtremum = { x: number; y: number; kind: 'maximum' | 'minimum' };
export type FunctionAnalysis = {
  roots: number[];
  extrema: FunctionExtremum[];
  minimum: GraphPoint | null;
  maximum: GraphPoint | null;
  derivativeAt: number | null;
  integralEstimate: number | null;
};

const finite = (value: number): boolean => Number.isFinite(value) && Math.abs(value) < 1e9;
const validateRange = (range: GraphRange, label: string): void => {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min || range.max - range.min > 100000) {
    throw new Error(`${label} must be finite, increasing and no wider than 100,000 units.`);
  }
};
const validateSampleCount = (count: number): void => {
  if (!Number.isInteger(count) || count < 20 || count > 5000) throw new Error('Use between 20 and 5,000 graph samples.');
};

const safeEvaluate = (evaluate: ExpressionEvaluator, expression: string, scope: Record<string, number>): number | null => {
  try {
    const value = evaluate(expression, scope);
    return finite(value) ? value : null;
  } catch {
    return null;
  }
};

export function sampleCartesian(expression: string, range: GraphRange, evaluate: ExpressionEvaluator, count = 501): SampledCurve {
  validateRange(range, 'The graph range');
  validateSampleCount(count);
  const points = Array.from({ length: count }, (_, index) => {
    const x = range.min + ((range.max - range.min) * index) / (count - 1);
    const y = safeEvaluate(evaluate, expression, { x });
    return { x, y: y ?? Number.NaN };
  });
  return { points, expression };
}

export function samplePolar(expression: string, range: GraphRange, evaluate: ExpressionEvaluator, count = 501): SampledCurve {
  validateRange(range, 'The polar parameter range');
  validateSampleCount(count);
  const points = Array.from({ length: count }, (_, index) => {
    const t = range.min + ((range.max - range.min) * index) / (count - 1);
    const radius = safeEvaluate(evaluate, expression, { t });
    return radius === null ? { x: Number.NaN, y: Number.NaN } : { x: radius * Math.cos(t), y: radius * Math.sin(t) };
  });
  return { points, expression };
}

export function sampleParametric(xExpression: string, yExpression: string, range: GraphRange, evaluate: ExpressionEvaluator, count = 501): SampledCurve {
  validateRange(range, 'The parametric range');
  validateSampleCount(count);
  const points = Array.from({ length: count }, (_, index) => {
    const t = range.min + ((range.max - range.min) * index) / (count - 1);
    const x = safeEvaluate(evaluate, xExpression, { t });
    const y = safeEvaluate(evaluate, yExpression, { t });
    return x === null || y === null ? { x: Number.NaN, y: Number.NaN } : { x, y };
  });
  return { points, expression: `x(t)=${xExpression}; y(t)=${yExpression}` };
}

function interpolateZero(a: GraphPoint, b: GraphPoint, fa: number, fb: number): GraphPoint {
  const denominator = fa - fb;
  const ratio = Math.abs(denominator) < 1e-14 ? 0.5 : fa / denominator;
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
}

export function sampleImplicit(expression: string, xRange: GraphRange, yRange: GraphRange, evaluate: ExpressionEvaluator, resolution = 54): ImplicitSegment[] {
  validateRange(xRange, 'The implicit x range');
  validateRange(yRange, 'The implicit y range');
  if (!Number.isInteger(resolution) || resolution < 8 || resolution > 160) throw new Error('Implicit graph resolution must be between 8 and 160.');
  const xs = Array.from({ length: resolution + 1 }, (_, index) => xRange.min + (xRange.max - xRange.min) * index / resolution);
  const ys = Array.from({ length: resolution + 1 }, (_, index) => yRange.min + (yRange.max - yRange.min) * index / resolution);
  const values = ys.map((y) => xs.map((x) => safeEvaluate(evaluate, expression, { x, y })));
  const segments: ImplicitSegment[] = [];
  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      const corners = [
        { point: { x: xs[column], y: ys[row] }, value: values[row][column] },
        { point: { x: xs[column + 1], y: ys[row] }, value: values[row][column + 1] },
        { point: { x: xs[column + 1], y: ys[row + 1] }, value: values[row + 1][column + 1] },
        { point: { x: xs[column], y: ys[row + 1] }, value: values[row + 1][column] },
      ];
      const crossings: GraphPoint[] = [];
      for (let edge = 0; edge < 4; edge += 1) {
        const next = (edge + 1) % 4;
        const a = corners[edge];
        const b = corners[next];
        if (a.value === null || b.value === null) continue;
        if ((a.value <= 0 && b.value >= 0) || (a.value >= 0 && b.value <= 0)) {
          if (a.value === 0 && b.value === 0) continue;
          crossings.push(interpolateZero(a.point, b.point, a.value, b.value));
        }
      }
      for (let index = 0; index + 1 < crossings.length; index += 2) segments.push({ start: crossings[index], end: crossings[index + 1] });
    }
  }
  return segments;
}

function bisectRoot(expression: string, left: number, right: number, fLeft: number, evaluate: ExpressionEvaluator): number | null {
  let a = left;
  let b = right;
  let fa = fLeft;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (a + b) / 2;
    const fm = safeEvaluate(evaluate, expression, { x: middle });
    if (fm === null) return null;
    if (Math.abs(fm) < 1e-10 || Math.abs(b - a) < 1e-9) return middle;
    if ((fa <= 0 && fm >= 0) || (fa >= 0 && fm <= 0)) b = middle;
    else { a = middle; fa = fm; }
  }
  return (a + b) / 2;
}

export function estimateDerivative(expression: string, x: number, evaluate: ExpressionEvaluator): number | null {
  const step = Math.max(1e-5, Math.abs(x) * 1e-5);
  const left = safeEvaluate(evaluate, expression, { x: x - step });
  const right = safeEvaluate(evaluate, expression, { x: x + step });
  if (left === null || right === null) return null;
  const slope = (right - left) / (2 * step);
  return finite(slope) ? slope : null;
}

export function estimateIntegral(expression: string, lower: number, upper: number, evaluate: ExpressionEvaluator, intervals = 1000): number | null {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isInteger(intervals) || intervals < 10) return null;
  if (lower === upper) return 0;
  const direction = upper >= lower ? 1 : -1;
  const a = Math.min(lower, upper);
  const b = Math.max(lower, upper);
  const count = intervals % 2 === 0 ? intervals : intervals + 1;
  const step = (b - a) / count;
  let total = 0;
  for (let index = 0; index <= count; index += 1) {
    const value = safeEvaluate(evaluate, expression, { x: a + index * step });
    if (value === null) return null;
    total += (index === 0 || index === count ? 1 : index % 2 === 0 ? 2 : 4) * value;
  }
  return direction * total * step / 3;
}

export function analyseFunction(expression: string, range: GraphRange, evaluate: ExpressionEvaluator, inspectX: number): FunctionAnalysis {
  const sampled = sampleCartesian(expression, range, evaluate, 1201).points;
  const valid = sampled.filter((point) => finite(point.y));
  const roots: number[] = [];
  for (let index = 1; index < sampled.length; index += 1) {
    const previous = sampled[index - 1];
    const current = sampled[index];
    if (!finite(previous.y) || !finite(current.y)) continue;
    if (Math.abs(previous.y) < 1e-10) roots.push(previous.x);
    if ((previous.y < 0 && current.y > 0) || (previous.y > 0 && current.y < 0)) {
      const root = bisectRoot(expression, previous.x, current.x, previous.y, evaluate);
      if (root !== null) roots.push(root);
    }
  }
  if (valid.length && Math.abs(valid[valid.length - 1].y) < 1e-10) roots.push(valid[valid.length - 1].x);
  const uniqueRoots = roots.filter((root, index) => roots.findIndex((candidate) => Math.abs(candidate - root) < 1e-5) === index).slice(0, 20);
  const extrema: FunctionExtremum[] = [];
  for (let index = 1; index < sampled.length - 1; index += 1) {
    const before = sampled[index - 1]; const current = sampled[index]; const after = sampled[index + 1];
    if (![before.y, current.y, after.y].every(finite)) continue;
    const leftSlope = current.y - before.y;
    const rightSlope = after.y - current.y;
    if (leftSlope > 0 && rightSlope < 0) extrema.push({ x: current.x, y: current.y, kind: 'maximum' });
    if (leftSlope < 0 && rightSlope > 0) extrema.push({ x: current.x, y: current.y, kind: 'minimum' });
  }
  const minimum = valid.reduce<GraphPoint | null>((best, point) => !best || point.y < best.y ? point : best, null);
  const maximum = valid.reduce<GraphPoint | null>((best, point) => !best || point.y > best.y ? point : best, null);
  return {
    roots: uniqueRoots,
    extrema: extrema.filter((item, index) => extrema.findIndex((candidate) => candidate.kind === item.kind && Math.abs(candidate.x - item.x) < Math.max(1e-3, (range.max - range.min) / 250)) === index).slice(0, 12),
    minimum,
    maximum,
    derivativeAt: estimateDerivative(expression, inspectX, evaluate),
    integralEstimate: estimateIntegral(expression, range.min, range.max, evaluate),
  };
}


export type FunctionIntersection = { x: number; y: number };

export function findFunctionIntersections(firstExpression: string, secondExpression: string, range: GraphRange, evaluate: ExpressionEvaluator, samples = 800): FunctionIntersection[] {
  validateRange(range, 'The intersection range');
  if (!Number.isInteger(samples) || samples < 20 || samples > 10000) throw new Error('Use between 20 and 10,000 intersection samples.');
  const difference = (x: number): number | null => {
    const first = safeEvaluate(evaluate, firstExpression, { x });
    const second = safeEvaluate(evaluate, secondExpression, { x });
    return first === null || second === null ? null : first - second;
  };
  const intersections: FunctionIntersection[] = [];
  let previousX = range.min;
  let previousValue = difference(previousX);
  for (let index = 1; index <= samples; index += 1) {
    const currentX = range.min + (range.max - range.min) * index / samples;
    const currentValue = difference(currentX);
    if (previousValue !== null && currentValue !== null) {
      if (Math.abs(previousValue) < 1e-8) {
        const y = safeEvaluate(evaluate, firstExpression, { x: previousX });
        if (y !== null) intersections.push({ x: previousX, y });
      } else if ((previousValue < 0 && currentValue > 0) || (previousValue > 0 && currentValue < 0)) {
        let left = previousX; let right = currentX; let leftValue = previousValue;
        for (let iteration = 0; iteration < 48; iteration += 1) {
          const middle = (left + right) / 2;
          const middleValue = difference(middle);
          if (middleValue === null) break;
          if (Math.abs(middleValue) < 1e-10 || right - left < 1e-9) { left = middle; right = middle; break; }
          if ((leftValue <= 0 && middleValue >= 0) || (leftValue >= 0 && middleValue <= 0)) right = middle;
          else { left = middle; leftValue = middleValue; }
        }
        const x = (left + right) / 2;
        const y1 = safeEvaluate(evaluate, firstExpression, { x });
        const y2 = safeEvaluate(evaluate, secondExpression, { x });
        if (y1 !== null && y2 !== null) intersections.push({ x, y: (y1 + y2) / 2 });
      }
    }
    previousX = currentX; previousValue = currentValue;
  }
  return intersections.filter((point, index) => intersections.findIndex((candidate) => Math.abs(candidate.x - point.x) < 1e-5) === index).slice(0, 30);
}

export function estimateAreaBetween(firstExpression: string, secondExpression: string, lower: number, upper: number, evaluate: ExpressionEvaluator, intervals = 1000): number | null {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isInteger(intervals) || intervals < 10 || intervals > 20000) return null;
  if (lower === upper) return 0;
  const a = Math.min(lower, upper); const b = Math.max(lower, upper);
  const count = intervals % 2 === 0 ? intervals : intervals + 1;
  const step = (b - a) / count;
  let total = 0;
  for (let index = 0; index <= count; index += 1) {
    const x = a + index * step;
    const first = safeEvaluate(evaluate, firstExpression, { x });
    const second = safeEvaluate(evaluate, secondExpression, { x });
    if (first === null || second === null) return null;
    total += (index === 0 || index === count ? 1 : index % 2 === 0 ? 2 : 4) * Math.abs(first - second);
  }
  return total * step / 3;
}

export type Point3 = { x: number; y: number; z: number };
export type ProjectedPoint = { x: number; y: number };
export type SurfaceGrid = { rows: Point3[][]; zMin: number; zMax: number };

export function sampleSurface(expression: string, xRange: GraphRange, yRange: GraphRange, evaluate: ExpressionEvaluator, resolution = 20): SurfaceGrid {
  validateRange(xRange, 'The surface x range');
  validateRange(yRange, 'The surface y range');
  if (!Number.isInteger(resolution) || resolution < 4 || resolution > 60) throw new Error('Surface resolution must be between 4 and 60.');
  const rows: Point3[][] = [];
  const values: number[] = [];
  for (let row = 0; row <= resolution; row += 1) {
    const y = yRange.min + (yRange.max - yRange.min) * row / resolution;
    const points: Point3[] = [];
    for (let column = 0; column <= resolution; column += 1) {
      const x = xRange.min + (xRange.max - xRange.min) * column / resolution;
      const z = safeEvaluate(evaluate, expression, { x, y });
      points.push({ x, y, z: z ?? Number.NaN });
      if (z !== null) values.push(z);
    }
    rows.push(points);
  }
  if (!values.length) throw new Error('The surface could not be evaluated in this range.');
  return { rows, zMin: Math.min(...values), zMax: Math.max(...values) };
}

export function projectSurfacePoint(point: Point3, azimuthDegrees: number, elevationDegrees: number, zoom: number, width: number, height: number): ProjectedPoint {
  if (![point.x, point.y, point.z, azimuthDegrees, elevationDegrees, zoom, width, height].every(Number.isFinite)) throw new Error('Surface projection inputs must be finite.');
  if (zoom <= 0 || zoom > 10 || width <= 0 || height <= 0 || elevationDegrees < -90 || elevationDegrees > 90) throw new Error('Surface projection zoom, dimensions or elevation are outside supported limits.');
  const azimuth = azimuthDegrees * Math.PI / 180;
  const elevation = elevationDegrees * Math.PI / 180;
  const rotatedX = point.x * Math.cos(azimuth) - point.y * Math.sin(azimuth);
  const rotatedY = point.x * Math.sin(azimuth) + point.y * Math.cos(azimuth);
  const projectedY = rotatedY * Math.cos(elevation) - point.z * Math.sin(elevation);
  const scale = Math.min(width, height) * 0.105 * zoom;
  return { x: width / 2 + rotatedX * scale, y: height / 2 - projectedY * scale };
}
