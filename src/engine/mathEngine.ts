import { evaluate, parse } from 'mathjs';

const allowedNames = new Set([
  'x', 'pi', 'e', 'tau', 'ans',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'abs', 'exp',
  'log', 'log10', 'log2', 'ln', 'floor', 'ceil', 'round',
  'min', 'max', 'pow', 'mod', 'factorial', 'sign', 'hypot',
]);

export function evaluateMathExpression(expression: string, scope: Record<string, unknown> = {}): number {
  const source = expression.replace(/π/g, 'pi').replace(/×/g, '*').replace(/÷/g, '/').trim();
  if (!source) throw new Error('Enter a mathematical expression.');
  if (!/^[0-9a-zA-Z_+\-*/^().,!%\s]+$/.test(source)) throw new Error('This expression contains unsupported characters.');
  const names = source.replace(/(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+/g, '0').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  const scopedNames = new Set(Object.keys(scope));
  const unknown = names.find((name) => !allowedNames.has(name) && !scopedNames.has(name));
  if (unknown) throw new Error(`Unsupported name: ${unknown}`);
  try {
    const result: unknown = evaluate(source, { pi: Math.PI, e: Math.E, tau: Math.PI * 2, ans: 0, ln: (value: number) => Math.log(value), ...scope });
    if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('The expression does not return a finite real number.');
    return result;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('The expression could not be evaluated.');
  }
}

export function formatNumber(value: number, precision = 10): string {
  if (Object.is(value, -0)) return '0';
  return Number(value.toPrecision(precision)).toString();
}


/** Convert calculator-style input into presentation TeX. MathJS renders named
 * functions (sin, cos, tan, log, etc.) as mathematical operators rather than
 * adjacent italic variables. This is a display-only conversion; it never
 * evaluates the expression. */
export function expressionToLatex(expression: string): string {
  const source = expression.replace(/π/g, 'pi').replace(/×/g, '*').replace(/÷/g, '/').trim();
  if (!source) return String.raw`\,`;
  try {
    return parse(source).toTex();
  } catch {
    // Keep a readable fallback for incomplete input while styling common
    // function names as operators (for example, \tan rather than tan).
    return source
      .replace(/\b(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|log10|log2|log|ln|sqrt|cbrt)\s*\(/gi, (_match, name: string) => {
        const normalized = name.toLowerCase();
        const operator = normalized === 'asin' ? String.raw`\arcsin`
          : normalized === 'acos' ? String.raw`\arccos`
            : normalized === 'atan' ? String.raw`\arctan`
              : `\\${normalized}`;
        return `${operator}\\left(`;
      })
      .replace(/\)/g, String.raw`\right)`);
  }
}
