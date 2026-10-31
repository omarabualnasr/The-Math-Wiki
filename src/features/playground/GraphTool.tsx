import { useMemo, useRef, useState } from 'react';
import { Activity, Plus, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { evaluateMathExpression, formatNumber } from '../../engine/mathEngine';
import MathKeyboard from './MathKeyboard';

type FunctionItem = { id: string; expression: string };
const WIDTH = 760;
const HEIGHT = 430;
const PAD = { left: 64, right: 25, top: 28, bottom: 48 };
const lineClasses = ['graph-work-line graph-work-line-0', 'graph-work-line graph-work-line-1', 'graph-work-line graph-work-line-2', 'graph-work-line graph-work-line-3'];

function GraphPlot({ functions, xMin, xMax, onInspect }: { functions: FunctionItem[]; xMin: number; xMax: number; onInspect: (x: number) => void }) {
  const plot = useMemo(() => {
    const items = functions.map((item) => {
      const samples = Array.from({ length: 301 }, (_, index) => {
        const x = xMin + (xMax - xMin) * index / 300;
        let y = Number.NaN;
        try { y = evaluateMathExpression(item.expression, { x }); } catch { /* discontinuities are skipped */ }
        return { x, y };
      });
      return { ...item, samples };
    });
    const allValues = items.flatMap((item) => item.samples.map((point) => point.y).filter((value) => Number.isFinite(value) && Math.abs(value) < 1e7));
    if (!allValues.length) return null;
    const rawMin = Math.min(0, ...allValues);
    const rawMax = Math.max(0, ...allValues);
    const range = Math.max(1, rawMax - rawMin);
    const yMin = rawMin - range * .08;
    const yMax = rawMax + range * .08;
    const sx = (x: number) => PAD.left + (x - xMin) / (xMax - xMin) * (WIDTH - PAD.left - PAD.right);
    const sy = (y: number) => HEIGHT - PAD.bottom - (y - yMin) / (yMax - yMin) * (HEIGHT - PAD.top - PAD.bottom);
    const paths = items.map((item) => {
      let previousWasValid = false;
      const segments: string[] = [];
      for (const point of item.samples) {
        const valid = Number.isFinite(point.y) && Math.abs(point.y) < 1e7;
        if (valid) segments.push(`${previousWasValid ? 'L' : 'M'} ${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`);
        previousWasValid = valid;
      }
      return { ...item, path: segments.join(' ') };
    });
    return { yMin, yMax, sx, sy, paths };
  }, [functions, xMin, xMax]);

  if (!plot || xMax <= xMin) return <div className="tool-empty graph-tool-empty"><Activity size={21} /><strong>No plottable function</strong><span>Check the equation and x-axis range.</span></div>;
  const yZero = Math.min(HEIGHT - PAD.bottom, Math.max(PAD.top, plot.sy(0)));
  const xZero = Math.min(WIDTH - PAD.right, Math.max(PAD.left, plot.sx(0)));
  return <svg className="graph-work-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Interactive graph workspace. Click the graph to inspect a coordinate." onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const px = (event.clientX - rect.left) * WIDTH / rect.width; const x = xMin + (px - PAD.left) / (WIDTH - PAD.left - PAD.right) * (xMax - xMin); onInspect(Math.max(xMin, Math.min(xMax, x))); }}>
    {Array.from({ length: 9 }, (_, index) => { const y = PAD.top + index * (HEIGHT - PAD.top - PAD.bottom) / 8; return <line key={`h${index}`} x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="graph-tool-grid" />; })}
    {Array.from({ length: 11 }, (_, index) => { const x = PAD.left + index * (WIDTH - PAD.left - PAD.right) / 10; return <line key={`v${index}`} x1={x} x2={x} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="graph-tool-grid" />; })}
    <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yZero} y2={yZero} className="graph-tool-axis" />
    <line x1={xZero} x2={xZero} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="graph-tool-axis" />
    {plot.paths.map((item, index) => <path key={item.id} d={item.path} className={lineClasses[index % lineClasses.length]} />)}
    {Array.from({ length: 6 }, (_, index) => { const value = xMin + (xMax - xMin) * index / 5; return <text key={`xlabel-${index}`} x={plot.sx(value)} y={HEIGHT - 20} className="graph-tool-tick" textAnchor="middle">{formatNumber(value, 3)}</text>; })}
    {Array.from({ length: 5 }, (_, index) => { const value = plot.yMin + (plot.yMax - plot.yMin) * index / 4; return <text key={`ylabel-${index}`} x={PAD.left - 10} y={plot.sy(value) + 3} className="graph-tool-tick" textAnchor="end">{formatNumber(value, 3)}</text>; })}
    <text x={WIDTH - 13} y={HEIGHT - 20} className="graph-tool-label">x</text><text x="18" y="18" className="graph-tool-label">y</text>
  </svg>;
}

export default function GraphTool() {
  const [expression, setExpression] = useState('x^2');
  const [functions, setFunctions] = useState<FunctionItem[]>([{ id: 'function-1', expression: 'x^2' }]);
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [inspectX, setInspectX] = useState(1);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inspectValues = useMemo(() => functions.map((item) => {
    try { return { ...item, value: formatNumber(evaluateMathExpression(item.expression, { x: inspectX }), 8) }; }
    catch { return { ...item, value: 'undefined' }; }
  }), [functions, inspectX]);

  const insert = (token: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? expression.length;
    const next = `${expression.slice(0, start)}${token}${expression.slice(end)}`;
    setExpression(next);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + token.length, start + token.length); });
  };
  const addFunction = () => {
    const probeValues = [0.5, 1, -1, 2, -2, 0.25, 4];
    const hasValidValue = probeValues.some((x) => { try { evaluateMathExpression(expression, { x }); return true; } catch { return false; } });
    if (!hasValidValue) { setError('This expression could not be evaluated for real x-values. Check its syntax.'); return; }
    setFunctions((current) => [...current, { id: `${Date.now()}-${Math.random()}`, expression: expression.trim() }]);
    setError('');
  };
  const zoom = (factor: number) => { const center = (xMin + xMax) / 2; const half = (xMax - xMin) * factor / 2; setXMin(Number((center - half).toFixed(4))); setXMax(Number((center + half).toFixed(4))); };

  return <div className="play-tool-grid graph-layout">
    <section className="play-panel graph-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Activity size={17} /></div><div><h2>Interactive graphing</h2><p>Plot functions and inspect coordinate values.</p></div></div>
      <div className="graph-expression-form"><label htmlFor="graph-expression">Function</label><div className="graph-expression-input"><span>y =</span><input id="graph-expression" ref={inputRef} value={expression} onChange={(event) => setExpression(event.target.value)} onFocus={() => setKeyboardOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter') addFunction(); if (event.key === 'Escape') setKeyboardOpen(false); }} placeholder="e.g. sin(x)" autoComplete="off" spellCheck={false}/><button className="button button-primary" onClick={addFunction}><Plus size={14}/> Add function</button></div>{error && <p className="tool-error">{error}</p>}</div>
      {keyboardOpen && <MathKeyboard onInsert={insert} onClose={() => setKeyboardOpen(false)} compact />}
      <div className="graph-function-list">{functions.map((item, index) => <div className="graph-function-chip" key={item.id}><span className={`graph-legend-line graph-legend-${index % 4}`} /><code>y = {item.expression}</code><button onClick={() => setFunctions((current) => current.filter((func) => func.id !== item.id))} aria-label={`Remove function ${item.expression}`}><Trash2 size={13}/></button></div>)}</div>
      <div className="graph-range-controls"><label>x minimum<input type="number" value={xMin} onChange={(event) => setXMin(Number(event.target.value))}/></label><label>x maximum<input type="number" value={xMax} onChange={(event) => setXMax(Number(event.target.value))}/></label><div className="graph-zoom-actions"><button className="tool-icon-button" onClick={() => zoom(.7)} aria-label="Zoom in"><ZoomIn size={15}/></button><button className="tool-icon-button" onClick={() => zoom(1.4)} aria-label="Zoom out"><ZoomOut size={15}/></button></div></div>
      <div className="graph-tool-canvas-wrap"><GraphPlot functions={functions} xMin={xMin} xMax={xMax} onInspect={setInspectX}/></div>
      <div className="graph-inspector-panel"><span>INSPECTED X <strong>{formatNumber(inspectX, 6)}</strong></span>{inspectValues.map((item) => <span key={item.id}>y = {item.expression} <strong>{item.value}</strong></span>)}</div>
    </section>
    <aside className="play-panel graph-notes-panel"><div className="eyebrow">GRAPHING NOTES</div><h2>Function workspace</h2><p>Enter arithmetic expressions with x as the independent variable. You can add several functions to compare their shapes.</p><div className="graph-example-list"><span>Try these expressions</span>{['sin(x)', 'cos(x)', 'x^2', 'sqrt(abs(x))', '1/x', 'log(x)'].map((item) => <button key={item} onClick={() => setExpression(item)}><code>{item}</code><Plus size={13}/></button>)}</div><div className="geometry-help"><strong>Inspect coordinates</strong><p>Click anywhere inside the graph to read the x-coordinate and corresponding y-values for every plotted function.</p></div></aside>
  </div>;
}
