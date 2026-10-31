import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Activity, Archive, Download, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { evaluateMathExpression, expressionToLatex, formatNumber } from '../../engine/mathEngine';
import MathExpression from '../articles/MathExpression';
import { analyseFunction, estimateAreaBetween, estimateDerivative, estimateIntegral, findFunctionIntersections, projectSurfacePoint, sampleCartesian, sampleImplicit, sampleParametric, samplePolar, sampleSurface, type GraphPoint, type GraphRange } from '../../engine/graphEngine';
import MathKeyboard from './MathKeyboard';
import { loadPersonalWorkspace, saveWorkspaceSession } from '../../engine/personalWorkspaceStorage';

type FunctionItem = { id: string; expression: string };
type GraphMode = 'cartesian' | 'polar' | 'parametric' | 'implicit' | 'surface' | 'visualizations';
const WIDTH = 760;
const HEIGHT = 430;
const PAD = { left: 64, right: 25, top: 28, bottom: 48 };
const lineClasses = ['graph-work-line graph-work-line-0', 'graph-work-line graph-work-line-1', 'graph-work-line graph-work-line-2', 'graph-work-line graph-work-line-3'];
const evaluate = (expression: string, scope: Record<string, number>) => evaluateMathExpression(expression, scope);
const graphModes: { id: GraphMode; label: string; description: string; soon?: boolean }[] = [
  { id: 'cartesian', label: 'Cartesian', description: 'Plot one or more functions of x and analyze their behavior.' },
  { id: 'polar', label: 'Polar', description: 'Plot radius functions r(θ) on a polar coordinate plane.', soon: true },
  { id: 'parametric', label: 'Parametric', description: 'Plot a curve using separate x(t) and y(t) expressions.', soon: true },
  { id: 'implicit', label: 'Implicit', description: 'Plot the zero contour of an equation F(x, y) = 0.', soon: true },
  { id: 'surface', label: '3D Surface', description: 'Explore a surface z = f(x, y) with adjustable viewing angles.', soon: true },
  { id: 'visualizations', label: 'Visualizations', description: 'Explore mathematical ideas through interactive visual demonstrations.', soon: true },
];

function buildPath(points: GraphPoint[], sx: (value: number) => number, sy: (value: number) => number): string {
  let drawing = false;
  const commands: string[] = [];
  points.forEach((point) => {
    const valid = Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 1e8 && Math.abs(point.y) < 1e8;
    if (!valid) { drawing = false; return; }
    commands.push(`${drawing ? 'L' : 'M'} ${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`);
    drawing = true;
  });
  return commands.join(' ');
}

function GraphPlot({ mode, functions, expression, secondExpression, xRange, yRange, inspectValue, onInspect, showTangent, showIntegral }: {
  mode: Exclude<GraphMode, 'surface' | 'visualizations'>;
  functions: FunctionItem[];
  expression: string;
  secondExpression: string;
  xRange: GraphRange;
  yRange: GraphRange;
  inspectValue: number;
  onInspect: (value: number) => void;
  showTangent: boolean;
  showIntegral: boolean;
}) {
  const plot = useMemo(() => {
    try {
      const series = mode === 'cartesian'
        ? functions.map((item) => sampleCartesian(item.expression, xRange, evaluate, 601))
        : mode === 'polar'
          ? [samplePolar(expression, xRange, evaluate, 601)]
          : mode === 'parametric'
            ? [sampleParametric(expression, secondExpression, xRange, evaluate, 601)]
            : [];
      const implicit = mode === 'implicit' ? sampleImplicit(expression, xRange, yRange, evaluate, 64) : [];
      const validPoints = [...series.flatMap((item) => item.points), ...implicit.flatMap((segment) => [segment.start, segment.end])]
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 1e7 && Math.abs(point.y) < 1e7);
      if (!validPoints.length) return null;
      const sortedX = validPoints.map((point) => point.x).sort((a, b) => a - b);
      const sortedY = validPoints.map((point) => point.y).sort((a, b) => a - b);
      const percentile = (values: number[], fraction: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
      const rawXMin = mode === 'cartesian' || mode === 'implicit' ? xRange.min : percentile(sortedX, 0.01);
      const rawXMax = mode === 'cartesian' || mode === 'implicit' ? xRange.max : percentile(sortedX, 0.99);
      const rawYMin = mode === 'implicit' ? yRange.min : percentile(sortedY, 0.01);
      const rawYMax = mode === 'implicit' ? yRange.max : percentile(sortedY, 0.99);
      const xSpan = Math.max(1e-6, rawXMax - rawXMin);
      const ySpan = Math.max(1e-6, rawYMax - rawYMin);
      const xMin = rawXMin - (mode === 'cartesian' || mode === 'implicit' ? 0 : xSpan * 0.06);
      const xMax = rawXMax + (mode === 'cartesian' || mode === 'implicit' ? 0 : xSpan * 0.06);
      const yMin = rawYMin - ySpan * 0.08;
      const yMax = rawYMax + ySpan * 0.08;
      const sx = (x: number) => PAD.left + (x - xMin) / (xMax - xMin) * (WIDTH - PAD.left - PAD.right);
      const sy = (y: number) => HEIGHT - PAD.bottom - (y - yMin) / (yMax - yMin) * (HEIGHT - PAD.top - PAD.bottom);
      const paths = series.map((item) => buildPath(item.points, sx, sy));
      const implicitPaths = implicit.map((segment) => `M ${sx(segment.start.x).toFixed(2)} ${sy(segment.start.y).toFixed(2)} L ${sx(segment.end.x).toFixed(2)} ${sy(segment.end.y).toFixed(2)}`);
      return { xMin, xMax, yMin, yMax, sx, sy, paths, implicitPaths, series };
    } catch {
      return null;
    }
  }, [mode, functions, expression, secondExpression, xRange, yRange]);

  if (!plot) return <div className="tool-empty graph-tool-empty"><Activity size={21} /><strong>No plottable graph</strong><span>Check the expression and coordinate ranges.</span></div>;
  const yZero = Math.min(HEIGHT - PAD.bottom, Math.max(PAD.top, plot.sy(0)));
  const xZero = Math.min(WIDTH - PAD.right, Math.max(PAD.left, plot.sx(0)));
  const intersections = mode === 'cartesian' && functions.length > 1 ? (() => { try { return findFunctionIntersections(functions[0].expression, functions[1].expression, xRange, evaluate); } catch { return []; } })() : [];
  const tangent = mode === 'cartesian' && showTangent && functions[0] ? (() => {
    try {
      const slope = estimateDerivative(functions[0].expression, inspectValue, evaluate);
      if (slope === null) return null;
      const y = evaluate(functions[0].expression, { x: inspectValue });
      return buildPath([{ x: xRange.min, y: y + slope * (xRange.min - inspectValue) }, { x: xRange.max, y: y + slope * (xRange.max - inspectValue) }], plot.sx, plot.sy);
    } catch { return null; }
  })() : null;
  const integralArea = mode === 'cartesian' && showIntegral && functions[0] ? (() => {
    const sampled = sampleCartesian(functions[0].expression, xRange, evaluate, 180).points.filter((point) => Number.isFinite(point.y));
    if (sampled.length < 2) return '';
    return `${sampled.map((point, index) => `${index ? 'L' : 'M'} ${plot.sx(point.x).toFixed(2)} ${plot.sy(point.y).toFixed(2)}`).join(' ')} L ${plot.sx(sampled[sampled.length - 1].x).toFixed(2)} ${plot.sy(0).toFixed(2)} L ${plot.sx(sampled[0].x).toFixed(2)} ${plot.sy(0).toFixed(2)} Z`;
  })() : '';
  const inspectAt = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) * WIDTH / rect.width;
    const dataX = plot.xMin + (px - PAD.left) / (WIDTH - PAD.left - PAD.right) * (plot.xMax - plot.xMin);
    if (mode === 'cartesian' || mode === 'implicit') onInspect(Math.max(xRange.min, Math.min(xRange.max, dataX)));
    else onInspect(xRange.min + Math.max(0, Math.min(1, (px - PAD.left) / (WIDTH - PAD.left - PAD.right))) * (xRange.max - xRange.min));
  };
  const xAxisLabel = mode === 'polar' || mode === 'parametric' ? 'x / t' : 'x';
  return <svg className="graph-work-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Interactive mathematical graph. Click to inspect coordinates." onClick={inspectAt}>
    {Array.from({ length: 9 }, (_, index) => { const y = PAD.top + index * (HEIGHT - PAD.top - PAD.bottom) / 8; return <line key={`h${index}`} x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="graph-tool-grid" />; })}
    {Array.from({ length: 11 }, (_, index) => { const x = PAD.left + index * (WIDTH - PAD.left - PAD.right) / 10; return <line key={`v${index}`} x1={x} x2={x} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="graph-tool-grid" />; })}
    {yZero > PAD.top && yZero < HEIGHT - PAD.bottom && <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yZero} y2={yZero} className="graph-tool-axis" />}
    {xZero > PAD.left && xZero < WIDTH - PAD.right && <line x1={xZero} x2={xZero} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="graph-tool-axis" />}
    {integralArea && <path d={integralArea} className="graph-integral-area" />}
    {plot.paths.map((path, index) => <path key={`curve-${index}`} d={path} className={lineClasses[index % lineClasses.length]} />)}
    {plot.implicitPaths.map((path, index) => <path key={`implicit-${index}`} d={path} className="graph-work-line graph-work-line-0" />)}
    {tangent && <path d={tangent} className="graph-tangent-line" />}
    {mode === 'cartesian' && functions[0] && (() => { try { const value = evaluate(functions[0].expression, { x: inspectValue }); return Number.isFinite(value) ? <circle cx={plot.sx(inspectValue)} cy={plot.sy(value)} r="4.5" className="graph-inspect-point"/> : null; } catch { return null; } })()}
    {intersections.map((point, index) => <circle key={`intersection-${index}`} cx={plot.sx(point.x)} cy={plot.sy(point.y)} r="5" className="graph-intersection-point" />)}
    {Array.from({ length: 6 }, (_, index) => { const value = plot.xMin + (plot.xMax - plot.xMin) * index / 5; return <text key={`xlabel-${index}`} x={plot.sx(value)} y={HEIGHT - 20} className="graph-tool-tick" textAnchor="middle">{formatNumber(value, 3)}</text>; })}
    {Array.from({ length: 5 }, (_, index) => { const value = plot.yMin + (plot.yMax - plot.yMin) * index / 4; return <text key={`ylabel-${index}`} x={PAD.left - 10} y={plot.sy(value) + 3} className="graph-tool-tick" textAnchor="end">{formatNumber(value, 3)}</text>; })}
    <text x={WIDTH - 13} y={HEIGHT - 20} className="graph-tool-label">{xAxisLabel}</text><text x="18" y="18" className="graph-tool-label">y</text>
  </svg>;
}

function SurfaceWorkspace({ restoreSessionId }: { restoreSessionId?: string }) {
  const [expression, setExpression] = useState('x^2 + y^2');
  const [xMin, setXMin] = useState(-3);
  const [xMax, setXMax] = useState(3);
  const [yMin, setYMin] = useState(-3);
  const [yMax, setYMax] = useState(3);
  const [azimuth, setAzimuth] = useState(-38);
  const [elevation, setElevation] = useState(34);
  const [zoom, setZoom] = useState(1);
  const [resolution, setResolution] = useState(20);
  const [error, setError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const restoredSessionRef = useRef('');
  useEffect(() => {
    if (!restoreSessionId || restoredSessionRef.current === restoreSessionId) return;
    restoredSessionRef.current = restoreSessionId;
    void loadPersonalWorkspace().then((workspace) => {
      const session = workspace.sessions.find((item) => item.id === restoreSessionId && item.kind === 'graph' && item.payload.mode === 'surface');
      if (!session) return;
      const payload = session.payload;
      if (typeof payload.expression === 'string') setExpression(payload.expression);
      const number = (key: string, setter: (value: number) => void, minimum: number, maximum: number) => { const value = payload[key]; if (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum) setter(value); };
      number('xMin', setXMin, -1e4, 1e4); number('xMax', setXMax, -1e4, 1e4); number('yMin', setYMin, -1e4, 1e4); number('yMax', setYMax, -1e4, 1e4);
      number('azimuth', setAzimuth, -180, 180); number('elevation', setElevation, 8, 82); number('zoom', setZoom, 0.5, 3); number('resolution', setResolution, 8, 36);
      setSessionNotice(`Restored “${session.name}”.`);
    }).catch(() => setSessionNotice('Saved 3D graph could not be loaded.'));
  }, [restoreSessionId]);
  const saveSurfaceSession = async () => {
    const name = window.prompt('Name this 3D surface', `z = ${expression}`.slice(0, 50));
    if (!name) return;
    try { await saveWorkspaceSession('graph', name, { mode: 'surface', expression, xMin, xMax, yMin, yMax, azimuth, elevation, zoom, resolution }); setSessionNotice('3D surface saved to your Personal Workspace.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this surface.'); }
  };
  const surfaceRef = useRef<HTMLDivElement>(null);
  const surface = useMemo(() => {
    try { return sampleSurface(expression, { min: xMin, max: xMax }, { min: yMin, max: yMax }, evaluate, resolution); }
    catch { return null; }
  }, [expression, xMin, xMax, yMin, yMax, resolution]);
  const project = (point: { x: number; y: number; z: number }) => {
    if (!surface) return { x: 0, y: 0 };
    const span = Math.max(1e-9, surface.zMax - surface.zMin);
    const normalizedZ = ((point.z - surface.zMin) / span - 0.5) * 5;
    const xNorm = ((point.x - xMin) / (xMax - xMin) - 0.5) * 6;
    const yNorm = ((point.y - yMin) / (yMax - yMin) - 0.5) * 6;
    return projectSurfacePoint({ x: xNorm, y: yNorm, z: normalizedZ }, azimuth, elevation, zoom, WIDTH, HEIGHT);
  };
  const presets = [
    { label: 'Paraboloid', value: 'x^2 + y^2' },
    { label: 'Saddle', value: 'x^2 - y^2' },
    { label: 'Ripple', value: 'sin(sqrt(x^2 + y^2))' },
    { label: 'Sine surface', value: 'sin(x) * cos(y)' },
    { label: 'Saddle wave', value: 'x*y' },
  ];
  const downloadPng = async () => {
    if (!surfaceRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const image = await toPng(surfaceRef.current, { pixelRatio: 2, backgroundColor: getComputedStyle(surfaceRef.current).backgroundColor });
      const link = document.createElement('a'); link.href = image; link.download = 'mathematics-3d-surface.png'; link.click(); setError('');
    } catch { setError('The surface image could not be exported in this browser.'); }
  };
  return <div className="surface-workspace">
    <section className="play-panel surface-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>3D surface plotter</h2><p>Rotate, scale and inspect surfaces defined by z = f(x, y).</p></div></div>
      <label className="graph-field-label" htmlFor="surface-expression">Surface expression · z = f(x, y)</label>
      <input id="surface-expression" value={expression} onChange={(event) => setExpression(event.target.value)} spellCheck={false} autoComplete="off"/>
      <div className="surface-presets"><span>Presets</span>{presets.map((preset) => <button key={preset.label} onClick={() => { setExpression(preset.value); setError(''); }}>{preset.label}</button>)}</div>
      <div className="surface-canvas-wrap" ref={surfaceRef}>
        {surface ? <svg className="surface-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Three-dimensional wireframe surface plot">
          <line x1={WIDTH / 2 - 200} y1={HEIGHT / 2 + 80} x2={WIDTH / 2 + 200} y2={HEIGHT / 2 + 80} className="surface-axis"/>
          {surface.rows.map((row, index) => <polyline key={`row-${index}`} points={row.filter((point) => Number.isFinite(point.z)).map((point) => { const p = project(point); return `${p.x},${p.y}`; }).join(' ')} className="surface-mesh-line" />)}
          {surface.rows[0]?.map((_, column) => <polyline key={`column-${column}`} points={surface.rows.map((row) => row[column]).filter((point) => point && Number.isFinite(point.z)).map((point) => { const p = project(point); return `${p.x},${p.y}`; }).join(' ')} className="surface-mesh-line surface-mesh-secondary" />)}
          <text x="18" y="24" className="surface-caption">z = {expression}</text>
        </svg> : <div className="tool-empty"><Activity size={20}/><strong>Surface unavailable</strong><span>Check the expression and its real-valued domain.</span></div>}
      </div>
      <div className="surface-actions"><button className="button button-secondary" onClick={() => { setAzimuth(-38); setElevation(34); setZoom(1); }}><RotateCcw size={14}/> Reset view</button><button className="button button-secondary" onClick={() => void saveSurfaceSession()}><Archive size={14}/> Save surface</button><button className="button button-secondary" onClick={downloadPng}><Download size={14}/> Export PNG</button></div>{sessionNotice && <p className="workspace-inline-notice" role="status">{sessionNotice}</p>}
      <div className="surface-controls">
        <label>Azimuth <strong>{azimuth}°</strong><input type="range" min="-180" max="180" value={azimuth} onChange={(event) => setAzimuth(Number(event.target.value))}/></label>
        <label>Elevation <strong>{elevation}°</strong><input type="range" min="8" max="82" value={elevation} onChange={(event) => setElevation(Number(event.target.value))}/></label>
        <label>Zoom <strong>{zoom.toFixed(1)}×</strong><input type="range" min="0.5" max="1.8" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/></label>
        <label>Mesh detail <strong>{resolution} × {resolution}</strong><input type="range" min="8" max="32" step="2" value={resolution} onChange={(event) => setResolution(Number(event.target.value))}/></label>
      </div>
      <div className="graph-range-controls surface-range-controls"><label>x minimum<input type="number" value={xMin} onChange={(event) => setXMin(Number(event.target.value))}/></label><label>x maximum<input type="number" value={xMax} onChange={(event) => setXMax(Number(event.target.value))}/></label><label>y minimum<input type="number" value={yMin} onChange={(event) => setYMin(Number(event.target.value))}/></label><label>y maximum<input type="number" value={yMax} onChange={(event) => setYMax(Number(event.target.value))}/></label></div>
      <div className="geometry-help"><strong>Surface information</strong><p>{surface ? `z range: ${formatNumber(surface.zMin, 5)} to ${formatNumber(surface.zMax, 5)} · ${surface.rows.length} × ${surface.rows.length} sampled grid.` : 'No valid surface samples in the selected domain.'} The plot is a sampled wireframe visualization, not a symbolic surface proof.</p></div>
      {error && <p className="tool-error">{error}</p>}
    </section>
  </div>;
}

function MathematicalVisualizations() {
  const [active, setActive] = useState<'unit' | 'derivative' | 'integral' | 'sequence'>('unit');
  const [angle, setAngle] = useState(45);
  const [derivativeExpression, setDerivativeExpression] = useState('x^2');
  const [derivativeX, setDerivativeX] = useState(1);
  const [integralExpression, setIntegralExpression] = useState('x^2');
  const [lower, setLower] = useState(0);
  const [upper, setUpper] = useState(2);
  const [sequenceKind, setSequenceKind] = useState<'natural' | 'squares' | 'harmonic' | 'geometric' | 'fibonacci'>('squares');
  const [sequenceCount, setSequenceCount] = useState(16);
  const theta = angle * Math.PI / 180;
  const unitX = 260 + Math.cos(theta) * 140;
  const unitY = 190 - Math.sin(theta) * 140;
  const derivativeValue = useMemo(() => {
    try { return { value: evaluate(derivativeExpression, { x: derivativeX }), slope: estimateDerivative(derivativeExpression, derivativeX, evaluate), error: '' }; }
    catch (reason) { return { value: null, slope: null, error: reason instanceof Error ? reason.message : 'Invalid function.' }; }
  }, [derivativeExpression, derivativeX]);
  const integralValue = useMemo(() => {
    if (upper <= lower) return null;
    return estimateIntegral(integralExpression, lower, upper, evaluate);
  }, [integralExpression, lower, upper]);
  const sequence = useMemo(() => {
    if (sequenceKind === 'fibonacci') {
      const values = [0, 1];
      while (values.length < sequenceCount) values.push(values[values.length - 1] + values[values.length - 2]);
      return values.slice(0, sequenceCount);
    }
    return Array.from({ length: sequenceCount }, (_, index) => {
      const n = index + 1;
      if (sequenceKind === 'squares') return n * n;
      if (sequenceKind === 'harmonic') return 1 / n;
      if (sequenceKind === 'geometric') return 1 / Math.pow(2, n - 1);
      return n;
    });
  }, [sequenceKind, sequenceCount]);
  const sequenceMax = Math.max(1, ...sequence);
  const sequenceMin = Math.min(0, ...sequence);
  const sequenceX = (n: number) => 42 + (n - 1) * 420 / Math.max(1, sequence.length - 1);
  const sequenceY = (value: number) => 300 - (value - sequenceMin) / Math.max(1e-9, sequenceMax - sequenceMin) * 250;
  const visualTabs = [
    { id: 'unit' as const, label: 'Unit circle' },
    { id: 'derivative' as const, label: 'Derivative' },
    { id: 'integral' as const, label: 'Integral area' },
    { id: 'sequence' as const, label: 'Sequences' },
  ];
  return <div className="visualization-workspace">
    <div className="graph-mode-tabs visualization-tabs" role="tablist" aria-label="Mathematical visualizations">{visualTabs.map((tab) => <button key={tab.id} role="tab" aria-selected={active === tab.id} className={active === tab.id ? 'selected' : ''} onClick={() => setActive(tab.id)}>{tab.label}</button>)}</div>
    {active === 'unit' && <section className="play-panel visualization-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>Interactive unit circle</h2><p>Explore how an angle maps to cosine and sine coordinates.</p></div></div>
      <div className="unit-circle-layout"><svg className="unit-circle-canvas" viewBox="0 0 520 380" role="img" aria-label={`Unit circle at ${angle} degrees, cosine ${Math.cos(theta).toFixed(4)}, sine ${Math.sin(theta).toFixed(4)}`}>
        <line x1="35" x2="485" y1="190" y2="190" className="graph-tool-axis"/><line x1="260" x2="260" y1="25" y2="355" className="graph-tool-axis"/><circle cx="260" cy="190" r="140" className="unit-circle-ring"/>
        <line x1="260" y1="190" x2={unitX} y2={unitY} className="unit-circle-radius"/><line x1={unitX} y1={unitY} x2={unitX} y2="190" className="unit-circle-projection"/><line x1="260" y1={unitY} x2={unitX} y2={unitY} className="unit-circle-projection"/><path d={`M 310 190 A 50 50 0 ${angle % 360 > 180 || angle % 360 < -180 ? 1 : 0} 0 ${260 + 50 * Math.cos(theta)} ${190 - 50 * Math.sin(theta)}`} className="unit-circle-angle"/><circle cx={unitX} cy={unitY} r="5" className="unit-circle-point"/>
        <text x="490" y="182" className="surface-caption">x</text><text x="270" y="24" className="surface-caption">y</text><text x="268" y="207" className="surface-caption">0</text><text x="260" y="370" textAnchor="middle" className="surface-caption">cos θ is horizontal · sin θ is vertical</text>
      </svg><div className="unit-circle-readout"><label>Angle <strong>{angle}°</strong><input type="range" min="-360" max="360" step="1" value={angle} onChange={(event) => setAngle(Number(event.target.value))}/></label><div><span>Radians</span><strong>{formatNumber(theta, 7)}</strong></div><div><span>cos θ</span><strong>{formatNumber(Math.cos(theta), 8)}</strong></div><div><span>sin θ</span><strong>{formatNumber(Math.sin(theta), 8)}</strong></div><div><span>tan θ</span><strong>{Math.abs(Math.cos(theta)) < 1e-10 ? 'Undefined' : formatNumber(Math.tan(theta), 8)}</strong></div></div></div>
    </section>}
    {active === 'derivative' && <section className="play-panel visualization-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>Derivative and tangent explorer</h2><p>Move the point along a function and observe its local slope.</p></div></div>
      <label className="graph-field-label" htmlFor="visual-derivative-expression">Function · f(x)</label><input id="visual-derivative-expression" value={derivativeExpression} onChange={(event) => setDerivativeExpression(event.target.value)} spellCheck={false}/>
      <GraphPlot mode="cartesian" functions={[{ id: 'derivative-visual', expression: derivativeExpression }]} expression={derivativeExpression} secondExpression="0" xRange={{ min: -5, max: 5 }} yRange={{ min: -5, max: 5 }} inspectValue={derivativeX} onInspect={setDerivativeX} showTangent showIntegral={false}/>
      <label className="visualization-slider-label">Move x <strong>{derivativeX.toFixed(2)}</strong><input type="range" min="-4.5" max="4.5" step="0.05" value={derivativeX} onChange={(event) => setDerivativeX(Number(event.target.value))}/></label>
      {derivativeValue.error ? <p className="tool-error">{derivativeValue.error}</p> : <div className="visualization-readouts"><div><span>Function value</span><strong>{derivativeValue.value === null ? 'Undefined' : formatNumber(derivativeValue.value, 8)}</strong></div><div><span>Estimated derivative</span><strong>{derivativeValue.slope === null ? 'Unavailable' : formatNumber(derivativeValue.slope, 8)}</strong></div></div>}
      <p className="math-engine-note">The tangent slope is estimated with a central finite difference. It is not a symbolic derivative or a formal proof of differentiability.</p>
    </section>}
    {active === 'integral' && <section className="play-panel visualization-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>Integral area explorer</h2><p>Visualize signed area between a function and the x-axis.</p></div></div>
      <label className="graph-field-label" htmlFor="visual-integral-expression">Function · f(x)</label><input id="visual-integral-expression" value={integralExpression} onChange={(event) => setIntegralExpression(event.target.value)} spellCheck={false}/>
      <div className="graph-range-controls"><label>Lower bound<input type="number" value={lower} onChange={(event) => setLower(Number(event.target.value))}/></label><label>Upper bound<input type="number" value={upper} onChange={(event) => setUpper(Number(event.target.value))}/></label></div>
      {upper > lower ? <GraphPlot mode="cartesian" functions={[{ id: 'integral-visual', expression: integralExpression }]} expression={integralExpression} secondExpression="0" xRange={{ min: lower, max: upper }} yRange={{ min: -5, max: 5 }} inspectValue={lower} onInspect={() => undefined} showTangent={false} showIntegral/> : <div className="tool-error">The upper bound must be greater than the lower bound.</div>}
      <div className="visualization-result"><span>Estimated definite integral</span><strong>{integralValue === null ? 'Unavailable' : formatNumber(integralValue, 10)}</strong><small>Composite Simpson approximation over the selected bounds.</small></div>
    </section>}
    {active === 'sequence' && <section className="play-panel visualization-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>Sequence explorer</h2><p>Compare how common mathematical sequences develop over n.</p></div></div>
      <div className="graph-range-controls"><label>Sequence<select value={sequenceKind} onChange={(event) => setSequenceKind(event.target.value as typeof sequenceKind)}><option value="natural">Natural numbers · n</option><option value="squares">Square numbers · n²</option><option value="harmonic">Harmonic · 1/n</option><option value="geometric">Geometric · 1/2ⁿ⁻¹</option><option value="fibonacci">Fibonacci</option></select></label><label>Terms<input type="number" min="5" max="40" value={sequenceCount} onChange={(event) => setSequenceCount(Math.max(5, Math.min(40, Number(event.target.value) || 5)))}/></label></div>
      <svg className="sequence-canvas" viewBox="0 0 520 340" role="img" aria-label={`Plot of ${sequenceKind} sequence`}><line x1="35" x2="495" y1="300" y2="300" className="graph-tool-axis"/><line x1="35" x2="35" y1="25" y2="300" className="graph-tool-axis"/>{Array.from({ length: 6 }, (_, index) => <line key={index} x1="35" x2="495" y1={35 + index * 53} y2={35 + index * 53} className="graph-tool-grid"/>)}<polyline points={sequence.map((value, index) => `${sequenceX(index + 1)},${sequenceY(value)}`).join(' ')} className="sequence-line"/>{sequence.map((value, index) => <circle key={index} cx={sequenceX(index + 1)} cy={sequenceY(value)} r="3.5" className="sequence-point"/>)}<text x="495" y="323" textAnchor="end" className="surface-caption">n</text></svg>
      <div className="sequence-values">{sequence.slice(0, 12).map((value, index) => <div key={index}><span>a{index + 1}</span><strong>{formatNumber(value, 7)}</strong></div>)}</div>
      <p className="math-engine-note">The sequence view displays a finite set of terms. It does not infer convergence or prove a sequence limit.</p>
    </section>}
  </div>;
}

export default function GraphTool({ restoreSessionId }: { restoreSessionId?: string }) {
  const [mode, setMode] = useState<GraphMode>('cartesian');
  const [expression, setExpression] = useState('x^2');
  const [secondExpression, setSecondExpression] = useState('sin(t)');
  const [functions, setFunctions] = useState<FunctionItem[]>([{ id: 'function-1', expression: 'x^2' }]);
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);
  const [inspectValue, setInspectValue] = useState(1);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<'first' | 'second'>('first');
  const [error, setError] = useState('');
  const [showTangent, setShowTangent] = useState(false);
  const [showIntegral, setShowIntegral] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const restoredSessionRef = useRef('');

  useEffect(() => {
    if (!restoreSessionId || restoredSessionRef.current === restoreSessionId) return;
    restoredSessionRef.current = restoreSessionId;
    void loadPersonalWorkspace().then((workspace) => {
      const session = workspace.sessions.find((item) => item.id === restoreSessionId && item.kind === 'graph');
      if (!session) { setSessionNotice('Saved graph configuration was not found.'); return; }
      const value = session.payload;
      if (value.mode === 'cartesian') setMode('cartesian');
      else if (typeof value.mode === 'string' && ['polar', 'parametric', 'implicit', 'surface', 'visualizations'].includes(value.mode)) {
        setMode('cartesian');
        setSessionNotice('That graph mode is marked Soon. Opened the Cartesian workspace instead.');
      }
      if (typeof value.expression === 'string') setExpression(value.expression);
      if (typeof value.secondExpression === 'string') setSecondExpression(value.secondExpression);
      if (Array.isArray(value.functions)) {
        const restoredFunctions = value.functions.filter((item): item is FunctionItem => Boolean(item) && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string' && typeof (item as Record<string, unknown>).expression === 'string').slice(0, 8);
        if (restoredFunctions.length) setFunctions(restoredFunctions);
      }
      const setRange = (minKey: string, maxKey: string, setMin: (next: number) => void, setMax: (next: number) => void) => { const minimum = value[minKey]; const maximum = value[maxKey]; if (typeof minimum === 'number' && typeof maximum === 'number' && Number.isFinite(minimum) && Number.isFinite(maximum) && minimum < maximum && Math.abs(minimum) <= 1e6 && Math.abs(maximum) <= 1e6) { setMin(minimum); setMax(maximum); } };
      setRange('xMin', 'xMax', setXMin, setXMax);
      setRange('yMin', 'yMax', setYMin, setYMax);
      const setNumber = (key: string, setter: (next: number) => void, min: number, max: number) => { const number = value[key]; if (typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max) setter(number); };
      setNumber('inspectValue', setInspectValue, -1e6, 1e6);
      if (typeof value.showTangent === 'boolean') setShowTangent(value.showTangent);
      if (typeof value.showIntegral === 'boolean') setShowIntegral(value.showIntegral);
      setError(''); setSessionNotice(`Restored “${session.name}”.`);
    }).catch(() => setSessionNotice('Saved graph configuration could not be loaded.'));
  }, [restoreSessionId]);


  const range = useMemo(() => ({ min: xMin, max: xMax }), [xMin, xMax]);
  const yRange = useMemo(() => ({ min: yMin, max: yMax }), [yMin, yMax]);
  const analysis = useMemo(() => {
    if (mode !== 'cartesian' || !functions[0] || xMax <= xMin) return null;
    try { return analyseFunction(functions[0].expression, range, evaluate, inspectValue); }
    catch { return null; }
  }, [mode, functions, range, inspectValue]);
  const pairAnalysis = useMemo(() => {
    if (mode !== 'cartesian' || functions.length < 2 || xMax <= xMin) return null;
    try { return { intersections: findFunctionIntersections(functions[0].expression, functions[1].expression, range, evaluate), area: estimateAreaBetween(functions[0].expression, functions[1].expression, xMin, xMax, evaluate) }; }
    catch { return null; }
  }, [mode, functions, range]);
  const inspectValues = useMemo(() => {
    if (mode === 'cartesian') return functions.map((item) => {
      try { return { id: item.id, label: `y = ${expressionToLatex(item.expression)}`, value: formatNumber(evaluate(item.expression, { x: inspectValue }), 8) }; }
      catch { return { id: item.id, label: `y = ${expressionToLatex(item.expression)}`, value: 'undefined' }; }
    });
    if (mode === 'polar') {
      try { const radius = evaluate(expression, { t: inspectValue }); return [{ id: 'polar', label: 'r(θ)', value: formatNumber(radius, 8) }]; }
      catch { return [{ id: 'polar', label: 'r(θ)', value: 'undefined' }]; }
    }
    if (mode === 'parametric') {
      try { return [{ id: 'parametric', label: 'x(t), y(t)', value: `(${formatNumber(evaluate(expression, { t: inspectValue }), 6)}, ${formatNumber(evaluate(secondExpression, { t: inspectValue }), 6)})` }]; }
      catch { return [{ id: 'parametric', label: 'x(t), y(t)', value: 'undefined' }]; }
    }
    return [];
  }, [mode, functions, expression, secondExpression, inspectValue]);
  const insert = (token: string) => {
    const input = activeInput === 'first' ? inputRef.current : secondInputRef.current;
    const value = activeInput === 'first' ? expression : secondExpression;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    if (activeInput === 'first') setExpression(next); else setSecondExpression(next);
    requestAnimationFrame(() => { const target = activeInput === 'first' ? inputRef.current : secondInputRef.current; target?.focus(); target?.setSelectionRange(start + token.length, start + token.length); });
  };
  const addFunction = () => {
    try {
      evaluate(expression, { x: 0.5 });
      setFunctions((current) => [...current, { id: `${Date.now()}-${Math.random()}`, expression: expression.trim() }]);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Check the function expression.'); }
  };
  const zoom = (factor: number) => { const center = (xMin + xMax) / 2; const half = (xMax - xMin) * factor / 2; setXMin(Number((center - half).toFixed(4))); setXMax(Number((center + half).toFixed(4))); };
  const currentMode = graphModes.find((item) => item.id === mode)!;
  return <div className="graph-studio">
    {sessionNotice && <div className="workspace-inline-notice" role="status">{sessionNotice}</div>}
    <div className="graph-mode-tabs" role="tablist" aria-label="Graph type">{graphModes.map((item) => <button key={item.id} type="button" role="tab" disabled={Boolean(item.soon)} aria-disabled={Boolean(item.soon)} aria-selected={mode === item.id} className={`${mode === item.id ? 'selected' : ''} ${item.soon ? 'graph-mode-soon' : ''}`} onClick={() => { if (item.soon) return; setMode(item.id); setKeyboardOpen(false); setError(''); }}>{item.label}{item.soon && <span className="soon-pill">Soon</span>}</button>)}</div>
    {mode === 'surface' ? <SurfaceWorkspace restoreSessionId={restoreSessionId}/> : mode === 'visualizations' ? <MathematicalVisualizations/> : <div className="play-tool-grid graph-layout graph-studio-layout">
      <section className="play-panel graph-panel">
        <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17}/></div><div><h2>{mode === 'implicit' ? 'Implicit equation plotter' : mode === 'polar' ? 'Polar graphing' : mode === 'parametric' ? 'Parametric graphing' : 'Interactive graphing'}</h2><p>{currentMode.description}</p></div></div>
        <div className="graph-expression-form">
          {mode === 'cartesian' && <label htmlFor="graph-expression">Function · y = f(x)</label>}
          {mode === 'polar' && <label htmlFor="graph-expression">Radius · r(θ)</label>}
          {mode === 'parametric' && <label htmlFor="graph-expression">Horizontal component · x(t)</label>}
          {mode === 'implicit' && <label htmlFor="graph-expression">Implicit equation · F(x, y) = 0</label>}
          {mode === 'parametric' ? <div className="graph-expression-input"><span>x(t) =</span><input id="graph-expression" ref={inputRef} value={expression} onChange={(event) => setExpression(event.target.value)} onFocus={() => { setActiveInput('first'); setKeyboardOpen(true); }} spellCheck={false}/></div> : <div className="graph-expression-input"><span>{mode === 'cartesian' ? 'y =' : mode === 'polar' ? 'r =' : 'F ='}</span><input id="graph-expression" ref={inputRef} value={expression} onChange={(event) => setExpression(event.target.value)} onFocus={() => { setActiveInput('first'); setKeyboardOpen(true); }} onKeyDown={(event) => { if (event.key === 'Enter' && mode === 'cartesian') addFunction(); if (event.key === 'Escape') setKeyboardOpen(false); }} spellCheck={false}/>{mode === 'cartesian' && <button className="button button-primary" onClick={addFunction}><Plus size={14}/> Add function</button>}</div>}
          {mode === 'parametric' && <div className="graph-expression-input"><span>y(t) =</span><input ref={secondInputRef} value={secondExpression} onChange={(event) => setSecondExpression(event.target.value)} onFocus={() => { setActiveInput('second'); setKeyboardOpen(true); }} spellCheck={false}/></div>}
          {error && <p className="tool-error">{error}</p>}
        </div>
        {keyboardOpen && <MathKeyboard onInsert={insert} onClose={() => setKeyboardOpen(false)} compact/>}
        {mode === 'cartesian' && <div className="graph-function-list">{functions.map((item, index) => <div className="graph-function-chip" key={item.id}><span className={`graph-legend-line graph-legend-${index % 4}`}/><MathExpression latex={`y = ${expressionToLatex(item.expression)}`}/><button onClick={() => setFunctions((current) => current.filter((func) => func.id !== item.id))} aria-label={`Remove function ${item.expression}`}><Trash2 size={13}/></button></div>)}</div>}
        {(mode === 'implicit') && <div className="graph-range-controls"><label>x minimum<input type="number" value={xMin} onChange={(event) => setXMin(Number(event.target.value))}/></label><label>x maximum<input type="number" value={xMax} onChange={(event) => setXMax(Number(event.target.value))}/></label><label>y minimum<input type="number" value={yMin} onChange={(event) => setYMin(Number(event.target.value))}/></label><label>y maximum<input type="number" value={yMax} onChange={(event) => setYMax(Number(event.target.value))}/></label></div>}
        <div className="graph-range-controls"><label>{mode === 'cartesian' || mode === 'implicit' ? 'x minimum' : 'Parameter minimum'}<input type="number" value={xMin} onChange={(event) => setXMin(Number(event.target.value))}/></label><label>{mode === 'cartesian' || mode === 'implicit' ? 'x maximum' : 'Parameter maximum'}<input type="number" value={xMax} onChange={(event) => setXMax(Number(event.target.value))}/></label><div className="graph-zoom-actions"><button className="tool-icon-button" onClick={() => zoom(.7)} aria-label="Zoom in"><ZoomIn size={15}/></button><button className="tool-icon-button" onClick={() => zoom(1.4)} aria-label="Zoom out"><ZoomOut size={15}/></button></div></div>
        <div className="graph-tool-canvas-wrap"><GraphPlot mode={mode} functions={functions} expression={expression} secondExpression={secondExpression} xRange={range} yRange={yRange} inspectValue={inspectValue} onInspect={setInspectValue} showTangent={showTangent} showIntegral={showIntegral}/></div>
        {inspectValues.length > 0 && <div className="graph-inspector-panel"><span>INSPECTED {mode === 'cartesian' || mode === 'implicit' ? 'X' : 'PARAMETER'} <strong>{formatNumber(inspectValue, 6)}</strong></span>{inspectValues.map((item) => <span key={item.id}><MathExpression latex={item.label}/><strong>{item.value}</strong></span>)}</div>}
        {mode === 'cartesian' && <>
          <div className="graph-analysis-toggles"><label><input type="checkbox" checked={showTangent} onChange={(event) => setShowTangent(event.target.checked)}/> Show tangent at inspected x</label><label><input type="checkbox" checked={showIntegral} onChange={(event) => setShowIntegral(event.target.checked)}/> Shade area to x-axis</label></div>
          {analysis && <div className="graph-analysis-grid">
            <div><span>Derivative at x</span><strong>{analysis.derivativeAt === null ? 'Unavailable' : formatNumber(analysis.derivativeAt, 7)}</strong></div>
            <div><span>Estimated signed area</span><strong>{analysis.integralEstimate === null ? 'Unavailable' : formatNumber(analysis.integralEstimate, 7)}</strong></div>
            <div><span>Estimated roots</span><strong>{analysis.roots.length ? analysis.roots.slice(0, 5).map((value) => formatNumber(value, 5)).join(', ') : 'None detected'}</strong></div>
            <div><span>Extrema in range</span><strong>{analysis.extrema.length ? analysis.extrema.slice(0, 4).map((item) => `${item.kind === 'maximum' ? 'max' : 'min'} (${formatNumber(item.x, 3)}, ${formatNumber(item.y, 3)})`).join(' · ') : 'None detected'}</strong></div>
            <div><span>Sampled range</span><strong>{analysis.minimum && analysis.maximum ? `${formatNumber(analysis.minimum.y, 5)} to ${formatNumber(analysis.maximum.y, 5)}` : 'Unavailable'}</strong></div>
            {pairAnalysis && <><div><span>First pair intersections</span><strong>{pairAnalysis.intersections.length ? pairAnalysis.intersections.slice(0, 5).map((item) => `(${formatNumber(item.x, 4)}, ${formatNumber(item.y, 4)})`).join(' · ') : 'None detected'}</strong></div><div><span>Estimated area between first pair</span><strong>{pairAnalysis.area === null ? 'Unavailable' : formatNumber(pairAnalysis.area, 7)}</strong></div></>}
          </div>}
          <p className="math-engine-note">Analysis values are numerical estimates over the selected interval. Sampling can miss closely spaced roots, discontinuities or narrow extrema. The first two functions are used for intersection and area-between-curves estimates.</p>
        </>}
      </section>
    </div>}
  </div>;
}
