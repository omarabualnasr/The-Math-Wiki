import { useEffect, useRef, useState } from 'react';
import { Archive, Calculator, Check, Clock3, Copy, History, RotateCcw, Trash2 } from 'lucide-react';
import { evaluateMathExpression, formatNumber } from '../../engine/mathEngine';
import MathKeyboard from './MathKeyboard';
import { loadPersonalWorkspace, saveWorkspaceSession } from '../../engine/personalWorkspaceStorage';
import { safeStorageGet, safeStorageGetJson, safeStorageRemove, safeStorageSet } from '../../engine/safeStorage';

const ArchiveIcon = () => <Archive size={13}/>;

type HistoryItem = { id: string; expression: string; result: string; createdAt: string };
type AngleMode = 'deg' | 'rad';
const HISTORY_KEY = 'math-wiki:calculator-history:v1';
const ANGLE_MODE_KEY = 'math-wiki:calculator-angle-mode:v1';
function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.expression === 'string' && typeof item.result === 'string' && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt));
}
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
function loadHistory(): HistoryItem[] {
  return safeStorageGetJson(HISTORY_KEY, [] as unknown[], isUnknownArray)
    .filter(isHistoryItem)
    .slice(0, 60);
}

export default function CalculatorTool({ restoreSessionId }: { restoreSessionId?: string }) {
  const [expression, setExpression] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(0);
  const [angleMode, setAngleMode] = useState<AngleMode>(() => safeStorageGet(ANGLE_MODE_KEY) === 'deg' ? 'deg' : 'rad');
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const restoredSessionRef = useRef('');

  useEffect(() => {
    if (!restoreSessionId || restoredSessionRef.current === restoreSessionId) return;
    restoredSessionRef.current = restoreSessionId;
    void loadPersonalWorkspace().then((workspace) => {
      const session = workspace.sessions.find((item) => item.id === restoreSessionId && item.kind === 'calculator');
      if (!session) { setSessionNotice('Saved calculator session was not found.'); return; }
      const payload = session.payload;
      if (typeof payload.expression === 'string') setExpression(payload.expression.slice(0, 4000));
      if (typeof payload.answer === 'string') setAnswer(payload.answer.slice(0, 300));
      if (typeof payload.lastAnswer === 'number' && Number.isFinite(payload.lastAnswer)) setLastAnswer(payload.lastAnswer);
      if (payload.angleMode === 'deg' || payload.angleMode === 'rad') { setAngleMode(payload.angleMode); safeStorageSet(ANGLE_MODE_KEY, payload.angleMode); }
      if (Array.isArray(payload.history)) {
        const restored = payload.history.filter(isHistoryItem).slice(0, 60);
        setHistory(restored); safeStorageSet(HISTORY_KEY, JSON.stringify(restored));
      }
      setSessionNotice(`Restored “${session.name}”.`);
    }).catch(() => setSessionNotice('Saved calculator session could not be loaded.'));
  }, [restoreSessionId]);

  const saveSession = async () => {
    const name = window.prompt('Name this calculator session', expression.trim() ? expression.slice(0, 38) : 'Calculator session');
    if (!name) return;
    try {
      await saveWorkspaceSession('calculator', name, { expression, answer, lastAnswer, angleMode, history: history as unknown as import('../../engine/personalWorkspaceStorage').JsonValue[] } as unknown as { [key: string]: import('../../engine/personalWorkspaceStorage').JsonValue });
      setSessionNotice('Calculator session saved to your Personal Workspace.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this calculator session.'); }
  };

  const insert = (token: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? expression.length;
    const next = `${expression.slice(0, start)}${token}${expression.slice(end)}`;
    setExpression(next);
    setError('');
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const calculate = (source = expression) => {
    try {
      const toRadians = (value: number) => angleMode === 'deg' ? value * Math.PI / 180 : value;
      const fromRadians = (value: number) => angleMode === 'deg' ? value * 180 / Math.PI : value;
      const result = evaluateMathExpression(source, {
        ans: lastAnswer,
        sin: (value: number) => Math.sin(toRadians(value)),
        cos: (value: number) => Math.cos(toRadians(value)),
        tan: (value: number) => Math.tan(toRadians(value)),
        asin: (value: number) => fromRadians(Math.asin(value)),
        acos: (value: number) => fromRadians(Math.acos(value)),
        atan: (value: number) => fromRadians(Math.atan(value)),
        atan2: (y: number, x: number) => fromRadians(Math.atan2(y, x)),
        ln: (value: number) => Math.log(value),
      });
      const formatted = formatNumber(result, 14);
      setAnswer(formatted);
      setLastAnswer(result);
      setError('');
      const item: HistoryItem = { id: `${Date.now()}-${Math.random()}`, expression: source, result: formatted, createdAt: new Date().toISOString() };
      const updated = [item, ...history].slice(0, 60);
      setHistory(updated);
      safeStorageSet(HISTORY_KEY, JSON.stringify(updated));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to calculate this expression.');
      setAnswer('');
    }
  };

  const clearHistory = () => { setHistory([]); safeStorageRemove(HISTORY_KEY); };
  const copy = async () => { if (answer) await navigator.clipboard?.writeText(answer).catch(() => undefined); };

  return <div className="play-tool-grid calculator-layout">
    <section className="play-panel calculator-panel">
      <div className="play-panel-heading"><div className="play-panel-icon"><Calculator size={17} /></div><div><h2>Scientific calculator</h2><p>Evaluate expressions with standard mathematical functions.</p></div><button className="button button-secondary workspace-save-button" onClick={() => void saveSession()}><ArchiveIcon/> Save session</button></div>
      {sessionNotice && <p className="workspace-inline-notice" role="status">{sessionNotice}</p>}
      <div className="calculator-display">
        <div className="calculator-input-label-row"><label htmlFor="scientific-expression">Expression</label><button type="button" className="angle-mode-toggle" onClick={() => { const next = angleMode === 'deg' ? 'rad' : 'deg'; setAngleMode(next); safeStorageSet(ANGLE_MODE_KEY, next); }}>{angleMode === 'deg' ? 'DEG' : 'RAD'}</button></div>
        <input ref={inputRef} id="scientific-expression" value={expression} onChange={(event) => { setExpression(event.target.value); setError(''); }} onFocus={() => setKeyboardOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); calculate(); } if (event.key === 'Escape') setKeyboardOpen(false); }} placeholder="Enter an expression, e.g. sin(pi / 4)" autoComplete="off" spellCheck={false} />
        <div className="calculator-result-row"><div><span>RESULT</span><output aria-live="polite">{answer || '—'}</output></div>{answer && <button className="tool-icon-button" onClick={() => void copy()} aria-label="Copy result"><Copy size={15} /></button>}</div>
        {error && <p className="tool-error" role="alert">{error}</p>}
      </div>
      <div className="calculator-keys" aria-label="Calculator keypad">
        {['AC', '(', ')', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', 'π', '+', '√', '^', '%', '='].map((key) => <button key={key} className={`${key === '=' ? 'key-equals' : ''} ${['AC', '⌫'].includes(key) ? 'key-muted' : ''}`} onClick={() => {
          if (key === 'AC') { setExpression(''); setAnswer(''); setError(''); }
          else if (key === '⌫') { const input = inputRef.current; const start = input?.selectionStart ?? expression.length; const end = input?.selectionEnd ?? expression.length; const from = start === end ? Math.max(0, start - 1) : start; setExpression(`${expression.slice(0, from)}${expression.slice(end)}`); requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(from, from); }); }
          else if (key === '=') calculate();
          else insert(({ '÷': '/', '×': '*', '−': '-', 'π': 'pi', '√': 'sqrt(' } as Record<string, string>)[key] || key);
        }}>{key}</button>)}
      </div>
      {keyboardOpen && <MathKeyboard onInsert={insert} onClose={() => setKeyboardOpen(false)} compact />}
      <div className="calculator-footnote"><span><Check size={13} /> Supports parentheses, powers, trigonometry, logarithms and constants</span><span>Enter to calculate · Esc to close keyboard</span></div>
    </section>
    <section className="play-panel calculator-history-panel">
      <div className="history-heading"><div className="play-panel-heading"><div className="play-panel-icon"><History size={17} /></div><div><h2>Calculation history</h2><p>Recent calculations are saved on this device.</p></div></div><button className="tool-icon-button" onClick={clearHistory} disabled={!history.length} aria-label="Clear calculation history"><Trash2 size={15} /></button></div>
      {history.length ? <div className="calculation-history">{history.map((item) => <button className="history-item" key={item.id} onClick={() => { setExpression(item.expression); setAnswer(item.result); setError(''); }}><span className="history-expression">{item.expression}</span><strong>= {item.result}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div> : <div className="tool-empty"><Clock3 size={20} /><strong>No calculations yet</strong><span>Your calculation history will appear here.</span></div>}
      <button className="button button-secondary history-restore" onClick={() => { setExpression(''); setAnswer(''); setError(''); }}><RotateCcw size={14} /> Clear current expression</button>
    </section>
  </div>;
}
