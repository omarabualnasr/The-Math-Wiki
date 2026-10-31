export type GeometryPoint = { x: number; y: number };
export type AdvancedConstructionKind = 'Midpoint' | 'PerpendicularBisector' | 'AngleBisector' | 'ParallelLine' | 'PerpendicularLine' | 'Circumcircle';
export type GeometryConstruction =
  | { kind: 'point'; point: GeometryPoint }
  | { kind: 'line'; start: GeometryPoint; end: GeometryPoint }
  | { kind: 'circle'; center: GeometryPoint; radius: number }
  | { kind: 'segment'; start: GeometryPoint; end: GeometryPoint };

export const distanceBetween = (a: GeometryPoint, b: GeometryPoint): number => Math.hypot(b.x - a.x, b.y - a.y);
export const midpoint = (a: GeometryPoint, b: GeometryPoint): GeometryPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const normalize = (point: GeometryPoint): GeometryPoint => {
  const length = Math.hypot(point.x, point.y);
  if (length < 1e-10) throw new Error('The selected points do not define a direction.');
  return { x: point.x / length, y: point.y / length };
};
const lineAcrossPlane = (origin: GeometryPoint, direction: GeometryPoint, extent = 40) => ({
  kind: 'line' as const,
  start: { x: origin.x - direction.x * extent, y: origin.y - direction.y * extent },
  end: { x: origin.x + direction.x * extent, y: origin.y + direction.y * extent },
});

export function deriveConstruction(kind: AdvancedConstructionKind, points: GeometryPoint[]): GeometryConstruction {
  if (kind === 'Midpoint' || kind === 'PerpendicularBisector') {
    if (points.length !== 2) throw new Error(`${kind} needs two points.`);
    const [a, b] = points;
    if (distanceBetween(a, b) < 1e-8) throw new Error('Choose two different points.');
    const middle = midpoint(a, b);
    if (kind === 'Midpoint') return { kind: 'point', point: middle };
    const direction = normalize({ x: -(b.y - a.y), y: b.x - a.x });
    return lineAcrossPlane(middle, direction);
  }
  if (kind === 'AngleBisector') {
    if (points.length !== 3) throw new Error('An angle bisector needs three points; the second point is the vertex.');
    const [a, vertex, c] = points;
    const first = normalize({ x: a.x - vertex.x, y: a.y - vertex.y });
    const second = normalize({ x: c.x - vertex.x, y: c.y - vertex.y });
    const direction = normalize({ x: first.x + second.x, y: first.y + second.y });
    return { kind: 'line', start: vertex, end: { x: vertex.x + direction.x * 40, y: vertex.y + direction.y * 40 } };
  }
  if (kind === 'ParallelLine' || kind === 'PerpendicularLine') {
    if (points.length !== 3) throw new Error(`${kind} needs three points: two define the direction and the third sets the line position.`);
    const [a, b, through] = points;
    const vector = { x: b.x - a.x, y: b.y - a.y };
    const direction = kind === 'ParallelLine' ? normalize(vector) : normalize({ x: -vector.y, y: vector.x });
    return lineAcrossPlane(through, direction);
  }
  if (kind === 'Circumcircle') {
    if (points.length !== 3) throw new Error('A circumcircle needs three non-collinear points.');
    const [a, b, c] = points;
    const denominator = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(denominator) < 1e-9) throw new Error('These points are collinear; a unique circumcircle does not exist.');
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const center = {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / denominator,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / denominator,
    };
    return { kind: 'circle', center, radius: distanceBetween(center, a) };
  }
  throw new Error('Unsupported geometry construction.');
}

export function triangleMeasurements(a: GeometryPoint, b: GeometryPoint, c: GeometryPoint): { sideLengths: [number, number, number]; perimeter: number; area: number } {
  const ab = distanceBetween(a, b);
  const bc = distanceBetween(b, c);
  const ca = distanceBetween(c, a);
  const signedDoubleArea = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
  return { sideLengths: [ab, bc, ca], perimeter: ab + bc + ca, area: Math.abs(signedDoubleArea) / 2 };
}

export function rectangleMeasurements(a: GeometryPoint, opposite: GeometryPoint): { width: number; height: number; perimeter: number; area: number } {
  const width = Math.abs(opposite.x - a.x);
  const height = Math.abs(opposite.y - a.y);
  return { width, height, perimeter: 2 * (width + height), area: width * height };
}

export type GeometryTransform =
  | { type: 'translate'; dx: number; dy: number }
  | { type: 'rotate'; angleDegrees: number }
  | { type: 'reflect-x' }
  | { type: 'reflect-y' }
  | { type: 'scale'; factor: number };

export function transformGeometryPoints(points: GeometryPoint[], transform: GeometryTransform): GeometryPoint[] {
  if (!points.length) throw new Error('Select a construction containing points first.');
  if (transform.type === 'translate' && (!Number.isFinite(transform.dx) || !Number.isFinite(transform.dy))) throw new Error('Translation values must be finite.');
  if (transform.type === 'rotate' && !Number.isFinite(transform.angleDegrees)) throw new Error('Rotation angle must be finite.');
  if (transform.type === 'scale' && (!Number.isFinite(transform.factor) || transform.factor === 0 || Math.abs(transform.factor) > 100)) throw new Error('Scale factor must be non-zero and no greater than 100 in magnitude.');
  const angle = transform.type === 'rotate' ? transform.angleDegrees * Math.PI / 180 : 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return points.map((point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Construction contains invalid coordinates.');
    if (transform.type === 'translate') return { x: point.x + transform.dx, y: point.y + transform.dy };
    if (transform.type === 'rotate') return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
    if (transform.type === 'reflect-x') return { x: point.x, y: -point.y };
    if (transform.type === 'reflect-y') return { x: -point.x, y: point.y };
    return { x: point.x * transform.factor, y: point.y * transform.factor };
  });
}
