import { useMemo, useState } from 'react';
import { evaluate } from 'mathjs';
import { Minus, Plus } from 'lucide-react';
import type { GraphBlock as GraphBlockData } from '../../types/article';

const WIDTH = 680;
const HEIGHT = 330;
const PAD = { left: 58, right: 22, top: 22, bottom: 48 };

function compute(expression: string, x: number): number {
  // Graph expressions accept arithmetic and the variable x only. This prevents
  // imported article data from invoking unrelated mathjs functions.
  if (!/^[0-9xX+\-*/^().\s]+$/.test(expression) || !expression.trim()) return Number.NaN;
  try {
    const result = evaluate(expression, { x });
    return typeof result === 'number' && Number.isFinite(result) ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export default function GraphBlock({ block }: { block: GraphBlockData }) {
  const [selected, setSelected] = useState(block.inspectValue ?? Math.ceil((block.xMin + block.xMax) / 2));
  const plot = useMemo(() => {
    const samples = Array.from({ length: 101 }, (_, index) => {
      const x = block.xMin + (block.xMax - block.xMin) * index / 100;
      return { x, y: compute(block.expression, x) };
    }).filter((point) => Number.isFinite(point.y));
    if (!samples.length) return null;
    const rawMin = Math.min(0, ...samples.map((point) => point.y));
    const rawMax = Math.max(1, ...samples.map((point) => point.y));
    const spread = Math.max(1, rawMax - rawMin);
    const yMin = rawMin - spread * 0.08;
    const yMax = rawMax + spread * 0.08;
    const x = (value: number) => PAD.left + (value - block.xMin) / (block.xMax - block.xMin || 1) * (WIDTH - PAD.left - PAD.right);
    const y = (value: number) => HEIGHT - PAD.bottom - (value - yMin) / (yMax - yMin || 1) * (HEIGHT - PAD.top - PAD.bottom);
    const line = samples.map((point) => `${x(point.x)},${y(point.y)}`).join(' ');
    return { samples, yMin, yMax, x, y, line };
  }, [block.expression, block.xMin, block.xMax]);

  const selectedY = compute(block.expression, selected);
  const increase = () => setSelected((current) => Math.min(block.xMax, current + 1));
  const decrease = () => setSelected((current) => Math.max(block.xMin, current - 1));

  if (!plot || block.xMax <= block.xMin) return <div className="graph-error">This expression could not be plotted. Check the expression and x-axis range.</div>;
  const yZero = plot.y(0);
  const xZero = plot.x(0);
  const pointVisible = Number.isFinite(selectedY) && selected >= block.xMin && selected <= block.xMax;

  return <div className="article-graph">
    <div className="graph-head"><span>INTERACTIVE GRAPH</span><code>y = {block.expression}</code></div>
    <div className="graph-canvas-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Graph of ${block.expression} with horizontal axis ${block.xLabel || 'x'} and vertical axis ${block.yLabel || 'y'}`}>
        {Array.from({ length: 6 }, (_, i) => {
          const y = PAD.top + i * (HEIGHT - PAD.top - PAD.bottom) / 5;
          return <line key={`h${i}`} x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="graph-grid-line" />;
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const x = PAD.left + i * (WIDTH - PAD.left - PAD.right) / 6;
          return <line key={`v${i}`} x1={x} x2={x} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="graph-grid-line" />;
        })}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={Math.min(HEIGHT - PAD.bottom, Math.max(PAD.top, yZero))} y2={Math.min(HEIGHT - PAD.bottom, Math.max(PAD.top, yZero))} className="graph-axis" />
        <line x1={Math.min(WIDTH - PAD.right, Math.max(PAD.left, xZero))} x2={Math.min(WIDTH - PAD.right, Math.max(PAD.left, xZero))} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="graph-axis" />
        <polyline points={plot.line} className="graph-curve" />
        {pointVisible && <><line x1={plot.x(selected)} x2={plot.x(selected)} y1={plot.y(selectedY)} y2={HEIGHT - PAD.bottom} className="graph-guide" /><circle cx={plot.x(selected)} cy={plot.y(selectedY)} r="6" className="graph-point" /></>}
        <text x={PAD.left} y={HEIGHT - 15} className="graph-label">{block.xLabel || 'x'}</text>
        <text x="16" y="19" className="graph-label">{block.yLabel || 'y'}</text>
        <text x={PAD.left} y={HEIGHT - PAD.bottom + 18} className="graph-tick">{block.xMin}</text>
        <text x={WIDTH - PAD.right} y={HEIGHT - PAD.bottom + 18} textAnchor="end" className="graph-tick">{block.xMax}</text>
      </svg>
    </div>
    <div className="graph-controls">
      <div className="graph-inspector"><span>{block.xLabel || 'x'} = <strong>{selected}</strong></span><span>{block.yLabel || 'y'} = <strong>{Number.isFinite(selectedY) ? Number(selectedY.toFixed(4)) : 'undefined'}</strong></span></div>
      <div className="graph-slider-row"><button className="graph-stepper" onClick={decrease} aria-label="Decrease graph input" disabled={selected <= block.xMin}><Minus size={14} /></button><input aria-label="Graph input value" type="range" min={block.xMin} max={block.xMax} step="1" value={selected} onChange={(event) => setSelected(Number(event.target.value))} /><button className="graph-stepper" onClick={increase} aria-label="Increase graph input" disabled={selected >= block.xMax}><Plus size={14} /></button></div>
    </div>
    {block.caption && <p className="block-caption">{block.caption}</p>}
  </div>;
}
