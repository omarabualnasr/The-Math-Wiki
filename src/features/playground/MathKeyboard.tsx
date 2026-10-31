import { useState } from 'react';
import { Keyboard, X } from 'lucide-react';

type KeyboardGroup = 'Basic' | 'Functions' | 'Constants';
const keys: Record<KeyboardGroup, string[]> = {
  Basic: ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '(', ')', '+', '^', '%', '!', 'pi', 'e', 'sqrt(', 'ans'],
  Functions: ['sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(', 'sinh(', 'cosh(', 'sqrt(', 'cbrt(', 'log(', 'log10(', 'abs(', 'exp(', 'floor(', 'ceil(', 'round(', 'min(', 'max(', 'factorial('],
  Constants: ['pi', 'e', 'tau', 'x', 'ans', '2*pi', 'pi/2', 'pi/4', 'sqrt(2)', 'sqrt(3)', 'ln(2)'],
};

export default function MathKeyboard({ onInsert, onClose, compact = false }: { onInsert: (value: string) => void; onClose?: () => void; compact?: boolean }) {
  const [group, setGroup] = useState<KeyboardGroup>('Basic');
  return <section className={`math-keyboard ${compact ? 'math-keyboard-compact' : ''}`} aria-label="Scientific mathematics keyboard">
    <div className="math-keyboard-head"><span><Keyboard size={14} /> Scientific keyboard</span>{onClose && <button className="math-keyboard-close" onClick={onClose} aria-label="Close scientific keyboard"><X size={14} /></button>}</div>
    <div className="math-keyboard-tabs">{(Object.keys(keys) as KeyboardGroup[]).map((item) => <button key={item} className={group === item ? 'selected' : ''} onClick={() => setGroup(item)}>{item}</button>)}</div>
    <div className="math-keyboard-grid">{keys[group].map((key, index) => <button key={`${key}-${index}`} className={/[a-z]/i.test(key) ? 'math-key-function' : ''} onClick={() => onInsert(key)}>{key}</button>)}</div>
  </section>;
}
