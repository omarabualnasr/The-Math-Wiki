import { useMemo, useRef, useState } from 'react';
import { Copy, Table } from 'lucide-react';
import { evaluateMathExpression, formatNumber } from '../../engine/mathEngine';
import MathKeyboard from './MathKeyboard';

type TableMode = 'multiply' | 'add' | 'subtract' | 'divide' | 'square' | 'cube' | 'powers' | 'primes' | 'fibonacci' | 'custom';
const labels: Record<TableMode, string> = {
  multiply: 'Multiplication table', add: 'Addition table', subtract: 'Subtraction table', divide: 'Division table',
  square: 'Square numbers', cube: 'Cube numbers', powers: 'Powers', primes: 'Prime numbers', fibonacci: 'Fibonacci sequence', custom: 'Custom function table',
};
const gridModes = new Set<TableMode>(['multiply', 'add', 'subtract', 'divide']);
const calculateCell = (row: number, column: number, operation: TableMode): string => {
  const result = operation === 'multiply' ? row * column
    : operation === 'add' ? row + column
    : operation === 'subtract' ? row - column
    : column === 0 ? '—' : Number((row / column).toFixed(4)).toString();
  return typeof result === 'number' ? String(result) : result;
};
const isPrime = (value: number): boolean => {
  if (!Number.isInteger(value) || value < 2) return false;
  for (let divisor = 2; divisor <= Math.sqrt(value); divisor += 1) if (value % divisor === 0) return false;
  return true;
};
const nextPrimes = (start: number, count: number): number[] => {
  const results: number[] = [];
  let candidate = Math.max(2, Math.ceil(start));
  while (results.length < count) { if (isPrime(candidate)) results.push(candidate); candidate += 1; }
  return results;
};
const fibonacci = (index: number): string => {
  let previous = 0n;
  let current = 1n;
  for (let i = 0; i < index; i += 1) [previous, current] = [current, previous + current];
  return previous.toString();
};

type SequenceRow = { input: number; result: string };

export default function TablesTool() {
  const [mode, setMode] = useState<TableMode>('multiply');
  const [size, setSize] = useState(12);
  const [start, setStart] = useState(1);
  const [power, setPower] = useState(3);
  const [customExpression, setCustomExpression] = useState('x^2 + 2*x + 1');
  const [notice, setNotice] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);
  const values = useMemo(() => Array.from({ length: size }, (_, index) => start + index), [size, start]);
  const isGrid = gridModes.has(mode);
  const sequence = useMemo<SequenceRow[]>(() => {
    if (mode === 'primes') return nextPrimes(start, size).map((value, index) => ({ input: start + index, result: String(value) }));
    return values.map((value, index) => {
      if (mode === 'square') return { input: value, result: String(value * value) };
      if (mode === 'cube') return { input: value, result: String(value * value * value) };
      if (mode === 'powers') return { input: value, result: formatNumber(value ** power, 12) };
      if (mode === 'fibonacci') return { input: value, result: value >= 0 && value <= 1000 && Number.isInteger(value) ? fibonacci(value) : 'Use an index from 0 to 1000' };
      if (mode === 'custom') {
        try { return { input: value, result: formatNumber(evaluateMathExpression(customExpression, { x: value }), 12) }; }
        catch { return { input: value, result: '—' }; }
      }
      return { input: value, result: String(index) };
    });
  }, [mode, values, start, size, power, customExpression]);
  const tableText = useMemo(() => {
    if (isGrid) { const operator = mode === 'multiply' ? '×' : mode === 'add' ? '+' : mode === 'subtract' ? '−' : '÷'; return [[operator, ...values.map(String)], ...values.map((row) => [String(row), ...values.map((column) => calculateCell(row, column, mode))])].map((line) => line.join('\t')).join('\n'); }
    return [['Input', 'Result'], ...sequence.map((row) => [String(row.input), row.result])].map((line) => line.join('\t')).join('\n');
  }, [values, mode, isGrid, sequence]);
  const copy = async () => { try { await navigator.clipboard.writeText(tableText); setNotice('Table copied.'); } catch { setNotice('Clipboard access is unavailable in this browser.'); } };
  const insert = (token: string) => { const input = customInputRef.current; const cursor = input?.selectionStart ?? customExpression.length; const end = input?.selectionEnd ?? customExpression.length; setCustomExpression(`${customExpression.slice(0, cursor)}${token}${customExpression.slice(end)}`); requestAnimationFrame(() => { customInputRef.current?.focus(); customInputRef.current?.setSelectionRange(cursor + token.length, cursor + token.length); }); };

  return <div className="play-tool-grid tables-layout">
    <section className="play-panel tables-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Table size={17} /></div><div><h2>Math tables</h2><p>Generate operation tables, number sequences and custom function values.</p></div></div>
      <div className="table-controls table-controls-expanded">
        <label>Table type<select value={mode} onChange={(event) => { const next = event.target.value as TableMode; setMode(next); setNotice(''); if (next !== 'custom') setKeyboardOpen(false); }}><optgroup label="Operation tables"><option value="multiply">Multiplication</option><option value="add">Addition</option><option value="subtract">Subtraction</option><option value="divide">Division</option></optgroup><optgroup label="Number sequences"><option value="square">Square numbers</option><option value="cube">Cube numbers</option><option value="powers">Powers</option><option value="primes">Prime numbers</option><option value="fibonacci">Fibonacci sequence</option><option value="custom">Custom function</option></optgroup></select></label>
        <label>Start at<input type="number" value={start} min={-100} max={100} onChange={(event) => setStart(Math.max(-100, Math.min(100, Number(event.target.value) || 0)))} /></label>
        <label>{isGrid ? 'Table size' : 'Number of values'}<select value={size} onChange={(event) => setSize(Number(event.target.value))}>{[5, 8, 10, 12, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {mode === 'powers' && <label>Exponent<input type="number" value={power} min={0} max={12} onChange={(event) => setPower(Math.max(0, Math.min(12, Number(event.target.value) || 0)))} /></label>}
        {mode === 'custom' && <label className="table-custom-expression">Function in x<input ref={customInputRef} value={customExpression} onChange={(event) => setCustomExpression(event.target.value)} onFocus={() => setKeyboardOpen(true)} placeholder="e.g. x^2 + 2*x + 1" /></label>}
        <button className="button button-secondary" onClick={() => void copy()}><Copy size={14} /> Copy table</button>
      </div>
      {mode === 'custom' && keyboardOpen && <MathKeyboard onInsert={insert} onClose={() => setKeyboardOpen(false)} compact />}
      {isGrid ? <div className="table-scroll" role="region" aria-label={`${labels[mode]} grid`} tabIndex={0}>
        <table className="math-table"><thead><tr><th>{mode === 'multiply' ? '×' : mode === 'add' ? '+' : mode === 'subtract' ? '−' : '÷'}</th>{values.map((value) => <th key={value}>{value}</th>)}</tr></thead><tbody>{values.map((row) => <tr key={row}><th>{row}</th>{values.map((column) => <td key={column}>{calculateCell(row, column, mode)}</td>)}</tr>)}</tbody></table>
      </div> : <div className="table-scroll" role="region" aria-label={`${labels[mode]} values`} tabIndex={0}><table className="math-table sequence-table"><thead><tr><th>Input</th><th>Result</th></tr></thead><tbody>{sequence.map((row, index) => <tr key={`${row.input}-${index}`}><th>{row.input}</th><td>{row.result}</td></tr>)}</tbody></table></div>}
    </section>
    <aside className="play-panel table-reference-panel"><div className="eyebrow">TABLE NOTES</div><h2>Generated on demand</h2><p>Choose a table type, starting value and size. Values update immediately as you change the controls.</p><div className="reference-stat"><strong>{isGrid ? size * size : sequence.length}</strong><span>Generated values</span></div><div className="reference-stat"><strong>{start}–{start + size - 1}</strong><span>Input range</span></div><div className="geometry-help"><strong>Table details</strong><p>{mode === 'divide' ? 'Division by zero is shown as an em dash. Quotients are displayed to at most four decimal places.' : mode === 'primes' ? 'Prime numbers are generated from the first prime at or above the selected starting value.' : mode === 'fibonacci' ? 'Fibonacci indices range from 0 through 1000. Large values are calculated with integer precision.' : mode === 'custom' ? 'Custom functions use x as the input variable and the same restricted mathematical expression engine as the graph workspace.' : 'All values are generated locally in your browser and can be copied into a spreadsheet or document.'}</p></div></aside>
  </div>;
}
