import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Archive, Circle, Download, Eraser, MousePointer2, RotateCcw, Shapes, Trash2 } from 'lucide-react';
import { safeStorageGetJson, safeStorageSet } from '../../engine/safeStorage';
import { deriveConstruction, distanceBetween, rectangleMeasurements, transformGeometryPoints, triangleMeasurements, type AdvancedConstructionKind, type GeometryPoint } from '../../engine/geometryEngine';
import { loadPersonalWorkspace, saveWorkspaceSession, type JsonValue } from '../../engine/personalWorkspaceStorage';

type Point = GeometryPoint;
type ShapeKind = 'Point' | 'Line' | 'Segment' | 'Circle' | 'Triangle' | 'Rectangle' | 'Polygon' | AdvancedConstructionKind;
type GeometryObject = { id: string; kind: ShapeKind; points: Point[]; sourceIds?: string[] };
type Tool = 'Select' | ShapeKind;
const STORE_KEY = 'math-wiki:geometry-constructions:v1';
const SIZE = 560;
const CENTER = SIZE / 2;
const SCALE = 25;
const toScreen = (point: Point): Point => ({ x: CENTER + point.x * SCALE, y: CENTER - point.y * SCALE });
const toMath = (point: Point): Point => ({ x: Math.round((point.x - CENTER) / SCALE * 100) / 100, y: Math.round((CENTER - point.y) / SCALE * 100) / 100 });
const expectedPoints: Record<ShapeKind, number> = { Point: 1, Line: 2, Segment: 2, Circle: 2, Triangle: 3, Rectangle: 2, Polygon: 4, Midpoint: 2, PerpendicularBisector: 2, AngleBisector: 3, ParallelLine: 3, PerpendicularLine: 3, Circumcircle: 3 };
const advancedKinds = new Set<ShapeKind>(['Midpoint', 'PerpendicularBisector', 'AngleBisector', 'ParallelLine', 'PerpendicularLine', 'Circumcircle']);
const tools: { id: Tool; label: string; mark: string; advanced?: boolean }[] = [
  { id: 'Select', label: 'Select / move', mark: '↖' },
  { id: 'Point', label: 'Point', mark: '•' },
  { id: 'Line', label: 'Line', mark: '↔' },
  { id: 'Segment', label: 'Segment', mark: '—' },
  { id: 'Circle', label: 'Circle', mark: '○' },
  { id: 'Triangle', label: 'Triangle', mark: '△' },
  { id: 'Rectangle', label: 'Rectangle', mark: '□' },
  { id: 'Polygon', label: 'Quadrilateral', mark: '◇' },
  { id: 'Midpoint', label: 'Midpoint', mark: 'M', advanced: true },
  { id: 'PerpendicularBisector', label: 'Perpendicular bisector', mark: '⊥', advanced: true },
  { id: 'AngleBisector', label: 'Angle bisector', mark: '∠', advanced: true },
  { id: 'ParallelLine', label: 'Parallel line', mark: '∥', advanced: true },
  { id: 'PerpendicularLine', label: 'Perpendicular line', mark: '⊥', advanced: true },
  { id: 'Circumcircle', label: 'Circumcircle', mark: '◎', advanced: true },
];

function isGeometryObject(value: unknown): value is GeometryObject {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !Object.prototype.hasOwnProperty.call(expectedPoints, item.kind) || !Array.isArray(item.points)) return false;
  const kind = item.kind as ShapeKind;
  if (item.points.length !== expectedPoints[kind]) return false;
  if (advancedKinds.has(kind)) {
    if (!Array.isArray(item.sourceIds) || item.sourceIds.length !== expectedPoints[kind] || !item.sourceIds.every((id) => typeof id === 'string')) return false;
  }
  return item.points.every((point) => {
    if (!point || typeof point !== 'object') return false;
    const coordinates = point as Record<string, unknown>;
    return typeof coordinates.x === 'number' && Number.isFinite(coordinates.x) && Math.abs(coordinates.x) <= 10
      && typeof coordinates.y === 'number' && Number.isFinite(coordinates.y) && Math.abs(coordinates.y) <= 10;
  });
}
function isUnknownArray(value: unknown): value is unknown[] { return Array.isArray(value); }
const loadObjects = (): GeometryObject[] => {
  const parsed = safeStorageGetJson(STORE_KEY, [] as unknown[], isUnknownArray).filter(isGeometryObject).slice(0, 5000);
  const pointIds = new Set(parsed.filter((item) => item.kind === 'Point').map((item) => item.id));
  return parsed.filter((item) => !advancedKinds.has(item.kind) || (item.sourceIds || []).every((id) => pointIds.has(id)));
};
const requiredClicks: Record<Exclude<Tool, 'Select'>, number> = {
  Point: 1, Line: 2, Segment: 2, Circle: 2, Triangle: 3, Rectangle: 2, Polygon: 4,
  Midpoint: 2, PerpendicularBisector: 2, AngleBisector: 3, ParallelLine: 3, PerpendicularLine: 3, Circumcircle: 3,
};
const makeId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const roundPoint = (point: Point): Point => ({ x: Math.round(point.x * 100) / 100, y: Math.round(point.y * 100) / 100 });
function clipLineToPlane(a: Point, b: Point): Point[] {
  const dx = b.x - a.x; const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-9) throw new Error('The transformed line has no direction.');
  const candidates: { point: Point; t: number }[] = [];
  if (Math.abs(dx) > 1e-10) for (const x of [-10, 10]) { const t = (x - a.x) / dx; const y = a.y + t * dy; if (y >= -10 - 1e-8 && y <= 10 + 1e-8) candidates.push({ point: { x, y }, t }); }
  if (Math.abs(dy) > 1e-10) for (const y of [-10, 10]) { const t = (y - a.y) / dy; const x = a.x + t * dx; if (x >= -10 - 1e-8 && x <= 10 + 1e-8) candidates.push({ point: { x, y }, t }); }
  const unique = candidates.filter((item, index) => candidates.findIndex((candidate) => Math.hypot(candidate.point.x - item.point.x, candidate.point.y - item.point.y) < 1e-7) === index).sort((left, right) => left.t - right.t);
  if (unique.length < 2) throw new Error('The transformed line does not cross the visible coordinate plane.');
  return [roundPoint(unique[0].point), roundPoint(unique[unique.length - 1].point)];
}

export default function GeometryTool({ restoreSessionId }: { restoreSessionId?: string }) {
  const [objects, setObjects] = useState<GeometryObject[]>(loadObjects);
  const [tool, setTool] = useState<Tool>('Select');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [pendingPoints, setPendingPoints] = useState<Point[]>([]);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'reflect-x' | 'reflect-y' | 'scale'>('translate');
  const [transformX, setTransformX] = useState('1');
  const [transformY, setTransformY] = useState('1');
  const [transformAngle, setTransformAngle] = useState('90');
  const [transformScale, setTransformScale] = useState('2');
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [message, setMessage] = useState('Select a point to move it, or choose a construction tool.');
  const svgRef = useRef<SVGSVGElement>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const restoredSessionRef = useRef('');

  useEffect(() => { safeStorageSet(STORE_KEY, JSON.stringify(objects)); }, [objects]);

  useEffect(() => {
    if (!restoreSessionId || restoredSessionRef.current === restoreSessionId) return;
    restoredSessionRef.current = restoreSessionId;
    void loadPersonalWorkspace().then((workspace) => {
      const session = workspace.sessions.find((item) => item.id === restoreSessionId && item.kind === 'geometry');
      if (!session) { setSessionNotice('Saved geometry construction was not found.'); return; }
      const payload = session.payload;
      if (!Array.isArray(payload.objects)) { setSessionNotice('This geometry session has an invalid construction list.'); return; }
      const restored = payload.objects.filter(isGeometryObject).slice(0, 5000);
      const pointIds = new Set(restored.filter((item) => item.kind === 'Point').map((item) => item.id));
      const safeObjects = restored.filter((item) => !advancedKinds.has(item.kind) || (item.sourceIds || []).every((id) => pointIds.has(id)));
      if (safeObjects.length !== restored.length) { setSessionNotice('Some saved dependent constructions were skipped because their source points are missing.'); }
      else setSessionNotice(`Restored “${session.name}”.`);
      setObjects(safeObjects); setPendingIds([]); setPendingPoints([]); setLastPoint(null); setSelectedPointId(null); setSelectedObjectId(null);
    }).catch(() => setSessionNotice('Saved geometry session could not be loaded.'));
  }, [restoreSessionId]);

  const saveSession = async () => {
    const name = window.prompt('Name this geometry construction', `Geometry · ${objects.length} objects`);
    if (!name) return;
    try { await saveWorkspaceSession('geometry', name, { objects: objects as unknown as JsonValue[] } as unknown as { [key: string]: JsonValue }); setSessionNotice('Geometry construction saved to your Personal Workspace.'); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not save this construction.'); }
  };
  const pointObjects = useMemo(() => objects.filter((item) => item.kind === 'Point'), [objects]);
  const pointById = useMemo(() => new Map(pointObjects.map((item) => [item.id, item.points[0]])), [pointObjects]);
  const instructions = useMemo(() => {
    if (tool === 'Select') return 'Select and drag a point to move it. Dependent constructions update automatically.';
    if (tool === 'Point') return 'Click once to place a free point.';
    if (tool === 'Circle') return 'Click the centre, then a point on the circle.';
    if (tool === 'Triangle') return 'Click three vertices to create a triangle.';
    if (tool === 'Rectangle') return 'Click two opposite corners of a rectangle.';
    if (advancedKinds.has(tool)) {
      if (tool === 'Midpoint' || tool === 'PerpendicularBisector') return `Select ${requiredClicks[tool]} existing points in order.`;
      if (tool === 'AngleBisector') return 'Select three points; the second point is the angle vertex.';
      if (tool === 'ParallelLine' || tool === 'PerpendicularLine') return 'Select two points for direction, then a third point on the new line.';
      return 'Select three non-collinear points to define the circumcircle.';
    }
    return `Click two points to create a ${tool.toLowerCase()}.`;
  }, [tool]);

  const chooseTool = (next: Tool) => { setTool(next); setPendingIds([]); setPendingPoints([]); setMessage(next === 'Select' ? 'Select and drag a free point.' : ''); };
  const nearestPoint = (point: Point) => pointObjects.map((item) => ({ item, distance: distanceBetween(item.points[0], point) })).filter((entry) => entry.distance <= 0.52).sort((a, b) => a.distance - b.distance)[0]?.item || null;
  const completeConstruction = (kind: ShapeKind, selectedIds: string[]) => {
    const selected = selectedIds.map((id) => ({ id, point: pointById.get(id)! }));
    const points = selected.map((item) => item.point);
    try { if (advancedKinds.has(kind)) deriveConstruction(kind as AdvancedConstructionKind, points); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The construction is not valid.'); setPendingIds([]); return; }
    setObjects((current) => [...current, { id: makeId(), kind, points, ...(advancedKinds.has(kind) ? { sourceIds: selectedIds } : {}) }]);
    setPendingIds([]);
    setMessage(`${kind} created. Its source points can be moved with Select / move.`);
  };

  const handleCanvasClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (tool === 'Select' || draggingPointId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = roundPoint(toMath({ x: (event.clientX - rect.left) * SIZE / rect.width, y: (event.clientY - rect.top) * SIZE / rect.height }));
    if (Math.abs(point.x) > 10 || Math.abs(point.y) > 10) return;
    setLastPoint(point);
    if (tool === 'Point') {
      setObjects((current) => [...current, { id: makeId(), kind: 'Point', points: [point] }]);
      setMessage(`Point created at (${point.x}, ${point.y}).`);
      return;
    }
    if (advancedKinds.has(tool)) {
      const found = nearestPoint(point);
      if (!found) { setMessage('Click close to an existing free point. Create points first with the Point tool.'); return; }
      if (pendingIds.includes(found.id)) { setMessage('Choose a different point for each construction input.'); return; }
      const next = [...pendingIds, found.id];
      if (next.length >= requiredClicks[tool]) completeConstruction(tool, next);
      else { setPendingIds(next); setMessage(`${next.length} of ${requiredClicks[tool]} source points selected.`); }
      return;
    }
    const next = [...pendingPoints, point];
    if (next.length >= requiredClicks[tool]) {
      setObjects((current) => [...current, { id: makeId(), kind: tool, points: next }]);
      setPendingPoints([]);
      setMessage(`${tool} created.`);
    } else { setPendingPoints(next); setMessage(`${next.length} of ${requiredClicks[tool]} points placed.`); }
  };

  const screenToMath = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return roundPoint(toMath({ x: (event.clientX - rect.left) * SIZE / rect.width, y: (event.clientY - rect.top) * SIZE / rect.height }));
  };
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (tool !== 'Select') return;
    const found = nearestPoint(screenToMath(event));
    if (!found) { setSelectedPointId(null); return; }
    setSelectedPointId(found.id);
    setSelectedObjectId(found.id);
    setDraggingPointId(found.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingPointId) return;
    const point = screenToMath(event);
    if (Math.abs(point.x) > 10 || Math.abs(point.y) > 10) return;
    setObjects((current) => current.map((item) => item.id === draggingPointId && item.kind === 'Point' ? { ...item, points: [point] } : item));
    setLastPoint(point);
  };
  const handlePointerUp = () => setDraggingPointId(null);

  const resolvedPoints = (shape: GeometryObject): Point[] => shape.sourceIds?.length ? shape.sourceIds.map((id) => pointById.get(id)).filter((point): point is Point => Boolean(point)) : shape.points;
  const shapeName = (shape: GeometryObject) => {
    const points = resolvedPoints(shape);
    if (shape.kind === 'Point') return `Point (${points[0].x}, ${points[0].y})`;
    if (shape.kind === 'Circle') return `Circle · centre (${points[0].x}, ${points[0].y}) · r ${distanceBetween(points[0], points[1]).toFixed(2)}`;
    if (shape.kind === 'Triangle') { const metrics = triangleMeasurements(points[0], points[1], points[2]); return `Triangle · area ${metrics.area.toFixed(2)} · perimeter ${metrics.perimeter.toFixed(2)}`; }
    if (shape.kind === 'Rectangle') { const metrics = rectangleMeasurements(points[0], points[1]); return `Rectangle · area ${metrics.area.toFixed(2)} · perimeter ${metrics.perimeter.toFixed(2)}`; }
    if (shape.kind === 'Polygon') return `Quadrilateral · ${points.length} vertices`;
    if (shape.kind === 'Segment') return `Segment · length ${distanceBetween(points[0], points[1]).toFixed(2)}`;
    if (shape.kind === 'Midpoint') return `Midpoint · from ${points.length} source points`;
    return `${shape.kind.replace(/([A-Z])/g, ' $1').trim()} · ${points.length} source points`;
  };

  const downloadPng = async () => {
    if (!svgRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const image = await toPng(svgRef.current, { pixelRatio: 2, backgroundColor: getComputedStyle(svgRef.current).backgroundColor });
      const link = document.createElement('a'); link.href = image; link.download = 'geometry-construction.png'; link.click();
    } catch { setMessage('PNG export is unavailable in this browser.'); }
  };

  const applyTransformation = () => {
    const selected = objects.find((item) => item.id === selectedObjectId);
    if (!selected) { setMessage('Select a construction in the list before transforming it.'); return; }
    try {
      const sourcePoints = resolvedPoints(selected);
      let transform: Parameters<typeof transformGeometryPoints>[1];
      if (transformMode === 'translate') transform = { type: 'translate', dx: Number(transformX), dy: Number(transformY) };
      else if (transformMode === 'rotate') transform = { type: 'rotate', angleDegrees: Number(transformAngle) };
      else if (transformMode === 'reflect-x' || transformMode === 'reflect-y') transform = { type: transformMode };
      else transform = { type: 'scale', factor: Number(transformScale) };
      const transformed = transformGeometryPoints(sourcePoints, transform);
      let newObject: GeometryObject;
      if (selected.kind === 'Midpoint') { const construction = deriveConstruction('Midpoint', sourcePoints); if (construction.kind !== 'point') throw new Error('Midpoint could not be resolved.'); newObject = { id: makeId(), kind: 'Point', points: transformGeometryPoints([construction.point], transform) }; }
      else if (selected.kind === 'PerpendicularBisector' || selected.kind === 'AngleBisector' || selected.kind === 'ParallelLine' || selected.kind === 'PerpendicularLine') {
        const construction = deriveConstruction(selected.kind, sourcePoints);
        if (construction.kind !== 'line') throw new Error('This construction cannot be transformed as a line.');
        const linePoints = transformGeometryPoints([construction.start, construction.end], transform);
        const clipped = clipLineToPlane(linePoints[0], linePoints[1]);
        newObject = selected.kind === 'AngleBisector' ? { id: makeId(), kind: 'Segment', points: clipped } : { id: makeId(), kind: 'Line', points: clipped };
      } else if (selected.kind === 'Circumcircle') {
        const construction = deriveConstruction('Circumcircle', sourcePoints);
        if (construction.kind !== 'circle') throw new Error('This construction cannot be transformed as a circle.');
        const circlePoints = transformGeometryPoints([construction.center, { x: construction.center.x + construction.radius, y: construction.center.y }], transform);
        newObject = { id: makeId(), kind: 'Circle', points: circlePoints };
      } else if (selected.kind === 'Line') newObject = { id: makeId(), kind: 'Line', points: clipLineToPlane(transformed[0], transformed[1]) };
      else if (selected.kind === 'Rectangle') { const corners = [sourcePoints[0], { x: sourcePoints[1].x, y: sourcePoints[0].y }, sourcePoints[1], { x: sourcePoints[0].x, y: sourcePoints[1].y }]; newObject = { id: makeId(), kind: 'Polygon', points: transformGeometryPoints(corners, transform) }; }
      else newObject = { id: makeId(), kind: selected.kind, points: transformed };
      if (newObject.points.some((point) => Math.abs(point.x) > 10 || Math.abs(point.y) > 10)) throw new Error('The transformed object would move outside the visible coordinate plane (−10 to 10).');
      setObjects((current) => [...current, newObject]);
      setSelectedObjectId(newObject.id);
      setMessage(`${selected.kind} transformed. A new independent copy was created; the original is unchanged.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'The transformation could not be applied.'); }
  };

  return <div className="play-tool-grid geometry-layout">
    <section className="play-panel geometry-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Shapes size={17}/></div><div><h2>Dynamic geometry studio</h2><p>Construct shapes, build geometric relationships and move source points.</p></div></div>
      <div className="geometry-toolbar" role="toolbar" aria-label="Geometry construction tools">
        {tools.map((item) => <button key={item.id} className={tool === item.id ? 'selected' : ''} onClick={() => chooseTool(item.id)} aria-pressed={tool === item.id} title={item.label}><span>{item.mark}</span>{item.label}</button>)}
      </div>
      <div className="geometry-instructions"><MousePointer2 size={13}/><span>{instructions}</span><span className="geometry-pending">{pendingIds.length ? `${pendingIds.length}/${tool === 'Select' ? 0 : requiredClicks[tool]} selected` : pendingPoints.length ? `${pendingPoints.length}/${tool === 'Select' ? 0 : requiredClicks[tool]} points` : 'Ready'}</span></div>
      {message && <div className="geometry-status" role="status">{message}</div>}
      <div className="geometry-canvas-wrap">
        <svg ref={svgRef} className="geometry-canvas" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Dynamic coordinate plane. Add points, select source points for constructions, and drag points in Select mode." onClick={handleCanvasClick} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
          <rect x="0" y="0" width={SIZE} height={SIZE} fill="var(--surface)"/>
          {Array.from({ length: 21 }, (_, index) => { const value = index * SCALE + 30; return <g key={index}><line x1={value} x2={value} y1="30" y2="530" className={index === 10 ? 'geometry-axis' : 'geometry-grid-line'}/><line x1="30" x2="530" y1={value} y2={value} className={index === 10 ? 'geometry-axis' : 'geometry-grid-line'}/></g>; })}
          {Array.from({ length: 21 }, (_, index) => { const value = index - 10; if (value === 0) return null; const px = toScreen({ x: value, y: 0 }).x; const py = toScreen({ x: 0, y: value }).y; return <g key={`tick-${index}`}><text x={px} y={CENTER + 17} className="geometry-tick" textAnchor="middle">{value}</text><text x={CENTER - 10} y={py + 3} className="geometry-tick" textAnchor="end">{value}</text></g>; })}
          <text x="540" y={CENTER - 9} className="geometry-axis-label">x</text><text x={CENTER + 9} y="20" className="geometry-axis-label">y</text>
          {objects.map((shape) => {
            const points = resolvedPoints(shape);
            if (!points.length) return null;
            if (shape.kind === 'Point') { const p = toScreen(points[0]); return <g key={shape.id}><circle cx={p.x} cy={p.y} r={selectedPointId === shape.id ? 7 : 5} className={selectedPointId === shape.id ? 'geometry-point geometry-point-selected' : 'geometry-point'}/><circle cx={p.x} cy={p.y} r="12" className="geometry-hit-area"/></g>; }
            if (shape.kind === 'Midpoint') { const value = deriveConstruction('Midpoint', points); if (value.kind !== 'point') return null; const p = toScreen(value.point); return <g key={shape.id}><circle cx={p.x} cy={p.y} r="4.5" className="geometry-constructed-point"/><text x={p.x + 8} y={p.y - 8} className="geometry-construction-label">M</text></g>; }
            if (shape.kind === 'PerpendicularBisector' || shape.kind === 'AngleBisector' || shape.kind === 'ParallelLine' || shape.kind === 'PerpendicularLine') { try { const derived = deriveConstruction(shape.kind, points); if (derived.kind !== 'line') return null; const a = toScreen(derived.start); const b = toScreen(derived.end); return <line key={shape.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="geometry-construction-line"/>; } catch { return null; } }
            if (shape.kind === 'Circumcircle') { try { const derived = deriveConstruction('Circumcircle', points); if (derived.kind !== 'circle') return null; const center = toScreen(derived.center); return <circle key={shape.id} cx={center.x} cy={center.y} r={derived.radius * SCALE} className="geometry-construction-circle"/>; } catch { return null; } }
            const p = points.map(toScreen);
            if (shape.kind === 'Circle') return <circle key={shape.id} cx={p[0].x} cy={p[0].y} r={Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)} className="geometry-shape"/>;
            if (shape.kind === 'Triangle') return <polygon key={shape.id} points={p.map((point) => `${point.x},${point.y}`).join(' ')} className="geometry-shape geometry-polygon"/>;
            if (shape.kind === 'Rectangle') return <polygon key={shape.id} points={[p[0], { x: p[1].x, y: p[0].y }, p[1], { x: p[0].x, y: p[1].y }].map((point) => `${point.x},${point.y}`).join(' ')} className="geometry-shape geometry-polygon"/>;
            if (shape.kind === 'Polygon') return <polygon key={shape.id} points={p.map((point) => `${point.x},${point.y}`).join(' ')} className="geometry-shape geometry-polygon"/>;
            const a = p[0]; const b = p[1];
            if (shape.kind === 'Line') { const dx = b.x - a.x; const dy = b.y - a.y; return <line key={shape.id} x1={a.x - dx * 30} y1={a.y - dy * 30} x2={a.x + dx * 30} y2={a.y + dy * 30} className="geometry-shape"/>; }
            return <line key={shape.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="geometry-shape"/>;
          })}
          {pendingPoints.map((point, index) => { const p = toScreen(point); return <circle key={`pending-point-${index}`} cx={p.x} cy={p.y} r="5" className="geometry-pending-point"/>; })}
          {pendingIds.map((id) => { const point = pointById.get(id); if (!point) return null; const p = toScreen(point); return <circle key={id} cx={p.x} cy={p.y} r="10" className="geometry-selection-ring"/>; })}
        </svg>
      </div>
      <div className="geometry-bottom"><span>{objects.length} object{objects.length === 1 ? '' : 's'}</span><span>{lastPoint ? `Last point: (${lastPoint.x}, ${lastPoint.y})` : 'Coordinate plane · −10 to 10'}</span><button onClick={() => { setPendingIds([]); setPendingPoints([]); setMessage('Current construction selection cancelled.'); }} disabled={!pendingIds.length && !pendingPoints.length}><Eraser size={13}/> Cancel selection</button><button onClick={downloadPng}><Download size={13}/> Export PNG</button><button onClick={() => void saveSession()}><Archive size={13}/> Save session</button></div>
      {sessionNotice && <div className="workspace-inline-notice" role="status">{sessionNotice}</div>}
    </section>
    <section className="play-panel geometry-objects-panel">
      <div className="history-heading"><div className="play-panel-heading"><div className="play-panel-icon"><Circle size={17}/></div><div><h2>Constructions</h2><p>Points and dependent objects save automatically.</p></div></div><button className="tool-icon-button" onClick={() => { if (window.confirm('Delete every construction on this device?')) { setObjects([]); setPendingIds([]); setPendingPoints([]); setLastPoint(null); setSelectedPointId(null); } }} disabled={!objects.length} aria-label="Clear all constructions"><Trash2 size={15}/></button></div>
      {objects.length ? <div className="geometry-object-list">{objects.map((shape) => <div className={`geometry-object-row ${selectedObjectId === shape.id ? 'selected' : ''}`} key={shape.id} onClick={() => setSelectedObjectId(shape.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedObjectId(shape.id); } }}><span className="geometry-object-mark">{tools.find((item) => item.id === shape.kind)?.mark || '◇'}</span><span>{shapeName(shape)}</span>{shape.kind === 'Point' && <button onClick={(event) => { event.stopPropagation(); setTool('Select'); setSelectedPointId(shape.id); setSelectedObjectId(shape.id); }} aria-label={`Select point ${shape.id}`}><MousePointer2 size={12}/></button>}<button onClick={(event) => { event.stopPropagation(); setObjects((current) => current.filter((item) => item.id !== shape.id && !(item.sourceIds || []).includes(shape.id))); if (selectedObjectId === shape.id) setSelectedObjectId(null); }} aria-label={`Delete ${shape.kind}`}><Trash2 size={13}/></button></div>)}</div> : <div className="tool-empty"><Shapes size={20}/><strong>No constructions yet</strong><span>Choose Point and click the coordinate plane to begin.</span></div>}
      <div className="geometry-help"><strong>Dynamic construction workflow</strong><p>1. Add free points. 2. Select a construction tool. 3. Click near the existing points in the required order. 4. Choose Select / move and drag a source point; dependent constructions recalculate automatically.</p></div>
      <div className="geometry-transform-panel">
        <div><strong>Transform selected construction</strong><span>Creates a new independent copy; the original remains unchanged.</span></div>
        <label>Transformation<select value={transformMode} onChange={(event) => setTransformMode(event.target.value as typeof transformMode)}><option value="translate">Translate</option><option value="rotate">Rotate around origin</option><option value="reflect-x">Reflect across x-axis</option><option value="reflect-y">Reflect across y-axis</option><option value="scale">Scale from origin</option></select></label>
        {transformMode === 'translate' && <div className="geometry-transform-fields"><label>Δx<input type="number" value={transformX} onChange={(event) => setTransformX(event.target.value)}/></label><label>Δy<input type="number" value={transformY} onChange={(event) => setTransformY(event.target.value)}/></label></div>}
        {transformMode === 'rotate' && <label>Angle in degrees<input type="number" value={transformAngle} onChange={(event) => setTransformAngle(event.target.value)}/></label>}
        {transformMode === 'scale' && <label>Scale factor<input type="number" value={transformScale} onChange={(event) => setTransformScale(event.target.value)}/></label>}
        <button className="button button-secondary" disabled={!selectedObjectId} onClick={applyTransformation}>Apply transformation</button>
      </div>
      <button className="button button-secondary history-restore" onClick={() => { setObjects(loadObjects()); setPendingIds([]); setPendingPoints([]); setLastPoint(null); setMessage('Saved constructions restored.'); }}><RotateCcw size={14}/> Reload saved constructions</button>
    </section>
  </div>;
}
