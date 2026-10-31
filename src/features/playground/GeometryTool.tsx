import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { Circle, Eraser, MousePointer2, RotateCcw, Shapes, Trash2 } from 'lucide-react';
import { safeStorageGet, safeStorageSet } from '../../engine/safeStorage';

type Point = { x: number; y: number };
type ShapeKind = 'Point' | 'Line' | 'Segment' | 'Circle' | 'Triangle' | 'Rectangle';
type GeometryObject = { id: string; kind: ShapeKind; points: Point[] };
type Tool = ShapeKind;
const STORE_KEY = 'mw:geometry-constructions:v1';
const SIZE = 560;
const CENTER = SIZE / 2;
const SCALE = 25;
const toScreen = (point: Point): Point => ({ x: CENTER + point.x * SCALE, y: CENTER - point.y * SCALE });
const toMath = (point: Point): Point => ({ x: Math.round((point.x - CENTER) / SCALE * 100) / 100, y: Math.round((CENTER - point.y) / SCALE * 100) / 100 });
const loadObjects = (): GeometryObject[] => {
  try { const value: unknown = JSON.parse(safeStorageGet(STORE_KEY, '[]') || '[]'); return Array.isArray(value) ? value as GeometryObject[] : []; }
  catch { return []; }
};
const requiredClicks: Record<Tool, number> = { Point: 1, Line: 2, Segment: 2, Circle: 2, Triangle: 3, Rectangle: 2 };

export default function GeometryTool() {
  const [objects, setObjects] = useState<GeometryObject[]>(loadObjects);
  const [tool, setTool] = useState<Tool>('Point');
  const [pending, setPending] = useState<Point[]>([]);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);

  useEffect(() => { safeStorageSet(STORE_KEY, JSON.stringify(objects)); }, [objects]);
  const instructions = useMemo(() => {
    if (tool === 'Point') return 'Click once to place a point.';
    if (tool === 'Circle') return 'Click the centre, then click a point on the circle.';
    if (tool === 'Triangle') return 'Click three vertices to create a triangle.';
    if (tool === 'Rectangle') return 'Click two opposite corners of a rectangle.';
    return `Click two points to create a ${tool.toLowerCase()}.`;
  }, [tool]);

  const chooseTool = (next: Tool) => { setTool(next); setPending([]); };
  const addGeometry = (point: Point) => {
    setLastPoint(point);
    if (tool === 'Point') {
      setObjects((current) => [...current, { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, kind: 'Point', points: [point] }]);
      return;
    }
    const next = [...pending, point];
    if (next.length >= requiredClicks[tool]) {
      setObjects((current) => [...current, { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, kind: tool, points: next }]);
      setPending([]);
    } else setPending(next);
  };

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * SIZE / rect.width, y: (event.clientY - rect.top) * SIZE / rect.height };
    const converted = toMath(point);
    if (Math.abs(converted.x) > 10 || Math.abs(converted.y) > 10) return;
    addGeometry(converted);
  };

  const shapeName = (shape: GeometryObject) => {
    if (shape.kind === 'Point') return `Point (${shape.points[0].x}, ${shape.points[0].y})`;
    if (shape.kind === 'Circle') return `Circle · centre (${shape.points[0].x}, ${shape.points[0].y})`;
    return `${shape.kind} · ${shape.points.map((point) => `(${point.x}, ${point.y})`).join(' → ')}`;
  };

  return <div className="play-tool-grid geometry-layout">
    <section className="play-panel geometry-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Shapes size={17} /></div><div><h2>Geometry construction</h2><p>Construct points, lines and shapes on a coordinate plane.</p></div></div>
      <div className="geometry-toolbar" role="toolbar" aria-label="Geometry construction tools">
        {([{ kind: 'Point' as const, label: 'Point', mark: '•' }, { kind: 'Line' as const, label: 'Line', mark: '↔' }, { kind: 'Segment' as const, label: 'Segment', mark: '—' }, { kind: 'Circle' as const, label: 'Circle', mark: '○' }, { kind: 'Triangle' as const, label: 'Triangle', mark: '△' }, { kind: 'Rectangle' as const, label: 'Rectangle', mark: '□' }]).map((item) => <button key={item.kind} className={tool === item.kind ? 'selected' : ''} onClick={() => chooseTool(item.kind)} aria-pressed={tool === item.kind}><span>{item.mark}</span>{item.label}</button>)}
      </div>
      <div className="geometry-instructions"><MousePointer2 size={13} /><span>{instructions}</span><span className="geometry-pending">{pending.length ? `${pending.length}/${requiredClicks[tool]} points` : 'Ready'}</span></div>
      <div className="geometry-canvas-wrap">
        <svg className="geometry-canvas" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Interactive coordinate plane. Click the grid to construct geometry." onClick={handleCanvasClick}>
          <rect x="0" y="0" width={SIZE} height={SIZE} fill="var(--surface)" />
          {Array.from({ length: 21 }, (_, index) => {
            const v = index * SCALE + 30;
            return <g key={index}><line x1={v} x2={v} y1="30" y2="530" className={index === 10 ? 'geometry-axis' : 'geometry-grid-line'} /><line x1="30" x2="530" y1={v} y2={v} className={index === 10 ? 'geometry-axis' : 'geometry-grid-line'} /></g>;
          })}
          {Array.from({ length: 21 }, (_, index) => {
            const value = index - 10;
            if (value === 0) return null;
            const px = toScreen({ x: value, y: 0 }).x;
            const py = toScreen({ x: 0, y: value }).y;
            return <g key={`tick-${index}`}><text x={px} y={CENTER + 17} className="geometry-tick" textAnchor="middle">{value}</text><text x={CENTER - 10} y={py + 3} className="geometry-tick" textAnchor="end">{value}</text></g>;
          })}
          <text x="540" y={CENTER - 9} className="geometry-axis-label">x</text><text x={CENTER + 9} y="20" className="geometry-axis-label">y</text>
          {objects.map((shape) => {
            const p = shape.points.map(toScreen);
            if (shape.kind === 'Point') return <g key={shape.id}><circle cx={p[0].x} cy={p[0].y} r="5" className="geometry-point"/><circle cx={p[0].x} cy={p[0].y} r="10" className="geometry-hit-area"/></g>;
            if (shape.kind === 'Circle') return <circle key={shape.id} cx={p[0].x} cy={p[0].y} r={Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)} className="geometry-shape"/>;
            if (shape.kind === 'Triangle') return <polygon key={shape.id} points={p.map((point) => `${point.x},${point.y}`).join(' ')} className="geometry-shape geometry-polygon"/>;
            if (shape.kind === 'Rectangle') return <polygon key={shape.id} points={[p[0], { x: p[1].x, y: p[0].y }, p[1], { x: p[0].x, y: p[1].y }].map((point) => `${point.x},${point.y}`).join(' ')} className="geometry-shape geometry-polygon"/>;
            const a = p[0]; const b = p[1];
            if (shape.kind === 'Line') { const dx = b.x - a.x; const dy = b.y - a.y; return <line key={shape.id} x1={a.x - dx * 30} y1={a.y - dy * 30} x2={a.x + dx * 30} y2={a.y + dy * 30} className="geometry-shape"/>; }
            return <line key={shape.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="geometry-shape"/>;
          })}
          {pending.map((point, index) => { const p = toScreen(point); return <circle key={`pending-${index}`} cx={p.x} cy={p.y} r="5" className="geometry-pending-point"/>; })}
        </svg>
      </div>
      <div className="geometry-bottom"><span>{objects.length} construction{objects.length === 1 ? '' : 's'}</span><span>{lastPoint ? `Last point: (${lastPoint.x}, ${lastPoint.y})` : 'Coordinate plane · −10 to 10'}</span><button onClick={() => setPending([])} disabled={!pending.length}><Eraser size={13} /> Cancel current</button></div>
    </section>
    <section className="play-panel geometry-objects-panel">
      <div className="history-heading"><div className="play-panel-heading"><div className="play-panel-icon"><Circle size={17} /></div><div><h2>Constructions</h2><p>Objects are saved automatically on this device.</p></div></div><button className="tool-icon-button" onClick={() => { setObjects([]); setPending([]); setLastPoint(null); }} disabled={!objects.length} aria-label="Clear all constructions"><Trash2 size={15} /></button></div>
      {objects.length ? <div className="geometry-object-list">{objects.map((shape) => <div className="geometry-object-row" key={shape.id}><span className="geometry-object-mark">{shape.kind === 'Point' ? '•' : shape.kind === 'Circle' ? '○' : shape.kind === 'Triangle' ? '△' : shape.kind === 'Rectangle' ? '□' : '—'}</span><span>{shapeName(shape)}</span><button onClick={() => setObjects((current) => current.filter((item) => item.id !== shape.id))} aria-label={`Delete ${shape.kind}`}><Trash2 size={13} /></button></div>)}</div> : <div className="tool-empty"><Shapes size={20} /><strong>No constructions yet</strong><span>Select a tool and click on the coordinate plane.</span></div>}
      <div className="geometry-help"><strong>How constructions work</strong><p>Points need one click. Lines, segments, and circles need two. Triangles need three vertices. Rectangles use two opposite corners.</p></div>
      <button className="button button-secondary history-restore" onClick={() => { setObjects(loadObjects()); setPending([]); }}><RotateCcw size={14} /> Reload saved constructions</button>
    </section>
  </div>;
}
