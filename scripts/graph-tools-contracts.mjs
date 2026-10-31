import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'math-wiki-graph-'));
try {
  const localCompiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const command = existsSync(localCompiler) ? process.execPath : 'tsc';
  const prefix = existsSync(localCompiler) ? [localCompiler] : [];
  // Pin the compiler root so TypeScript versions and runner layouts emit the
  // two contract modules directly into the temporary output directory.
  // Without an explicit rootDir, some CI compiler layouts can preserve the
  // src/engine path and make the following require() look in the wrong place.
  execFileSync(command, [
    'src/engine/graphEngine.ts',
    'src/engine/geometryEngine.ts',
    '--target', 'ES2020',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--rootDir', 'src/engine',
    '--strict',
    '--skipLibCheck',
    '--outDir', temp,
  ], { cwd: root, stdio: 'pipe' });
  const require = createRequire(import.meta.url);
  const graphModulePath = path.join(temp, 'graphEngine.js');
  const geometryModulePath = path.join(temp, 'geometryEngine.js');
  assert.ok(existsSync(graphModulePath), `TypeScript did not emit graphEngine.js at the expected path: ${graphModulePath}`);
  assert.ok(existsSync(geometryModulePath), `TypeScript did not emit geometryEngine.js at the expected path: ${geometryModulePath}`);
  const graph = require(graphModulePath);
  const geometry = require(geometryModulePath);
  const evaluate = (expression, scope) => {
    const source = expression.replace(/\^/g, '**');
    const functions = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, log: Math.log, pi: Math.PI, e: Math.E };
    const merged = { ...functions, ...scope };
    const names = Object.keys(merged);
    const values = Object.values(merged);
    return Function(...names, `return (${source});`)(...values);
  };
  const cartesian = graph.sampleCartesian('x^2', { min: -2, max: 2 }, evaluate, 101);
  assert.equal(cartesian.points.length, 101);
  assert.ok(Math.abs(cartesian.points[50].y) < 1e-12);
  const polar = graph.samplePolar('2', { min: 0, max: Math.PI * 2 }, evaluate, 100);
  assert.ok(Math.abs(polar.points[0].x - 2) < 1e-12);
  assert.ok(Math.abs(polar.points[0].y) < 1e-12);
  const parametric = graph.sampleParametric('cos(t)', 'sin(t)', { min: 0, max: Math.PI * 2 }, evaluate, 100);
  assert.ok(Math.abs(parametric.points[0].x - 1) < 1e-12);
  assert.ok(Math.abs(parametric.points[0].y) < 1e-12);
  const implicit = graph.sampleImplicit('x^2+y^2-1', { min: -2, max: 2 }, { min: -2, max: 2 }, evaluate, 30);
  assert.ok(implicit.length > 20, 'A circle implicit equation should yield contour segments.');
  const intersections = graph.findFunctionIntersections('x^2', '1', { min: -2, max: 2 }, evaluate);
  assert.equal(intersections.length, 2);
  assert.ok(Math.abs(intersections[0].x + 1) < 1e-5);
  assert.ok(Math.abs(intersections[1].x - 1) < 1e-5);
  assert.ok(Math.abs(graph.estimateAreaBetween('x^2', '1', -1, 1, evaluate) - 4 / 3) < 1e-5);
  assert.ok(Math.abs(graph.estimateAreaBetween('x^2', '1', 1, -1, evaluate) - 4 / 3) < 1e-5, 'Geometric area must remain non-negative if bounds are reversed.');
  const analysis = graph.analyseFunction('x^2', { min: -2, max: 2 }, evaluate, 1);
  assert.ok(analysis.roots.some((root) => Math.abs(root) < 1e-5));
  assert.ok(analysis.extrema.some((item) => item.kind === 'minimum' && Math.abs(item.x) < 0.02));
  assert.ok(Math.abs(analysis.derivativeAt - 2) < 1e-3);
  assert.ok(Math.abs(analysis.integralEstimate - 16 / 3) < 1e-4);
  const surface = graph.sampleSurface('x^2+y^2', { min: -2, max: 2 }, { min: -2, max: 2 }, evaluate, 8);
  assert.equal(surface.rows.length, 9);
  assert.ok(Math.abs(surface.zMin) < 1e-12);
  const projected = graph.projectSurfacePoint({ x: 1, y: 2, z: 3 }, -35, 40, 1, 760, 430);
  assert.ok(Number.isFinite(projected.x) && Number.isFinite(projected.y));
  assert.throws(() => graph.samplePolar('1', { min: 1, max: 1 }, evaluate), /finite, increasing/);
  assert.throws(() => graph.sampleParametric('t', 't', { min: 0, max: 1 }, evaluate, 10), /20 and 5,000/);
  assert.throws(() => graph.sampleImplicit('x+y', { min: Number.NaN, max: 1 }, { min: -1, max: 1 }, evaluate), /finite, increasing/);
  assert.throws(() => graph.sampleSurface('x+y', { min: 0, max: 1 }, { min: 0, max: Number.POSITIVE_INFINITY }, evaluate), /finite, increasing/);
  assert.throws(() => graph.projectSurfacePoint({ x: 0, y: 0, z: 0 }, 0, 120, 1, 500, 400), /outside supported limits/);

  const a = { x: 0, y: 0 }; const b = { x: 4, y: 0 }; const c = { x: 0, y: 3 };
  assert.deepEqual(geometry.midpoint(a, b), { x: 2, y: 0 });
  assert.ok(Math.abs(geometry.distanceBetween(a, b) - 4) < 1e-12);
  assert.equal(geometry.triangleMeasurements(a, b, c).area, 6);
  assert.equal(geometry.rectangleMeasurements(a, { x: 4, y: 3 }).area, 12);
  const bisector = geometry.deriveConstruction('PerpendicularBisector', [a, b]);
  assert.equal(bisector.kind, 'line');
  assert.ok(Math.abs(bisector.start.x - bisector.end.x) < 1e-10);
  const midpoint = geometry.deriveConstruction('Midpoint', [a, b]);
  assert.deepEqual(midpoint, { kind: 'point', point: { x: 2, y: 0 } });
  const parallel = geometry.deriveConstruction('ParallelLine', [a, b, { x: 0, y: 2 }]);
  assert.equal(parallel.kind, 'line');
  assert.ok(Math.abs(parallel.start.y - parallel.end.y) < 1e-10);
  const perpendicular = geometry.deriveConstruction('PerpendicularLine', [a, b, { x: 0, y: 2 }]);
  assert.ok(Math.abs(perpendicular.start.x - perpendicular.end.x) < 1e-10);
  const angle = geometry.deriveConstruction('AngleBisector', [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }]);
  assert.equal(angle.kind, 'line');
  assert.ok(Math.abs(angle.start.x) < 1e-10 && Math.abs(angle.start.y) < 1e-10);
  assert.ok(angle.end.x > 0 && angle.end.y > 0, 'Angle bisectors must be rays directed inside the selected angle.');
  const circumcircle = geometry.deriveConstruction('Circumcircle', [a, b, c]);
  assert.equal(circumcircle.kind, 'circle');
  assert.ok(Math.abs(circumcircle.center.x - 2) < 1e-10);
  assert.ok(Math.abs(circumcircle.center.y - 1.5) < 1e-10);
  assert.throws(() => geometry.deriveConstruction('Circumcircle', [a, b, { x: 2, y: 0 }]), /collinear/);
  assert.deepEqual(geometry.transformGeometryPoints([{ x: 1, y: 2 }], { type: 'translate', dx: 3, dy: -1 }), [{ x: 4, y: 1 }]);
  const rotated = geometry.transformGeometryPoints([{ x: 1, y: 0 }], { type: 'rotate', angleDegrees: 90 })[0];
  assert.ok(Math.abs(rotated.x) < 1e-10 && Math.abs(rotated.y - 1) < 1e-10, 'A 90-degree rotation must be accurate.');
  assert.deepEqual(geometry.transformGeometryPoints([{ x: 2, y: 3 }], { type: 'reflect-x' }), [{ x: 2, y: -3 }]);
  assert.deepEqual(geometry.transformGeometryPoints([{ x: 2, y: 3 }], { type: 'reflect-y' }), [{ x: -2, y: 3 }]);
  assert.deepEqual(geometry.transformGeometryPoints([{ x: 2, y: 3 }], { type: 'scale', factor: 2 }), [{ x: 4, y: 6 }]);
  assert.throws(() => geometry.transformGeometryPoints([{ x: 1, y: 1 }], { type: 'scale', factor: 0 }), /non-zero/);
  assert.throws(() => geometry.transformGeometryPoints([{ x: Number.NaN, y: 1 }], { type: 'translate', dx: 1, dy: 1 }), /invalid coordinates/);

  const graphTool = await readFile(path.join(root, 'src/features/playground/GraphTool.tsx'), 'utf8');
  const geometryTool = await readFile(path.join(root, 'src/features/playground/GeometryTool.tsx'), 'utf8');
  assert.match(graphTool, /type GraphPoint/, 'The graph plot component must import its point type from the graph engine.');
  assert.match(graphTool, /3D surface plotter/);
  assert.match(graphTool, /MathematicalVisualizations/);
  assert.match(graphTool, /Interactive unit circle/);
  assert.match(graphTool, /Sequence explorer/);
  assert.match(graphTool, /Implicit equation plotter/);
  assert.match(graphTool, /Show tangent at inspected x/);
  assert.match(geometryTool, /PerpendicularBisector/);
  assert.match(geometryTool, /Circumcircle/);
  assert.match(geometryTool, /onPointerMove/);
  assert.match(geometryTool, /Reflect across x-axis/);
  assert.match(geometryTool, /Rotate/);
  console.log('Graphing and geometry contracts passed: Cartesian, polar, parametric and implicit sampling; numerical function analysis; 3D surface projection; dynamic constructions, measurements and geometric transformations.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
